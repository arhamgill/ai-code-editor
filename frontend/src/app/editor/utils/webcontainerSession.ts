"use client";

import type { FileNode } from "../types";

// ─────────────────────────────────────────────────────────────
// Persistent WebContainer session manager.
//
// The preview panel used to own the WebContainer instance + dev server
// in component state, so closing the panel unmounted it and KILLED the
// running `next dev` process — forcing a full `npm install` + boot on
// every reopen (~30–60s).
//
// This module lifts the whole session out of React into a single
// module-level singleton (stored on `window` so it survives HMR). The
// dev server keeps running while the panel is closed; reopening just
// re-attaches the iframe to the already-running URL. Installs are skipped
// when dependencies are already present for the active project.
// ─────────────────────────────────────────────────────────────

export type PreviewStatus =
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "running"
  | "error";

export interface PreviewSessionState {
  status: PreviewStatus;
  statusText: string;
  serverUrl: string | null;
  errorMsg: string | null;
  logs: string[];
  /** projectId the dev server is currently serving, if running */
  runningProjectId: string | null;
}

export interface RunOptions {
  projectId: string;
  fileTree: FileNode[];
  tabContents: Record<string, string>;
  getToken: () => Promise<string | null>;
  apiBase: string;
}

type Listener = (state: PreviewSessionState) => void;

