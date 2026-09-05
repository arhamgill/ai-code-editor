"use client";

import type { FileNode } from "./types";
import type { ForgeApi } from "./api";

/**
 * Persistent WebContainer session.
 *
 * The dev server lives outside React so closing the preview panel does not kill
 * `next dev` — reopening re-attaches to the already-running server instead of
 * paying for another `npm install`. The singleton is parked on `window` so it
 * also survives a Fast Refresh during development.
 */

export type PreviewStatus =
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "running"
  | "error";

export interface PreviewState {
  status: PreviewStatus;
  message: string;
  url: string | null;
  error: string | null;
  logs: LogLine[];
  projectId: string | null;
  /** 0–1 while installing, null when not applicable. */
  progress: number | null;
}

export interface LogLine {
  id: number;
  text: string;
  level: "info" | "error";
}

interface RunOptions {
  projectId: string;
  tree: FileNode[];
  /** Unsaved editor buffers, so the preview reflects what you see. */
  drafts: Record<string, string>;
  api: ForgeApi;
}

const MAX_LOGS = 300;

/** WebContainers need SharedArrayBuffer, which needs cross-origin isolation. */
export function previewSupport(): { supported: boolean; reason?: string } {
  if (typeof window === "undefined") return { supported: false };
  if (typeof SharedArrayBuffer === "undefined") {
    return {
      supported: false,
      reason:
        "This browser doesn't expose SharedArrayBuffer, which the in-browser runtime needs. Chrome, Edge or Firefox on desktop will work.",
    };
  }
  if (!window.crossOriginIsolated) {
    return {
      supported: false,
      reason:
        "The page isn't cross-origin isolated, so the in-browser runtime can't start. Check that the COOP/COEP headers in next.config.ts are being served.",
    };
  }
  return { supported: true };
}

