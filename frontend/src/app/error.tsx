"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Without one, a throw anywhere in the tree — Monaco
 * failing to load, a WebContainer boot error — leaves the user staring at a
 * blank white page with no way forward.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[forge] unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-danger/30 bg-danger-subtle text-danger">
          <AlertTriangle className="size-5" />
        </div>

        <h1 className="mt-4 text-lg font-semibold text-bright">Something broke</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          An unexpected error stopped the page from rendering. Your files are safe — nothing is
          saved from the browser without an explicit action.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11.5px] text-subtle">Reference: {error.digest}</p>
        )}

        <div className="mt-6 flex justify-center gap-2">
          <Button size="sm" variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button size="sm" variant="secondary" onClick={() => (window.location.href = "/projects")}>
            Back to projects
          </Button>
        </div>
      </div>
    </div>
  );
}
