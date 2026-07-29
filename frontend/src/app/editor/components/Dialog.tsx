"use client";

import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type DialogState =
  | ({ kind: "prompt" } & PromptOptions)
  | ({ kind: "confirm" } & ConfirmOptions)
  | null;

/**
 * Promise-based replacement for window.prompt / window.confirm so the app never
 * drops out to jarring OS-level dialogs.
 *
 *   const name = await askText({ title: "New file" });
 *   const ok   = await askConfirm({ title: "Delete?", danger: true });
 *
 * Render the returned `dialog` element once, near the root of the page.
 */
export function useDialog() {
  const [state, setState] = useState<DialogState>(null);
  const [value, setValue] = useState("");
  const resolverRef = useRef<((v: never) => void) | null>(null);

  const settle = useCallback((result: string | boolean | null) => {
    const resolve = resolverRef.current as ((v: string | boolean | null) => void) | null;
    resolverRef.current = null;
    setState(null);
    resolve?.(result);
  }, []);

  const askText = useCallback((opts: PromptOptions) => {
    setValue(opts.defaultValue ?? "");
    setState({ kind: "prompt", ...opts });
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve as never;
    });
  }, []);

  const askConfirm = useCallback((opts: ConfirmOptions) => {
    setState({ kind: "confirm", ...opts });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve as never;
    });
  }, []);

  const onCancel = () => settle(state?.kind === "prompt" ? null : false);

  const onConfirm = () => {
    if (state?.kind === "prompt") {
      const trimmed = value.trim();
      if (!trimmed) return;
      settle(trimmed);
    } else {
      settle(true);
    }
  };

  const isDanger = state?.kind === "confirm" && state.danger;

  const dialog = (
    <AnimatePresence>
      {state && (
        <motion.div
          className="dialog-overlay"
          onClick={onCancel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <motion.div
            className="dialog-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={state.title}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", damping: 26, stiffness: 360 }}
          >
            <h3 className="dialog-title">{state.title}</h3>
            {state.message && <p className="dialog-message">{state.message}</p>}

            {state.kind === "prompt" && (
              <input
                type="text"
                className="dialog-input"
                autoFocus
                value={value}
                placeholder={state.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); onConfirm(); }
                  if (e.key === "Escape") { e.preventDefault(); onCancel(); }
                }}
              />
            )}

            <div className="dialog-actions">
              <button className="btn btn-secondary dialog-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                className={`dialog-btn ${isDanger ? "btn-danger" : "btn btn-primary"}`}
                onClick={onConfirm}
                autoFocus={state.kind === "confirm"}
                disabled={state.kind === "prompt" && !value.trim()}
              >
                {state.confirmLabel ?? (state.kind === "prompt" ? "Create" : "Confirm")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { askText, askConfirm, dialog };
}
