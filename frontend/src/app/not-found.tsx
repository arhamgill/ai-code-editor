import { LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/marketing/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas p-6 text-center">
      <Logo href="/" />
      <div>
        <p className="font-mono text-[13px] text-subtle">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-bright">
          Page not found
        </h1>
        <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
          The page you&apos;re after doesn&apos;t exist, or it moved.
        </p>
      </div>
      <LinkButton href="/projects" size="sm" variant="primary">
        Go to your projects
      </LinkButton>
    </div>
  );
}
