"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Project, FileNode } from "../types";

interface PreviewPanelProps {
  show: boolean;
  onClose: () => void;
  activeProject: Project | null;
  fileTree: FileNode[];
  tabContents: Record<string, string>;
  activeFilePath: string | null;
  previewWidth: number;
  handlePreviewMouseDown: (e: React.MouseEvent) => void;
  getToken: () => Promise<string | null>;
}

type PreviewState = "idle" | "loading-deps" | "running" | "error";
type EngineMode = "html" | "webcontainer";

function findHtmlFile(fileTree: FileNode[], activeFilePath?: string | null): string | null {
  if (activeFilePath && activeFilePath.endsWith(".html")) {
    return activeFilePath;
  }
  const walk = (nodes: FileNode[]): string | null => {
    for (const node of nodes) {
      if (node.type === "file" && (node.name === "index.html" || node.name.endsWith(".html"))) {
        return node.path;
      }
      if (node.children) {
        const found = walk(node.children);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(fileTree);
}

function hasPackageJson(fileTree: FileNode[]): boolean {
  return fileTree.some((n) => n.name === "package.json" && n.type === "file");
}

async function getInlinedHtml(
  htmlPath: string,
  tabContents: Record<string, string>,
  activeProject: Project | null,
  getToken: () => Promise<string | null>,
  apiBase: string
): Promise<string> {
  let html = tabContents[htmlPath];

  if (html === undefined && activeProject) {
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/projects/${activeProject.id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: htmlPath }),
      });
      if (res.ok) {
        const data = await res.json();
        html = data.content ?? "";
      }
    } catch (_) {}
  }

  if (!html) return "";

  const dir = htmlPath.includes("/") ? htmlPath.substring(0, htmlPath.lastIndexOf("/")) : "";

  const getFileContent = async (relPath: string): Promise<string | null> => {
    const fullPath = dir ? `${dir}/${relPath}`.replace(/^\/\//, "/") : relPath;
    if (tabContents[fullPath] !== undefined) return tabContents[fullPath];
    if (activeProject) {
      try {
        const token = await getToken();
        const res = await fetch(`${apiBase}/api/projects/${activeProject.id}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path: fullPath }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.content ?? null;
        }
      } catch (_) {}
    }
    return null;
  };

  // Inline CSS: <link rel="stylesheet" href="...">
  const linkMatches = Array.from(html.matchAll(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi));
  for (const m of linkMatches) {
    const fullTag = m[0];
    const cssPath = m[1];
    if (!cssPath.startsWith("http://") && !cssPath.startsWith("https://")) {
      const cssContent = await getFileContent(cssPath);
      if (cssContent !== null) {
        html = html.replace(fullTag, `<style>\n${cssContent}\n</style>`);
      }
    }
  }

  // Inline JS: <script src="..."></script>
  const scriptMatches = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+\.js)["'][^>]*><\/script>/gi));
  for (const m of scriptMatches) {
    const fullTag = m[0];
    const jsPath = m[1];
    if (!jsPath.startsWith("http://") && !jsPath.startsWith("https://")) {
      const jsContent = await getFileContent(jsPath);
      if (jsContent !== null) {
        html = html.replace(fullTag, `<script>\n${jsContent}\n</script>`);
      }
    }
  }

  return html;
}

async function buildWebContainerTree(
  nodes: FileNode[],
  tabContents: Record<string, string>,
  projectId: string,
  getToken: () => Promise<string | null>,
  apiBase: string
): Promise<unknown> {
  const tree: Record<string, unknown> = {};

  for (const node of nodes) {
    if (node.type === "directory") {
      const subTree = await buildWebContainerTree(
        node.children || [],
        tabContents,
        projectId,
        getToken,
        apiBase
      );
      tree[node.name] = { directory: subTree };
    } else if (node.type === "file") {
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

      // If the file is binary and content is a data URL base64, convert to Uint8Array for WebContainer
      let fileData: string | Uint8Array = content || "";
      if (isBinary && typeof content === "string" && content.startsWith("data:")) {
        try {
          const base64Data = content.split(",")[1];
          const binaryString = window.atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileData = bytes;
        } catch (_) {}
      }

      // In-memory runtime hotfix for package.json to prevent framework-level WebContainer crashes (e.g. Next.js 16 workUnitAsyncStorage errors)
      if (node.name === "package.json" && typeof fileData === "string") {
        try {
          const pkg = JSON.parse(fileData || "{}");
          let modified = false;

          if (pkg.dependencies && pkg.dependencies.next) {
            const version = pkg.dependencies.next;
            // Pin incompatibilities dynamically for the sandbox context only
            if (version.startsWith("16") || version.startsWith("^16") || version.includes("15.5") || version.includes("canary")) {
              pkg.dependencies.next = "15.1.0";
              if (pkg.devDependencies && pkg.devDependencies["eslint-config-next"]) {
                pkg.devDependencies["eslint-config-next"] = "15.1.0";
              }
              modified = true;
            }
          }

          if (modified) {
            fileData = JSON.stringify(pkg, null, 2);
          }
        } catch (_) {}
      }

      tree[node.name] = {
        file: {
          contents: fileData,
        },
      };
    }
  }

  return tree;
}

// Global WebContainer singleton helper to survive React Dev HMR / hot-reloads
function getWcGlobals() {
  if (typeof window === "undefined") {
    return {
      getInstance: () => null,
      setInstance: () => {},
      getPromise: () => null,
      setPromise: () => {},
    };
  }
  const w = window as any;
  return {
    getInstance: () => w.__globalWcInstance || null,
    setInstance: (val: any) => { w.__globalWcInstance = val; },
    getPromise: () => w.__globalWcBootPromise || null,
    setPromise: (val: any) => { w.__globalWcBootPromise = val; },
  };
}

export function PreviewPanel({
  show,
  onClose,
  activeProject,
  fileTree,
  tabContents,
  activeFilePath,
  previewWidth,
  handlePreviewMouseDown,
  getToken,
}: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeProcessesRef = useRef<any[]>([]);
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Ready to run");
  const [engineMode, setEngineMode] = useState<EngineMode>("html");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const htmlFile = findHtmlFile(fileTree, activeFilePath);
  const hasPkg = hasPackageJson(fileTree);

  // Set initial engine mode when project loads
  useEffect(() => {
    if (activeProject?.id) {
      if (hasPkg) {
        setEngineMode("webcontainer");
      } else if (htmlFile) {
        setEngineMode("html");
      }
    }
  }, [activeProject?.id, hasPkg, htmlFile]);

  // ── HTML iframe preview ──────────────────────────────────────
  const runHtmlPreview = useCallback(async () => {
    const targetHtml = htmlFile;
    if (!targetHtml) {
      setErrorMsg("No HTML file found in project to preview.");
      setPreviewState("error");
      return;
    }

    setPreviewState("loading-deps");
    setStatusText(`Inlining assets for ${targetHtml.split("/").pop()}...`);

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const fullHtml = await getInlinedHtml(targetHtml, tabContents, activeProject, getToken, API);

    if (iframeRef.current) {
      iframeRef.current.srcdoc = fullHtml;
    }

    setPreviewState("running");
    setPreviewUrl(null);
    setStatusText(`Previewing: ${targetHtml}`);
  }, [htmlFile, tabContents, activeProject, getToken]);

  // ── WebContainer preview ─────────────────────────────────────
  const runWebContainer = useCallback(async () => {
    setPreviewState("loading-deps");
    setStatusText("Booting WebContainer...");
    setErrorMsg(null);
    setConsoleLogs([]);

    // Terminate any previous running processes in this session
    activeProcessesRef.current.forEach((proc) => {
      try { proc.kill(); } catch (_) {}
    });
    activeProcessesRef.current = [];

    try {
      const { WebContainer } = await import("@webcontainer/api");

      // Boot or retrieve the global WebContainer singleton instance
      const wcGlobals = getWcGlobals();
      let instance = wcGlobals.getInstance() as InstanceType<typeof WebContainer> | null;
      if (!instance) {
        let bootPromise = wcGlobals.getPromise();
        if (!bootPromise) {
          bootPromise = WebContainer.boot().then((inst) => {
            wcGlobals.setInstance(inst);
            return inst;
          }).catch((err) => {
            wcGlobals.setPromise(null); // Clear promise so we can retry on error
            throw err;
          });
          wcGlobals.setPromise(bootPromise);
        }
        instance = (await bootPromise) as InstanceType<typeof WebContainer>;
      }

      setStatusText("Mounting project files...");
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const filesTree = (await buildWebContainerTree(
        fileTree,
        tabContents,
        activeProject?.id || "",
        getToken,
        API
      )) as Parameters<typeof instance.mount>[0];

      await instance.mount(filesTree);

      const appendLogs = (text: string) => {
        // Strip ANSI color codes, cursor positions, and clear codes
        const clean = text
          .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "")
          .replace(/\r/g, "\n");

        const lines = clean.split("\n");
        const filtered = lines.filter((l) => {
          const t = l.trim();
          // Filter out spinner/progress animation frames
          if (t === "|" || t === "/" || t === "-" || t === "\\" || t === "⠋" || t === "⠙" || t === "⠹" || t === "⠸" || t === "⠼" || t === "⠴" || t === "⠦" || t === "⠧" || t === "⠇" || t === "⠏") {
            return false;
          }
          return t.length > 0;
        });

        if (filtered.length === 0) return;
        setConsoleLogs((prev) => [...prev.slice(-150), ...filtered]);
      };

      setStatusText("Installing dependencies (npm install)...");
      const installProcess = await instance.spawn("npm", ["install"]);
      activeProcessesRef.current.push(installProcess);
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            appendLogs(data);
          },
        })
      );
      const installExit = await installProcess.exit;
      if (installExit !== 0) throw new Error("npm install failed");

      setStatusText("Starting dev server...");
      
      let spawnExec = "npm";
      let spawnArgs = ["run", "dev"];

      // Read package.json to verify dev script and bypass Turbopack if Next.js is detected
      try {
        let pkgContent = tabContents["package.json"];
        if (pkgContent === undefined && activeProject) {
          const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          const token = await getToken();
          const res = await fetch(`${API}/api/projects/${activeProject.id}/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ path: "package.json" }),
          });
          if (res.ok) {
            const data = await res.json();
            pkgContent = data.content ?? "";
          }
        }

        if (pkgContent) {
          const pkg = JSON.parse(pkgContent);
          const devScript = pkg.scripts?.dev || "";
          if (devScript.includes("next dev")) {
            spawnExec = "npx";
            spawnArgs = ["next", "dev"]; // Run standard next dev (uses Webpack by default, no Turbopack)
          }
        }
      } catch (_) {}

      const devProcess = await instance.spawn(spawnExec, spawnArgs);
      activeProcessesRef.current.push(devProcess);
      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            appendLogs(data);
          },
        })
      );

      instance.on("server-ready", (port: number, url: string) => {
        setPreviewUrl(url);
        setPreviewState("running");
        setStatusText(url);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to boot WebContainer";
      setErrorMsg(msg);
      setPreviewState("error");
      setStatusText("Error");
    }
  }, [fileTree, tabContents, activeProject, getToken]);

  // Terminate processes when component unmounts
  useEffect(() => {
    return () => {
      activeProcessesRef.current.forEach((proc) => {
        try { proc.kill(); } catch (_) {}
      });
    };
  }, []);

  const handleRun = () => {
    setIframeKey((prev) => prev + 1); // Force a complete iframe DOM remount to reset Service Worker connection
    if (engineMode === "webcontainer") {
      runWebContainer();
    } else {
      runHtmlPreview();
    }
  };

  const handleStop = () => {
    setPreviewState("idle");
    setPreviewUrl(null);
    setStatusText("Stopped");
    if (iframeRef.current) iframeRef.current.srcdoc = "";

    // Terminate all WebContainer processes
    activeProcessesRef.current.forEach((proc) => {
      try { proc.kill(); } catch (_) {}
    });
    activeProcessesRef.current = [];
  };
  // Auto re-render HTML preview on tab content edit
  useEffect(() => {
    if (previewState === "running" && engineMode === "html" && htmlFile) {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      getInlinedHtml(htmlFile, tabContents, activeProject, getToken, API).then((fullHtml) => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = fullHtml;
        }
      });
    }
  }, [tabContents, htmlFile, previewState, engineMode, activeProject, getToken]);

  const handleReload = useCallback(() => {
    if (iframeRef.current) {
      if (engineMode === "html") {
        if (htmlFile) {
          const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          getInlinedHtml(htmlFile, tabContents, activeProject, getToken, API).then((fullHtml) => {
            if (iframeRef.current) iframeRef.current.srcdoc = fullHtml;
          });
        }
      } else if (previewUrl) {
        const currentSrc = previewUrl;
        iframeRef.current.src = "about:blank";
        setTimeout(() => {
          if (iframeRef.current) iframeRef.current.src = currentSrc;
        }, 50);
      }
    }
  }, [engineMode, htmlFile, tabContents, activeProject, getToken, previewUrl]);

  // Auto-reload preview 1.5s after running WebContainer dev server to make sure it loads after Next.js is fully ready
  useEffect(() => {
    if (previewState === "running" && engineMode === "webcontainer" && previewUrl) {
      const timer = setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = previewUrl;
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [previewState, engineMode, previewUrl]);

  if (!show) return null;

  return (
    <>
      {/* Drag resize divider */}
      <div className="resize-divider" onMouseDown={handlePreviewMouseDown} />

      <aside className="preview-panel" style={{ width: previewWidth, minWidth: 280 }}>
        {/* Header */}
        <div className="preview-header">
          <div className="preview-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Preview
          </div>

          {/* Engine Selector */}
          <div style={{ display: "flex", gap: "0.2rem", background: "#0d0d0d", padding: "0.15rem", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
            <button
              className={`mode-btn ${engineMode === "html" ? "active" : ""}`}
              onClick={() => { setEngineMode("html"); setPreviewState("idle"); }}
              title="Instant HTML/CSS/JS in-browser preview"
              style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem" }}
            >
              HTML
            </button>
            <button
              className={`mode-btn ${engineMode === "webcontainer" ? "active" : ""}`}
              onClick={() => { setEngineMode("webcontainer"); setPreviewState("idle"); }}
              title="WebContainer Node.js dev server"
              style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem" }}
            >
              Node.js
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", marginLeft: "auto" }}>
            {previewState === "idle" || previewState === "error" ? (
              <button
                className="btn btn-primary"
                onClick={handleRun}
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", display: "flex", gap: "0.3rem", alignItems: "center" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Run
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={handleStop}
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", display: "flex", gap: "0.3rem", alignItems: "center" }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                Stop
              </button>
            )}
            {previewState === "running" && (
              <button
                className="sidebar-action-btn"
                onClick={handleReload}
                title="Reload preview"
                style={{ padding: "0.3rem" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </button>
            )}
            <button className="sidebar-action-btn" onClick={onClose} title="Close preview" style={{ padding: "0.3rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* URL / status bar */}
        <div className="preview-url-bar" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
          <span className="preview-url-text" title={statusText}>
            {previewState === "loading-deps" && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite", marginRight: "4px" }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
            {statusText}
          </span>
        </div>

        {/* Preview body */}
        <div className="preview-body">
          {previewState === "idle" && (
            <div className="preview-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", maxWidth: "220px" }}>
                {engineMode === "html"
                  ? htmlFile
                    ? `Click Run to preview ${htmlFile.split("/").pop()}`
                    : "No HTML file found in workspace"
                  : "Click Run to boot WebContainer Node.js dev server"}
              </p>
            </div>
          )}

          {previewState === "loading-deps" && (
            <div className="preview-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <p style={{ color: "var(--color-accent)", fontSize: "0.85rem" }}>{statusText}</p>
            </div>
          )}

          {previewState === "error" && (
            <div className="preview-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p style={{ color: "#f87171", fontSize: "0.82rem", textAlign: "center", maxWidth: "220px" }}>
                {errorMsg ?? "Preview failed"}
              </p>
              <button className="btn btn-secondary" onClick={handleRun} style={{ fontSize: "0.75rem", padding: "0.35rem 0.8rem" }}>
                Retry
              </button>
            </div>
          )}

          {/* The iframe */}
          <iframe
            key={iframeKey}
            ref={iframeRef}
            className="preview-iframe"
            src={previewUrl ?? undefined}
            style={{ display: previewState === "running" ? "block" : "none" }}
            allow="cross-origin-isolated"
            title="Live Preview"
          />

          {/* Collapsible Console Drawer */}
          {engineMode === "webcontainer" && previewState !== "idle" && (
            <div className={`preview-console-drawer ${showLogs ? "expanded" : "collapsed"}`}>
              <div className="console-drawer-header" onClick={() => setShowLogs(!showLogs)}>
                <span className="console-drawer-title">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "4px" }}>
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  Dev Server Console Logs
                </span>
                <span className="console-drawer-toggle">
                  {showLogs ? "▼ Collapse" : "▲ Show Console"}
                </span>
              </div>
              {showLogs && (
                <div className="console-drawer-content">
                  {consoleLogs.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Awaiting server output...</div>
                  ) : (
                    consoleLogs.map((log, idx) => (
                      <pre key={idx} className="console-log-line">{log}</pre>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