const ANSI = /[][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-PR-TZcf-nqry=><]/g;
const SPINNER_FRAMES = new Set(["|", "/", "-", "\\", "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]);

function cleanChunk(text: string): string[] {
  return text
    .replace(ANSI, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !SPINNER_FRAMES.has(line.trim()));
}

/**
 * Next 16 does not boot inside a WebContainer, so the mounted copy is pinned to
 * 15.x. This rewrites only the in-memory tree handed to the container — the
 * user's package.json on disk is never touched.
 */
function pinNextVersion(source: string): string {
  try {
    const pkg = JSON.parse(source || "{}");
    const version: string | undefined = pkg.dependencies?.next;
    if (!version) return source;

    const major = Number(version.replace(/^[^\d]*/, "").split(".")[0]);
    if (!Number.isFinite(major) || major < 16) return source;

    pkg.dependencies.next = "15.1.0";
    if (pkg.devDependencies?.["eslint-config-next"]) {
      pkg.devDependencies["eslint-config-next"] = "15.1.0";
    }
    // Turbopack is unreliable in the container; fall back to webpack.
    if (typeof pkg.scripts?.dev === "string") {
      pkg.scripts.dev = pkg.scripts.dev.replace(/\s--turbopack\b/, "").replace(/\s--turbo\b/, "");
    }
    return JSON.stringify(pkg, null, 2);
  } catch {
    return source;
  }
}

type FileSystemTree = Record<string, unknown>;

/** How to start the dev server for a given package.json. */
function resolveDevCommand(packageJson: string | null): {
  exec: string;
  args: string[];
  error?: string;
} {
  let pkg: { scripts?: Record<string, string>; dependencies?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(packageJson || "{}");
  } catch {
    return {
      exec: "",
      args: [],
      error: "package.json isn't valid JSON, so the dev server can't be started. Fix it and run again.",
    };
  }

  if (pkg.scripts?.dev) return { exec: "npm", args: ["run", "dev"] };

  // No `dev` script, but it is still a Next project — start Next directly
  // rather than failing with npm's bare "Missing script: dev".
  if (pkg.dependencies?.next) return { exec: "npx", args: ["--yes", "next", "dev"] };

  return {
    exec: "",
    args: [],
    error:
      'This project has no "dev" script in package.json and no "next" dependency, so there is nothing to run. Add a dev script and try again.',
  };
}

class PreviewSession {
  private container: unknown = null;
  private booting: Promise<unknown> | null = null;
  private mountedProject: string | null = null;
  private installedProject: string | null = null;
  private packageJson: string | null = null;
  private processes: { kill: () => void }[] = [];
  private listeners = new Set<(state: PreviewState) => void>();
  private logId = 0;

  private state: PreviewState = {
    status: "idle",
    message: "Not running",
    url: null,
    error: null,
    logs: [],
    projectId: null,
    progress: null,
  };

  getState = (): PreviewState => this.state;

  subscribe = (listener: (state: PreviewState) => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  private patch(partial: Partial<PreviewState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  private log(chunk: string, level: LogLine["level"] = "info") {
    const lines = cleanChunk(chunk);
    if (!lines.length) return;
    const next = [
      ...this.state.logs,
      ...lines.map((text) => ({ id: this.logId++, text, level })),
    ].slice(-MAX_LOGS);
    this.patch({ logs: next });
  }

  isRunningFor(projectId: string) {
    return this.state.status === "running" && this.state.projectId === projectId && !!this.state.url;
  }

  private async boot() {
    if (this.container) return this.container;
    if (this.booting) return this.booting;

    this.booting = import("@webcontainer/api")
      .then(({ WebContainer }) => WebContainer.boot({ coep: "credentialless" }))
      .then((instance) => {
        this.container = instance;
        // Registered once per instance; fires whenever a dev server binds.
        instance.on("server-ready", (_port: number, url: string) => {
          this.patch({
            status: "running",
            url,
            message: url,
            progress: null,
            projectId: this.mountedProject,
          });
        });
        instance.on("error", ({ message }: { message: string }) => {
          this.patch({ status: "error", error: message, message: "Failed" });
        });
        return instance;
      })
      .catch((error) => {
        this.booting = null;
        throw error;
      });

    return this.booting;
  }

  private async buildTree({ tree, drafts, projectId, api }: RunOptions): Promise<FileSystemTree> {
    const walk = async (nodes: FileNode[]): Promise<FileSystemTree> => {
      const output: FileSystemTree = {};

      // Fetch this level's file contents in parallel — the old implementation
      // awaited one request per file in sequence, so mounting a 60-file project
      // meant 60 serial round trips before the container could even start.
      const results = await Promise.all(
        nodes.map(async (node) => {
          if (node.type === "directory") {
            return { node, directory: await walk(node.children ?? []) };
          }

          const draft = drafts[node.path];
          if (draft !== undefined) return { node, contents: draft as string | Uint8Array };

          try {
            const file = await api.projects.readFile(projectId, node.path);
            if (file.isBinary && file.content.startsWith("data:")) {
              const base64 = file.content.split(",")[1] ?? "";
              const binary = atob(base64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              return { node, contents: bytes as string | Uint8Array };
            }
            return { node, contents: file.content as string | Uint8Array };
          } catch {
            return { node, contents: "" as string | Uint8Array };
          }
        })
      );

      for (const result of results) {
        if ("directory" in result) {
          output[result.node.name] = { directory: result.directory };
        } else {
          let contents = result.contents;
          if (result.node.name === "package.json" && typeof contents === "string") {
            contents = pinNextVersion(contents);
            // Remember the root manifest so the dev command can be derived from
            // what was actually mounted, not from a separate re-fetch.
            if (result.node.path === "package.json") this.packageJson = contents;
          }
          output[result.node.name] = { file: { contents } };
        }
      }

      return output;
    };

    return walk(tree);
  }

  async run(options: RunOptions) {
    const { projectId } = options;

    if (this.isRunningFor(projectId)) {
      this.patch({});
      return;
    }

    const support = previewSupport();
    if (!support.supported) {
      this.patch({ status: "error", error: support.reason ?? "Preview is unavailable.", message: "Unsupported" });
      return;
    }

    // Switching projects needs a clean filesystem.
    if (this.mountedProject && this.mountedProject !== projectId) {
      await this.teardown();
    }

    this.patch({
      status: "booting",
      message: "Starting the runtime…",
      error: null,
      logs: [],
      progress: null,
      projectId,
    });

    try {
      const container = (await this.boot()) as {
        mount: (tree: FileSystemTree) => Promise<void>;
        spawn: (cmd: string, args: string[]) => Promise<{
          output: ReadableStream<string>;
          exit: Promise<number>;
          kill: () => void;
        }>;
      };

      if (this.mountedProject !== projectId) {
        this.patch({ status: "mounting", message: "Copying project files…" });
        await container.mount(await this.buildTree(options));
        this.mountedProject = projectId;
        this.installedProject = null;
      }

      if (this.installedProject !== projectId) {
        this.patch({
          status: "installing",
          message: "Installing dependencies — this takes a minute the first time",
          progress: 0,
        });

        const install = await container.spawn("npm", ["install", "--no-audit", "--no-fund"]);
        this.processes.push(install);
        install.output.pipeTo(
          new WritableStream({
            write: (chunk) => {
              this.log(chunk, /npm error|ERR!/i.test(chunk) ? "error" : "info");
              // npm reports "added N packages" near the end; use whatever
              // signal we can get so the bar isn't a pure guess.
              if (/reify:|added \d+ package/i.test(chunk)) {
                this.patch({ progress: Math.min(0.95, (this.state.progress ?? 0) + 0.02) });
              }
            },
          })
        );

        const code = await install.exit;
        if (code !== 0) {
          throw new Error(
            "npm install failed. Check the console output below — a bad dependency in package.json is the usual cause."
          );
        }
        this.installedProject = projectId;
      }

      const command = resolveDevCommand(this.packageJson);
      if (command.error) {
        this.patch({ status: "error", message: "Can't start", error: command.error });
        return;
      }

      this.patch({ status: "starting", message: "Starting the dev server…", progress: null });
      const dev = await container.spawn(command.exec, command.args);
      this.processes.push(dev);
      dev.output.pipeTo(
        new WritableStream({
          write: (chunk) => this.log(chunk, /error|failed|ELIFECYCLE/i.test(chunk) ? "error" : "info"),
        })
      );

      // The server-ready handler flips us to "running".
      dev.exit.then((code) => {
        if (code !== 0 && this.state.status !== "idle") {
          this.patch({
            status: "error",
            message: "Dev server stopped",
            error: `The dev server exited with code ${code}. See the console output for details.`,
          });
        }
      });
    } catch (error) {
      this.patch({
        status: "error",
        message: "Failed",
        error: error instanceof Error ? error.message : "The preview could not be started.",
      });
    }
  }

  /** Stop the server but keep the container and installed dependencies warm. */
  stop() {
    this.processes.forEach((process) => {
      try {
        process.kill();
      } catch {
        /* already gone */
      }
    });
    this.processes = [];
    this.patch({ status: "idle", message: "Stopped", url: null, progress: null });
  }

  async teardown() {
    this.stop();
    const container = this.container as { teardown?: () => void } | null;
    try {
      container?.teardown?.();
    } catch {
      /* nothing useful to do */
    }
    this.container = null;
    this.booting = null;
    this.mountedProject = null;
    this.installedProject = null;
    this.packageJson = null;
    this.patch({
      status: "idle",
      message: "Not running",
      url: null,
      error: null,
      logs: [],
      projectId: null,
      progress: null,
    });
  }

  /** Mirror a saved file into the running container so Next.js hot-reloads it. */
  async writeFile(projectId: string, path: string, content: string) {
    const container = this.container as {
      fs: {
        mkdir: (p: string, o: { recursive: boolean }) => Promise<void>;
        writeFile: (p: string, c: string) => Promise<void>;
      };
    } | null;
    if (!container || this.mountedProject !== projectId) return;

    try {
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (dir) await container.fs.mkdir(dir, { recursive: true });
      await container.fs.writeFile(path, content);
    } catch {
      /* the next full run will pick it up */
    }
  }

  async removeFile(projectId: string, path: string) {
    const container = this.container as {
      fs: { rm: (p: string, o: { recursive: boolean; force: boolean }) => Promise<void> };
    } | null;
    if (!container || this.mountedProject !== projectId) return;
    try {
      await container.fs.rm(path, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

declare global {
  interface Window {
    __forgePreview?: PreviewSession;
  }
}

function resolveSession(): PreviewSession {
  if (typeof window === "undefined") return new PreviewSession();
  if (!window.__forgePreview) window.__forgePreview = new PreviewSession();
  return window.__forgePreview;
}

export const previewSession = resolveSession();
