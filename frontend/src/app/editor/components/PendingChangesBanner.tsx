"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface PendingChangeItem {
  path: string;
  action: "Created" | "Modified" | "Deleted" | string;
  added?: number;
  removed?: number;
}

interface PendingChangesBannerProps {
  changes: PendingChangeItem[];
  onAccept: () => void;
  onReject: () => void;
  onViewDiff: (filePath: string) => void;
}

export function PendingChangesBanner({
  changes,
  onAccept,
  onReject,
  onViewDiff,
}: PendingChangesBannerProps) {
  if (!changes || changes.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="pending-changes-banner"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.2 }}
      >
        <div className="banner-left">
          <div className="banner-badge">
            <span className="banner-pulse-dot" />
            AI Changes
          </div>
          <span className="banner-summary">
            The AI modified {changes.length} file{changes.length > 1 ? "s" : ""}:
          </span>

          <div className="banner-file-list">
            {changes.map((item, idx) => (
              <div
                key={idx}
                className="banner-file-chip"
                onClick={() => item.action === "Modified" && onViewDiff(item.path)}
                title={item.action === "Modified" ? "Click to view diff" : item.path}
              >
                <span
                  style={{
                    color:
                      item.action === "Created"
                        ? "var(--color-success)"
                        : item.action === "Modified"
                        ? "var(--text-primary)"
                        : "var(--color-error)",
                    fontWeight: 700,
                    fontSize: "0.68rem",
                    textTransform: "uppercase",
                  }}
                >
                  {item.action}
                </span>
                <span className="banner-file-name">{item.path.split("/").pop()}</span>
                {item.action !== "Deleted" && ((item.added ?? 0) > 0 || (item.removed ?? 0) > 0) && (
                  <span className="banner-file-diff">
                    {(item.added ?? 0) > 0 && <span style={{ color: "var(--color-success)" }}>+{item.added}</span>}
                    {(item.removed ?? 0) > 0 && <span style={{ color: "var(--color-error)" }}> -{item.removed}</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="banner-actions">
          <button
            className="btn btn-secondary banner-reject-btn"
            onClick={onReject}
            title="Revert all changes made in this AI step"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Reject &amp; Revert
          </button>

          <button
            className="btn btn-primary banner-accept-btn"
            onClick={onAccept}
            title="Keep these changes"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Accept Changes
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
