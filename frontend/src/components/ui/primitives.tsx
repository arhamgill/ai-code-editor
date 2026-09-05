"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { modKey } from "@/lib/utils";

/* ─────────────────────────── Spinner ─────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />;
}

/* ───────────────────────────── Kbd ───────────────────────────── */

/** Renders "Mod+K" with the platform's real modifier symbol. */
export function Kbd({ children, className }: { children: string; className?: string }) {
  const keys = children.replace(/\bMod\b/g, modKey()).split("+");
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border-strong bg-raised px-1 font-sans text-[10.5px] font-medium text-muted"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

/* ──────────────────────────── Badge ──────────────────────────── */

const BADGE_TONES = {
  neutral: "bg-raised text-muted border-border",
  brand: "bg-brand-subtle text-brand border-brand/25",
  success: "bg-success-subtle text-success border-success/25",
  warning: "bg-warning-subtle text-warning border-warning/25",
  danger: "bg-danger-subtle text-danger border-danger/25",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10.5px] font-medium tracking-wide",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────── Skeleton ────────────────────────── */

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton h-3 w-full", className)} style={style} aria-hidden />;
}

/* ────────────────────────── EmptyState ───────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-raised text-subtle">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[13.5px] font-medium text-bright">{title}</p>
        {description && (
          <p className="mx-auto max-w-[38ch] text-[12.5px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ──────────────────────────── Input ──────────────────────────── */

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-border-strong bg-canvas px-3 text-[13.5px] text-fg",
          "placeholder:text-subtle transition-colors",
          "hover:border-fg-subtle/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

/* ─────────────────────────── Switch ──────────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand" : "bg-active"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-3.5 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}

/* ───────────────────────── Segmented ─────────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-raised p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[6px] font-medium transition-colors duration-150",
              size === "xs" ? "h-[22px] px-2 text-[11px]" : "h-[26px] px-2.5 text-[12px]",
              selected
                ? "bg-overlay text-bright shadow-[var(--shadow-panel)]"
                : "text-muted hover:text-fg"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────── Progress (indeterminate) ─────────────── */

export function IndeterminateBar({ className }: { className?: string }) {
  return (
    <div className={cn("h-0.5 w-full overflow-hidden bg-border", className)} aria-hidden>
      <div
        className="h-full w-1/4 bg-brand"
        style={{ animation: "forge-progress 1.1s var(--ease-out-quint) infinite" }}
      />
    </div>
  );
}

/* ───────────────────────── TypingDots ─────────────────────────── */

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Assistant is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-subtle"
          style={{ animation: `forge-bounce-dot 1.2s ${i * 0.15}s infinite ease-in-out` }}
        />
      ))}
    </span>
  );
}
