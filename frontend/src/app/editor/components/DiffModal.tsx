"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DiffModalProps {
  show: boolean;
  onClose: () => void;
  filePath: string;
  before: string;
  after: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNum: number;
}

function computeDiff(before: string, after: string): DiffLine[] {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");

  // Simple LCS-based diff
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const result: DiffLine[] = [];
  let lineNum = 1;

  // Removed lines (in old but not new)
  for (const line of oldLines) {
    if (!newSet.has(line)) {
      result.push({ type: "removed", content: line, lineNum: lineNum++ });
    }
  }

  // All new lines with status
  lineNum = 1;
  const finalResult: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  // Use a simple sequential diff approach
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldIdx >= oldLines.length) {
      finalResult.push({ type: "added", content: newLine, lineNum: newIdx + 1 });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      finalResult.push({ type: "removed", content: oldLine, lineNum: oldIdx + 1 });
      oldIdx++;
    } else if (oldLine === newLine) {
      finalResult.push({ type: "unchanged", content: newLine, lineNum: newIdx + 1 });
      oldIdx++;
      newIdx++;
    } else {
      // Check if old line appears later in new lines (deletion)
      const newLookAhead = newLines.slice(newIdx, newIdx + 5).indexOf(oldLine);
      const oldLookAhead = oldLines.slice(oldIdx, oldIdx + 5).indexOf(newLine);

      if (newLookAhead === -1 || (oldLookAhead !== -1 && oldLookAhead <= newLookAhead)) {
        // old line was deleted
        finalResult.push({ type: "removed", content: oldLine, lineNum: oldIdx + 1 });
        oldIdx++;
      } else {
        // new line was added
        finalResult.push({ type: "added", content: newLine, lineNum: newIdx + 1 });
        newIdx++;
      }
    }
  }

  return finalResult;
}

export function DiffModal({ show, onClose, filePath, before, after }: DiffModalProps) {
  const diff = useMemo(() => computeDiff(before, after), [before, after]);

  const added = diff.filter((l) => l.type === "added").length;
  const removed = diff.filter((l) => l.type === "removed").length;

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
            className="diff-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 360 }}
          >
            {/* Header */}
            <div className="diff-modal-header">
              <div className="diff-modal-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                  {filePath}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                  {added > 0 && <span style={{ color: "var(--color-success)" }}>+{added} </span>}
                  {removed > 0 && <span style={{ color: "var(--color-error)" }}>-{removed}</span>}
                </span>
                <button className="diff-close-btn" onClick={onClose}>✕</button>
              </div>
            </div>

            {/* Diff body */}
            <div className="diff-body">
              {diff.length === 0 ? (
                <div className="diff-empty">No changes detected.</div>
              ) : (
                <pre className="diff-pre">
                  {diff.map((line, idx) => (
                    <div
                      key={idx}
                      className={`diff-line diff-line-${line.type}`}
                    >
                      <span className="diff-line-prefix">
                        {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                      </span>
                      <span className="diff-line-num">{line.lineNum}</span>
                      <span className="diff-line-content">{line.content || " "}</span>
                    </div>
                  ))}
                </pre>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
