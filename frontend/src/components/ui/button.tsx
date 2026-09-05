"use client";

import { forwardRef } from "react";
import NextLink from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "xs" | "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-fg hover:bg-brand-hover shadow-sm disabled:hover:bg-brand",
  secondary:
    "bg-raised text-fg border border-border-strong hover:bg-hover hover:border-fg-subtle/40 disabled:hover:bg-raised",
  ghost: "text-muted hover:text-bright hover:bg-hover disabled:hover:bg-transparent",
  subtle: "bg-brand-subtle text-brand hover:bg-brand/20 disabled:hover:bg-brand-subtle",
  danger:
    "bg-danger text-white hover:brightness-110 shadow-sm disabled:hover:brightness-100",
};

const SIZES: Record<Size, string> = {
  xs: "h-6 px-2 text-[11px] gap-1 rounded-[5px]",
  sm: "h-7.5 px-2.5 text-[12.5px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-[13.5px] gap-2 rounded-md",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Rendered before the label; hidden while `loading`. */
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading, icon, iconRight, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      // Loading is a disabled state too — otherwise a double click fires the
      // action twice while the first request is still in flight.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,opacity,transform] duration-150",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
});

/**
 * A link that looks like a button.
 *
 * Wrapping a `<Button>` in a `<Link>` nests a `<button>` inside an `<a>`,
 * which is invalid HTML — browsers do not reliably navigate on click, and
 * assistive tech announces two overlapping controls. This renders a single
 * `<a>` carrying the button styles instead.
 */
export interface LinkButtonProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  { className, href, variant = "secondary", size = "md", icon, iconRight, children, ...props },
  ref
) {
  return (
    <NextLink
      ref={ref}
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,opacity,transform] duration-150",
        "active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
      {iconRight}
    </NextLink>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon-only controls are invisible to screen readers without it. */
  label: string;
  variant?: Variant;
  size?: "xs" | "sm" | "md";
  active?: boolean;
}

const ICON_SIZES = { xs: "size-6 rounded-[5px]", sm: "size-7 rounded-md", md: "size-8 rounded-md" };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, variant = "ghost", size = "sm", active, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors duration-150",
        "active:scale-95 disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        ICON_SIZES[size],
        active && "bg-active text-bright",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
