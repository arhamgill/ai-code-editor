"use client";

import { AlertTriangle } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";

/**
 * Shown while Clerk resolves the session — and, crucially, when it never does.
 *
 * `useAuth().isLoaded` stays `false` indefinitely if clerk.accounts.dev can't
 * be reached. A bare spinner behind that check leaves the page hanging with no
 * explanation and no way out, so past a few seconds this says what went wrong
 * and offers a route forward.
 */
export function AuthPending({ timedOut }: { timedOut: boolean }) {
  if (!timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="size-5 text-muted" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-warning/30 bg-warning-subtle text-warning">
          <AlertTriangle className="size-5" />
        </div>

        <h1 className="mt-4 text-lg font-semibold text-bright">Can&apos;t reach the sign-in service</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Forge uses Clerk for authentication, and its script didn&apos;t load. That&apos;s usually a
          network issue, an ad blocker, or a browser extension blocking{" "}
          <code className="rounded bg-raised px-1 py-px font-mono text-[12px] text-fg">
            clerk.accounts.dev
          </code>
          .
        </p>

        <div className="mt-6 flex justify-center gap-2">
          <Button size="sm" variant="primary" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <LinkButton href="/" size="sm" variant="secondary">
            Back to home
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