// Strip ANSI escape codes and drop spinner-only frames from process output.
function cleanLogChunk(text: string): string[] {
  const clean = text
    // eslint-disable-next-line no-control-regex
    .replace(/[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "")
    .replace(/\r/g, "\n");
  return clean.split("\n").filter((l) => {
    const t = l.trim();
    if (["|", "/", "-", "\\", "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"].includes(t)) {
      return false;
    }
    return t.length > 0;
  });
}

// Runtime hotfix: Next 16 crashes in WebContainer, so pin it (and eslint-config-next)
// down to 15.1.0 in the mounted package.json only. Protects imported projects.
function patchPackageJson(contents: string): string {
  try {
    const pkg = JSON.parse(contents || "{}");
    let modified = false;
    const v = pkg.dependencies?.next;
    if (v && (v.startsWith("16") || v.startsWith("^16") || v.includes("15.5") || v.includes("canary"))) {
      pkg.dependencies.next = "15.1.0";
      if (pkg.devDependencies?.["eslint-config-next"]) {
        pkg.devDependencies["eslint-config-next"] = "15.1.0";
      }
      modified = true;
    }
    return modified ? JSON.stringify(pkg, null, 2) : contents;
  } catch (_) {
    return contents;
  }
}

async function buildTree(opts: RunOptions): Promise<Record<string, unknown>> {
  const { fileTree, tabContents, projectId, getToken, apiBase } = opts;

  const walk = async (nodes: FileNode[]): Promise<Record<string, unknown>> => {
    const tree: Record<string, unknown> = {};
    for (const node of nodes) {
      if (node.type === "directory") {
        tree[node.name] = { directory: await walk(node.children || []) };
        continue;
      }

      let content = tabContents[node.path];
      let isBinary = false;
      if (content === undefined && projectId) {
        try {
          const token = await getToken();
          const res = await fetch(`${apiBase}/api/projects/${projectId}/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ path: node.path }),
          });
          if (res.ok) {
            const data = await res.json();
            content = data.content ?? "";
            isBinary = data.isBinary ?? false;
          } else {
            content = "";
          }
        } catch (_) {
          content = "";
        }
      }

      let fileData: string | Uint8Array = content || "";
      if (isBinary && typeof content === "string" && content.startsWith("data:")) {
        try {
          const base64 = content.split(",")[1];
          const bin = window.atob(base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          fileData = bytes;
        } catch (_) {}
      }

      if (node.name === "package.json" && typeof fileData === "string") {
        fileData = patchPackageJson(fileData);
      }

      tree[node.name] = { file: { contents: fileData } };
    }
    return tree;
  };

  return walk(fileTree);
}

class WebContainerSession {
  private instance: any = null;
  private bootPromise: Promise<any> | null = null;
  private mountedProjectId: string | null = null;
  private installedProjectId: string | null = null;
  private processes: any[] = [];
  private listeners = new Set<Listener>();

  private state: PreviewSessionState = {
    status: "idle",
    statusText: "Ready to run",
    serverUrl: null,
    errorMsg: null,
    logs: [],
    runningProjectId: null,
  };

  getState(): PreviewSessionState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    // Fresh object each emit so React's useSyncExternalStore/useState sees a change
    this.state = { ...this.state };
    this.listeners.forEach((fn) => fn(this.state));
  }

  private set(patch: Partial<PreviewSessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  private appendLogs(chunk: string) {
    const lines = cleanLogChunk(chunk);
    if (lines.length === 0) return;
    this.set({ logs: [...this.state.logs.slice(-150), ...lines] });
  }

  private trackProcess(proc: any) {
    this.processes.push(proc);
  }

  private killProcesses() {
    this.processes.forEach((p) => {
      try { p.kill(); } catch (_) {}
    });
    this.processes = [];
  }

  private async boot() {
    if (this.instance) return this.instance;
    if (!this.bootPromise) {
      this.bootPromise = import("@webcontainer/api")
        .then(({ WebContainer }) => WebContainer.boot())
        .then((inst) => {
          this.instance = inst;
          // Register server-ready ONCE per instance; fires whenever a dev server binds.
          inst.on("server-ready", (_port: number, url: string) => {
            this.set({
              serverUrl: url,
              status: "running",
              statusText: url,
              runningProjectId: this.mountedProjectId,
            });
          });
          return inst;
        })
        .catch((err) => {
          this.bootPromise = null;
          throw err;
        });
    }
    return this.bootPromise;
  }

  /** True when the dev server is already serving this exact project. */
  isRunningFor(projectId: string): boolean {
    return this.state.status === "running" && this.state.runningProjectId === projectId && !!this.state.serverUrl;
  }

  async run(opts: RunOptions) {
    const { projectId } = opts;

    // Already serving this project → nothing to do; the panel just re-attaches.
    if (this.isRunningFor(projectId)) {
      this.emit();
      return;
    }

    // Switching projects → hard reset so the container FS is clean.
    if (this.mountedProjectId && this.mountedProjectId !== projectId) {
      await this.teardown();
    }

    this.set({ status: "booting", statusText: "Booting WebContainer...", errorMsg: null, logs: [] });

    try {
      const instance = await this.boot();

      if (this.mountedProjectId !== projectId) {
        this.set({ status: "mounting", statusText: "Mounting project files..." });
        const tree = await buildTree(opts);
        await instance.mount(tree);
        this.mountedProjectId = projectId;
        this.installedProjectId = null; // fresh mount → dependencies must be installed
      }

      if (this.installedProjectId !== projectId) {
        this.set({ status: "installing", statusText: "Installing dependencies (npm install)..." });
        const install = await instance.spawn("npm", ["install"]);
        this.trackProcess(install);
        install.output.pipeTo(new WritableStream({ write: (d) => this.appendLogs(d) }));
        const code = await install.exit;
        if (code !== 0) throw new Error("npm install failed");
        this.installedProjectId = projectId;
      }

      this.set({ status: "starting", statusText: "Starting dev server..." });
      const { exec, args } = await this.resolveDevCommand(opts);
      const dev = await instance.spawn(exec, args);
      this.trackProcess(dev);
      dev.output.pipeTo(new WritableStream({ write: (d) => this.appendLogs(d) }));
      // status flips to "running" when the server-ready handler fires
    } catch (err) {
      this.set({
        status: "error",
        statusText: "Error",
        errorMsg: err instanceof Error ? err.message : "Failed to boot WebContainer",
      });
    }
  }

  private async resolveDevCommand(opts: RunOptions): Promise<{ exec: string; args: string[] }> {
    let pkgContent = opts.tabContents["package.json"];
    if (pkgContent === undefined && opts.projectId) {
      try {
        const token = await opts.getToken();
        const res = await fetch(`${opts.apiBase}/api/projects/${opts.projectId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path: "package.json" }),
        });
        if (res.ok) pkgContent = (await res.json()).content ?? "";
      } catch (_) {}
    }
    try {
      if (pkgContent) {
        const dev = JSON.parse(pkgContent).scripts?.dev || "";
        // Run standard next dev (Webpack; Turbopack is unreliable in WebContainer).
        if (dev.includes("next dev")) return { exec: "npx", args: ["next", "dev"] };
      }
    } catch (_) {}
    return { exec: "npm", args: ["run", "dev"] };
  }

  /** Stop the dev server but KEEP the container + installed deps (fast restart). */
  stop() {
    this.killProcesses();
    this.set({ status: "idle", statusText: "Stopped", serverUrl: null, runningProjectId: null });
  }

  /** Fully tear down the container (used on project switch / workspace close). */
  async teardown() {
    this.killProcesses();
    if (this.instance) {
      try { this.instance.teardown(); } catch (_) {}
    }
    this.instance = null;
    this.bootPromise = null;
    this.mountedProjectId = null;
    this.installedProjectId = null;
    this.set({ status: "idle", statusText: "Ready to run", serverUrl: null, errorMsg: null, logs: [], runningProjectId: null });
  }

  /** Mirror a file write into the running container so Next.js hot-reloads it. */
  async syncFile(projectId: string, path: string, content: string) {
    if (!this.instance || this.mountedProjectId !== projectId) return;
    try {
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (dir) await this.instance.fs.mkdir(dir, { recursive: true });
      await this.instance.fs.writeFile(path, content);
    } catch (_) {}
  }

  async removeFile(projectId: string, path: string) {
    if (!this.instance || this.mountedProjectId !== projectId) return;
    try {
      await this.instance.fs.rm(path, { recursive: true, force: true });
    } catch (_) {}
  }
}

function getSession(): WebContainerSession {
  if (typeof window === "undefined") return new WebContainerSession();
  const w = window as any;
  if (!w.__forgeWcSession) w.__forgeWcSession = new WebContainerSession();
  return w.__forgeWcSession;
}

export const previewSession = getSession();
