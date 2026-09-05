"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Monitor,
  Play,
  RotateCw,
  Smartphone,
  Square,
  Tablet,
  Terminal,
  X,
} from "lucide-react";

import type { ForgeApi } from "@/lib/api";
import { previewSession, previewSupport, type PreviewState } from "@/lib/webcontainer";
import { useWorkspace } from "@/lib/store/workspace";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState, IndeterminateBar, Segmented } from "@/components/ui/primitives";

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTH: Record<Viewport, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
};

const BUSY: PreviewState["status"][] = ["booting", "mounting", "installing", "starting"];

export function PreviewPane({
  projectId,
  api,
  onClose,
}: {
  projectId: string;
  api: ForgeApi;
  onClose: () => void;
}) {
  const state = useSyncExternalStore(
    previewSession.subscribe,
    previewSession.getState,
    previewSession.getState
  );

  const tabs = useWorkspace((s) => s.tabs);
  const tree = useWorkspace((s) => s.tree);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  // `null` means "follow the status" — an error opens the console on its own,
  // but an explicit collapse or expand wins from then on.
  const [consoleOverride, setConsoleOverride] = useState<boolean | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const consoleOpen = consoleOverride ?? state.status === "error";

  const support = previewSupport();
  const busy = BUSY.includes(state.status);
  const running = state.status === "running";

  const start = useCallback(() => {
    const drafts = Object.fromEntries(
      tabs.filter((tab) => !tab.isBinary).map((tab) => [tab.path, tab.draft])
    );
    previewSession.run({ projectId, tree, drafts, api });
  }, [projectId, tree, tabs, api]);

  const reload = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame || !state.url) return;
    // Reassigning src is the only reliable reload for a cross-origin frame we
    // cannot reach into. Cache-bust so the browser refetches rather than
    // restoring the same document from memory.
    const url = `${state.url}${state.url.includes("?") ? "&" : "?"}__forge=${Date.now()}`;
    frame.setAttribute("src", url);
  }, [state.url]);

  // Point the frame at the server once it's ready, including when reopening a
  // panel whose server was already warm.
  //
  // The comparison uses getAttribute, not `frame.src`: the property returns the
  // *resolved* URL (with a trailing slash), so comparing it against the raw
  // value never matched and every effect run reassigned `src`, aborting the
  // in-flight load and leaving the panel blank.
  useEffect(() => {
    if (!running || !state.url) return;
    const frame = iframeRef.current;
    if (frame && frame.getAttribute("src") !== state.url) frame.src = state.url;
  }, [running, state.url]);

  useEffect(() => {
    if (consoleOpen) logEndRef.current?.scrollIntoView({ block: "end" });
  }, [state.logs, consoleOpen]);

  const width = VIEWPORT_WIDTH[viewport];

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface">
      {/* Header */}
      <div className="flex h-(--spacing-titlebar) shrink-0 items-center gap-1.5 border-b border-border px-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
          Preview
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {running && (
            <Segmented<Viewport>
              size="xs"
              value={viewport}
              onChange={setViewport}
              options={[
                { value: "desktop", label: <Monitor className="size-3" />, title: "Desktop width" },
                { value: "tablet", label: <Tablet className="size-3" />, title: "Tablet — 768px" },
                { value: "mobile", label: <Smartphone className="size-3" />, title: "Mobile — 390px" },
              ]}
            />
          )}

          {state.status === "idle" || state.status === "error" ? (
            <Button
              size="xs"
              variant="primary"
              icon={<Play className="size-3 fill-current" />}
              onClick={start}
              disabled={!support.supported}
            >
              Run
            </Button>
          ) : (
            <Button
              size="xs"
              variant="secondary"
              icon={<Square className="size-2.5 fill-current" />}
              onClick={() => previewSession.stop()}
            >
              Stop
            </Button>
          )}

          {running && (
            <>
              <IconButton label="Reload preview" size="xs" onClick={reload}>
                <RotateCw className="size-3.5" />
              </IconButton>
              <IconButton
                label="Open preview in a new tab"
                size="xs"
                onClick={() => state.url && window.open(state.url, "_blank", "noopener")}
              >
                <ExternalLink className="size-3.5" />
              </IconButton>
            </>
          )}

          <IconButton label="Close preview" size="xs" onClick={onClose}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>

      {/* URL / status bar */}
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border bg-canvas px-2.5">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            running ? "bg-success" : state.status === "error" ? "bg-danger" : busy ? "bg-warning" : "bg-subtle"
          )}
          aria-hidden
        />
        <span className="truncate font-mono text-[11px] text-muted" title={state.message}>
          {state.message}
        </span>
        {state.progress !== null && (
          <span className="ml-auto shrink-0 font-mono text-[10.5px] text-subtle">
            {Math.round(state.progress * 100)}%
          </span>
        )}
      </div>
      {busy && <IndeterminateBar />}

      {/* Body */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-canvas">
        {!support.supported ? (
          <EmptyState
            className="h-full"
            icon={<AlertTriangle className="size-5 text-warning" />}
            title="Preview isn't available in this browser"
            description={support.reason}
          />
        ) : state.status === "idle" ? (
          <EmptyState
            className="h-full"
            icon={<Play className="size-5" />}
            title="Run your app in the browser"
            description="Forge boots a Node runtime in this tab, installs your dependencies and starts next dev. The first run takes a minute; after that it stays warm."
            action={
              <Button size="sm" variant="primary" icon={<Play className="size-3 fill-current" />} onClick={start}>
                Run dev server
              </Button>
            }
          />
        ) : state.status === "error" ? (
          <EmptyState
            className="h-full"
            icon={<AlertTriangle className="size-5 text-danger" />}
            title="The preview couldn't start"
            description={state.error}
            action={
              <Button size="sm" variant="secondary" onClick={start}>
                Try again
              </Button>
            }
          />
        ) : busy ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="h-1 w-40 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${Math.max(8, (state.progress ?? 0.35) * 100)}%` }}
              />
            </div>
            <p className="text-[13px] font-medium text-fg">{state.message}</p>
            <p className="max-w-[34ch] text-[12px] leading-relaxed text-muted">
              You can keep editing and chatting while this finishes.
            </p>
          </div>
        ) : null}

        {/* Kept mounted so reopening the panel doesn't reload the app. */}
        <div
          className={cn(
            "absolute inset-0 flex justify-center overflow-auto bg-white",
            running ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <iframe
            ref={iframeRef}
            title="App preview"
            className="h-full border-0 bg-white transition-[width] duration-200"
            style={{ width: width ? `${width}px` : "100%", maxWidth: "100%" }}
            allow="cross-origin-isolated; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
      </div>

      {/* Console */}
      {state.status !== "idle" && (
        <div className="shrink-0 border-t border-border">
          <button
            type="button"
            onClick={() => setConsoleOverride(!consoleOpen)}
            aria-expanded={consoleOpen}
            className="flex h-7 w-full items-center gap-1.5 px-2.5 text-[11px] text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <Terminal className="size-3" />
            <span className="font-medium">Console</span>
            {state.logs.length > 0 && (
              <span className="font-mono text-[10px] text-subtle">{state.logs.length}</span>
            )}
            <ChevronDown
              className={cn("ml-auto size-3 transition-transform", consoleOpen && "rotate-180")}
            />
          </button>

          {consoleOpen && (
            <div className="max-h-52 overflow-y-auto border-t border-border bg-canvas px-2.5 py-2">
              {state.logs.length === 0 ? (
                <p className="py-2 text-center text-[11px] italic text-subtle">
                  Waiting for output…
                </p>
              ) : (
                <>
                  {state.logs.map((line) => (
                    <pre
                      key={line.id}
                      className={cn(
                        "whitespace-pre-wrap break-all font-mono text-[10.5px] leading-[1.5]",
                        line.level === "error" ? "text-danger" : "text-muted"
                      )}
                    >
                      {line.text}
                    </pre>
                  ))}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
