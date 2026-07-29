"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "../types";

interface HistoryPanelProps {
  show: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  checkpoints: Record<number, Record<string, string>>;
  restoreCheckpoint: (msgIndex: number) => Promise<void>;
}

export function HistoryPanel({ show, onClose, messages, checkpoints, restoreCheckpoint }: HistoryPanelProps) {
  // Filter to assistant messages that modified files
  const historyEntries = messages
    .map((msg, idx) => ({ msg, idx }))
    .filter(
      ({ msg, idx }) =>
        msg.role === "assistant" &&
        checkpoints[idx] &&
        msg.events?.some((e) => e.type === "file_change")
    );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="modal-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="history-panel"
            onClick={(e) => e.stopPropagation()}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 360 }}
          >
            {/* Header */}
            <div className="history-header">
              <div className="history-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                AI Change History
              </div>
              <button className="diff-close-btn" onClick={onClose}>✕</button>
            </div>

            {/* Timeline */}
            <div className="history-body">
              {historyEntries.length === 0 ? (
                <div className="history-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <p>No AI file changes yet.</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Ask the AI to modify files to see restore points here.
                  </p>
                </div>
              ) : (
                <div className="history-timeline">
                  {historyEntries.map(({ msg, idx }, entryIdx) => {
                    const changedFiles = msg.events
                      ?.filter((e) => e.type === "file_change")
                      ?? [];

                    return (
                      <div key={idx} className="history-entry">
                        {/* Timeline line */}
                        <div className="history-entry-line">
                          <div className="history-entry-dot" />
                          {entryIdx < historyEntries.length - 1 && (
                            <div className="history-entry-connector" />
                          )}
                        </div>

                        {/* Entry content */}
                        <div className="history-entry-content">
                          <div className="history-entry-meta">
                            <span className="history-entry-label">AI Response #{entryIdx + 1}</span>
                            <button
                              className="restore-checkpoint-btn"
                              onClick={() => restoreCheckpoint(idx)}
                              title="Restore all files to this state"
                            >
                              ↩ Restore
                            </button>
                          </div>

                          {/* Summary of changes */}
                          <div className="history-entry-changes">
                            {changedFiles.map((evt, evtIdx) => (
                              <div key={evtIdx} className="history-change-pill">
                                <span
                                  style={{
                                    color:
                                      evt.action === "Created"
                                        ? "var(--color-success)"
                                        : evt.action === "Modified"
                                        ? "var(--text-primary)"
                                        : "var(--color-error)",
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {evt.action}
                                </span>
                                <span
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: "0.73rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: "160px",
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {evt.path?.split("/").pop()}
                                </span>
                                {evt.action !== "Deleted" &&
                                  ((evt.added ?? 0) > 0 || (evt.removed ?? 0) > 0) && (
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
                                      {(evt.added ?? 0) > 0 && (
                                        <span style={{ color: "var(--color-success)" }}>+{evt.added}</span>
                                      )}
                                      {(evt.removed ?? 0) > 0 && (
                                        <span style={{ color: "var(--color-error)" }}> -{evt.removed}</span>
                                      )}
                                    </span>
                                  )}
                              </div>
                            ))}
                          </div>

                          {/* First line of AI response preview */}
                          {msg.content && (
                            <p className="history-entry-preview">
                              {msg.content.replace(/```[\s\S]*?```/g, "[code block]").slice(0, 80)}
                              {msg.content.length > 80 ? "…" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
