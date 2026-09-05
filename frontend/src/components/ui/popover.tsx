"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight anchored popover: closes on outside click, on Escape, and
 * restores focus to its trigger. Rendered inline (not portalled) so it inherits
 * the panel's stacking context — every use here is inside a bounded toolbar.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = "end",
  className,
  panelClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: { ref: React.Ref<HTMLButtonElement>; onClick: () => void }) => React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {trigger({ ref: triggerRef, onClick: () => onOpenChange(!open) })}
      {open && (
        <div
          role="dialog"
          className={cn(
            "absolute top-[calc(100%+6px)] z-40 min-w-[220px] rounded-lg border border-border-strong bg-overlay p-1",
            "shadow-[var(--shadow-popover)] animate-pop",
            align === "end" ? "right-0" : "left-0",
            panelClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function PopoverLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-subtle">
      {children}
    </div>
  );
}

export function PopoverItem({
  onClick,
  icon,
  children,
  hint,
  selected,
  danger,
  disabled,
}: {
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        danger ? "text-danger hover:bg-danger-subtle" : "text-fg hover:bg-hover",
        selected && "bg-brand-subtle text-brand"
      )}
    >
      {icon && <span className="shrink-0 text-subtle">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-subtle">{hint}</span>}
    </button>
  );
}

export function PopoverRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-2 py-1.5 text-[12.5px] text-fg">
      <span>{label}</span>
      {children}
    </div>
  );
}

export function PopoverSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
