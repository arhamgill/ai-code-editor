import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./logo";

/** Shared frame for the Clerk sign-in / sign-up pages. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,var(--color-brand-subtle),transparent_70%)]"
      />

      <Link
        href="/"
        className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <div className="relative flex w-full max-w-[400px] flex-col items-center">
        <Logo href="/" />
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-bright">{title}</h1>
        <p className="mt-2 max-w-[34ch] text-center text-[13.5px] leading-relaxed text-muted">
          {subtitle}
        </p>
        <div className="mt-7 w-full">{children}</div>
      </div>
    </div>
  );
}
