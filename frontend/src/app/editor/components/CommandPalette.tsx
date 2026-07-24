"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileNode, CommandAction } from "../types";

interface CommandPaletteProps {
  show: boolean;
  onClose: () => void;
  fileTree: FileNode[];
  openFile: (path: string) => void;
  actions: CommandAction[];
}

function getFlatFileList(nodes: FileNode[]): string[] {
  let list: string[] = [];
  nodes.forEach((node) => {
    if (node.type === "file") {
      list.push(node.path);
    } else if (node.children) {
      list = list.concat(getFlatFileList(node.children));
    }
  });
  return list;
}

export function CommandPalette({ show, onClose, fileTree, openFile, actions }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "files" | "actions">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const allFiles = getFlatFileList(fileTree);
  const lowerQuery = query.toLowerCase();

  const matchedFiles = allFiles
    .filter((p) => p.toLowerCase().includes(lowerQuery))
    .slice(0, 6);

  const matchedActions = actions
    .filter(
      (a) =>
        a.label.toLowerCase().includes(lowerQuery) ||
        (a.description ?? "").toLowerCase().includes(lowerQuery)
    )
    .slice(0, 6);

  // Reset on open
  useEffect(() => {
    if (show) {
      setQuery("");
      setMode("all");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="spotlight-overlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
      >
        <motion.div
          className="command-palette-modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.97, y: -10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.97, y: -10 }}
          transition={{ type: "spring", damping: 25, stiffness: 380 }}
        >
          {/* Search input */}
          <div className="command-palette-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              className="command-palette-input"
              placeholder="Search files or type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
            />
            <kbd className="command-palette-esc">esc</kbd>
          </div>

          {/* Mode tabs */}
          <div className="command-palette-tabs">
            {(["all", "files", "actions"] as const).map((m) => (
              <button
                key={m}
                className={`command-palette-tab ${mode === m ? "active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "all" ? "All" : m === "files" ? "Files" : "Actions"}
              </button>
            ))}
          </div>

          <div className="spotlight-results">
            {/* Files section */}
            {(mode === "all" || mode === "files") && matchedFiles.length > 0 && (
              <div className="command-section">
                {mode === "all" && (
                  <div className="command-section-label">Files</div>
                )}
                {matchedFiles.map((path) => (
                  <button
                    key={path}
                    className="spotlight-result-item"
                    onClick={() => { openFile(path); onClose(); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <span style={{ color: "var(--text-primary)" }}>{path.split("/").pop()}</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{path}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Actions section */}
            {(mode === "all" || mode === "actions") && matchedActions.length > 0 && (
              <div className="command-section">
                {mode === "all" && (
                  <div className="command-section-label">Actions</div>
                )}
                {matchedActions.map((action) => (
                  <button
                    key={action.id}
                    className="spotlight-result-item"
                    onClick={() => { action.action(); onClose(); }}
                  >
                    <span style={{ fontSize: "1rem", width: "16px", textAlign: "center" }}>{action.icon}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <span style={{ color: "var(--text-primary)" }}>{action.label}</span>
                      {action.description && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{action.description}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {matchedFiles.length === 0 && matchedActions.length === 0 && (
              <div className="spotlight-no-results">No results for &quot;{query}&quot;</div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
