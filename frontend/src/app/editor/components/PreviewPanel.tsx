"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Project, FileNode } from "../types";
import { previewSession, PreviewSessionState } from "../utils/webcontainerSession";

interface PreviewPanelProps {
  show: boolean;
  onClose: () => void;
  activeProject: Project | null;
  fileTree: FileNode[];
  tabContents: Record<string, string>;
  previewWidth: number;
  handlePreviewMouseDown: (e: React.MouseEvent) => void;
  getToken: () => Promise<string | null>;
}

const isLoading = (s: PreviewSessionState["status"]) =>
  s === "booting" || s === "mounting" || s === "installing" || s === "starting";

export function PreviewPanel({
  show,
  onClose,
  activeProject,
  fileTree,
  tabContents,
  previewWidth,
  handlePreviewMouseDown,
  getToken,
}: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [session, setSession] = useState<PreviewSessionState>(previewSession.getState());
  const [showLogs, setShowLogs] = useState(true);

  // Subscribe to the persistent module-level session.
  useEffect(() => {
    setSession(previewSession.getState());
    return previewSession.subscribe(setSession);
  }, []);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const handleRun = useCallback(() => {
    if (!activeProject) return;
    previewSession.run({ projectId: activeProject.id, fileTree, tabContents, getToken, apiBase: API });
  }, [activeProject, fileTree, tabContents, getToken, API]);

  const handleStop = useCallback(() => {
    previewSession.stop();
    if (iframeRef.current) iframeRef.current.src = "about:blank";
  }, []);

  const handleReload = useCallback(() => {
    if (iframeRef.current && session.serverUrl) {
      const url = session.serverUrl;
      iframeRef.current.src = "about:blank";
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = url;
      }, 50);
    }
  }, [session.serverUrl]);

  // Nudge the iframe once the dev server URL is ready (or when reopening a
  // panel whose server is already running) so it paints the warm server.
  useEffect(() => {
    if (session.status === "running" && session.serverUrl && show) {
      const url = session.serverUrl;
      const t = setTimeout(() => {
        if (iframeRef.current && iframeRef.current.src !== url) iframeRef.current.src = url;
      }, 300);
      return () => clearTimeout(t);
    }
  }, [session.status, session.serverUrl, show]);

  // NOTE: intentionally no teardown on unmount — the dev server must survive
  // the panel closing. Teardown happens on project switch / workspace close.

  const running = session.status === "running";
  const loading = isLoading(session.status);

  return (
    // display:contents keeps the panel mounted (and the iframe alive) while
    // hidden, so reopening is instant.
    <div style={{ display: show ? "contents" : "none" }}>
      {/* Drag resize divider */}
      <div className="resize-divider" onMouseDown={handlePreviewMouseDown} />

      <aside className="preview-panel" style={{ width: previewWidth, minWidth: 280 }}>
        {/* Header */}
        <div className="preview-header">
          <div className="preview-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Preview
          </div>

          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", marginLeft: "auto" }}>
            {session.status === "idle" || session.status === "error" ? (
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
                disabled={loading}
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", display: "flex", gap: "0.3rem", alignItems: "center" }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                Stop
              </button>
            )}
            {running && (
              <button className="sidebar-action-btn" onClick={handleReload} title="Reload preview" style={{ padding: "0.3rem" }}>
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
          <span className="preview-url-text" title={session.statusText}>
            {loading && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite", marginRight: "4px" }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
            {session.statusText}
          </span>
        </div>

        {/* Preview body */}
        <div className="preview-body">
          {session.status === "idle" && (
            <div className="preview-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", maxWidth: "240px" }}>
                Click Run to boot the WebContainer and start the Next.js dev server. The
                first install takes a moment; after that, reopening is instant.
              </p>
            </div>
          )}

          {loading && (
            <div className="preview-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <p style={{ fontSize: "0.85rem" }}>{session.statusText}</p>
            </div>
          )}

          {session.status === "error" && (
            <div className="preview-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p style={{ color: "#f87171", fontSize: "0.82rem", textAlign: "center", maxWidth: "240px" }}>
                {session.errorMsg ?? "Preview failed"}
              </p>
              <button className="btn btn-secondary" onClick={handleRun} style={{ fontSize: "0.75rem", padding: "0.35rem 0.8rem" }}>
                Retry
              </button>
            </div>
          )}

          {/* The iframe (kept mounted so reopening stays instant) */}
          <iframe
            ref={iframeRef}
            className="preview-iframe"
            src={session.serverUrl ?? undefined}
            style={{ display: running ? "block" : "none" }}
            allow="cross-origin-isolated"
            title="Live Preview"
          />

          {/* Collapsible Console Drawer */}
          {session.status !== "idle" && (
            <div className={`preview-console-drawer ${showLogs ? "expanded" : "collapsed"}`}>
              <div className="console-drawer-header" onClick={() => setShowLogs(!showLogs)}>
                <span className="console-drawer-title">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "4px" }}>
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  Dev Server Console
                </span>
                <span className="console-drawer-toggle">{showLogs ? "▼ Collapse" : "▲ Show Console"}</span>
              </div>
              {showLogs && (
                <div className="console-drawer-content">
                  {session.logs.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Awaiting server output...</div>
                  ) : (
                    session.logs.map((log, idx) => (
                      <pre key={idx} className="console-log-line">{log}</pre>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
