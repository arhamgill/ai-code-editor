"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useIsMounted } from "@/lib/hooks";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./button";
import { Input } from "./primitives";

/**
 * Modal with the accessibility behaviour the previous hand-rolled overlays
 * lacked entirely: focus is moved in on open, trapped while open, restored on
 * close, Escape dismisses, and the rest of the page is hidden from screen
 * readers via `aria-modal`.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const mounted = useIsMounted();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement;

    // Defer so the panel is in the DOM before we look for something to focus.
    const focusTimer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input:not([type=hidden]), textarea, button:not([aria-label='Close'])"
      );
      (target ?? panelRef.current)?.focus();
    }, 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([type=hidden]), select, [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const widths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[min(1100px,94vw)]",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl border border-border-strong bg-overlay",
          "shadow-[var(--shadow-modal)] animate-pop outline-none",
          widths[size],
          className
        )}
      >
        {(title || description) && (
          <header className="flex items-start gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="truncate text-[14px] font-semibold text-bright">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton label="Close" size="sm" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </header>
        )}

        {children && <div className="min-h-0 flex-1 overflow-auto">{children}</div>}

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-border bg-surface px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════ Promise-based prompt / confirm ══════════════════ */

interface PromptOptions {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  /** Return an error string to block submission. */
  validate?: (value: string) => string | null;
}

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Pending =
  | { kind: "prompt"; options: PromptOptions; resolve: (v: string | null) => void }
  | { kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void };

/**
 * Themed replacements for window.prompt / window.confirm.
 * Native dialogs block the event loop, cannot be styled, and are suppressed
 * entirely in some embedded contexts.
 */
export function useDialogs() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(options.defaultValue ?? "");
        setError(null);
        setPending({ kind: "prompt", options, resolve });
      }),
    []
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ kind: "confirm", options, resolve });
      }),
    []
  );

  const close = useCallback(() => {
    setPending((current) => {
      if (current?.kind === "prompt") current.resolve(null);
      if (current?.kind === "confirm") current.resolve(false);
      return null;
    });
  }, []);

  const submit = useCallback(() => {
    if (!pending) return;
    if (pending.kind === "confirm") {
      pending.resolve(true);
      setPending(null);
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      setError("This can't be empty.");
      return;
    }
    const validationError = pending.options.validate?.(trimmed) ?? null;
    if (validationError) {
      setError(validationError);
      return;
    }
    pending.resolve(trimmed);
    setPending(null);
  }, [pending, value]);

  const element = pending ? (
    <Modal
      open
      onClose={close}
      size="sm"
      title={pending.options.title}
      description={pending.options.description}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={close}>
            {pending.kind === "confirm" ? pending.options.cancelLabel ?? "Cancel" : "Cancel"}
          </Button>
          <Button
            size="sm"
            variant={pending.kind === "confirm" && pending.options.danger ? "danger" : "primary"}
            onClick={submit}
          >
            {pending.options.confirmLabel ?? (pending.kind === "confirm" ? "Confirm" : "Create")}
          </Button>
        </>
      }
    >
      {pending.kind === "prompt" && (
        <div className="space-y-1.5 px-4 py-4">
          <Input
            data-autofocus
            value={value}
            placeholder={pending.options.placeholder}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            aria-invalid={!!error}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  ) : null;

  return { prompt, confirm, dialogs: element };
}
