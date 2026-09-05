import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-[8px]",
        "bg-gradient-to-br from-brand to-brand/60 text-brand-fg",
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4" strokeWidth={2.6} stroke="currentColor">
        <path d="M14.5 3 6 13.2h5.2L9.5 21 18 10.8h-5.2L14.5 3Z" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string | null; className?: string }) {
  const content = (
    <>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-bright">Forge</span>
    </>
  );

  const classes = cn("inline-flex items-center gap-2", className);

  if (!href) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={cn(classes, "rounded-md transition-opacity hover:opacity-80")}>
      {content}
    </Link>
  );
}
