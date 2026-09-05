"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useIsMounted } from "@/lib/hooks";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastApi {
  success: (message: string, options?: Partial<Omit<Toast, "id" | "tone" | "message">>) => void;
  error: (message: string, options?: Partial<Omit<Toast, "id" | "tone" | "message">>) => void;
  info: (message: string, options?: Partial<Omit<Toast, "id" | "tone" | "message">>) => void;
  warning: (message: string, options?: Partial<Omit<Toast, "id" | "tone" | "message">>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

const TONE_STYLES: Record<ToastTone, { icon: React.ReactNode; accent: string }> = {
  success: { icon: <CheckCircle2 className="size-4 text-success" />, accent: "border-l-success" },
  error: { icon: <XCircle className="size-4 text-danger" />, accent: "border-l-danger" },
  warning: { icon: <AlertTriangle className="size-4 text-warning" />, accent: "border-l-warning" },
  info: { icon: <Info className="size-4 text-brand" />, accent: "border-l-brand" },
};

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mounted = useIsMounted();
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, message: string, options?: Partial<Toast>) => {
    const id = nextId.current++;
    const toast: Toast = {
      id,
      tone,
      message,
      // Errors stay long enough to actually be read and acted on.
      duration: options?.duration ?? (tone === "error" ? 8000 : 4000),
      description: options?.description,
      action: options?.action,
    };
    // Each toast owns its own timer. The previous implementation ran a single
    // interval that popped the *oldest* toast every 4s, so a burst of five
    // notifications took twenty seconds to clear and each one's visible
    // lifetime depended on how many came before it.
    setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), toast]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", m, o),
      info: (m, o) => push("info", m, o),
      warning: (m, o) => push("warning", m, o),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            // Assertive would interrupt a screen reader mid-sentence for a
            // "Saved" confirmation; polite queues it instead.
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
          >
            {toasts.map((toast) => (
              <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, paused, onDismiss]);

  const { icon, accent } = TONE_STYLES[toast.tone];

  return (
    <div
      role="status"
      // Hovering to read a message shouldn't race a timer.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border-strong border-l-2 bg-overlay p-3",
        "shadow-[var(--shadow-popover)] animate-slide-left",
        accent
      )}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug font-medium text-bright">{toast.message}</p>
        {toast.description && (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-1.5 text-[12px] font-medium text-brand hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="-m-1 shrink-0 rounded p-1 text-subtle transition-colors hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
