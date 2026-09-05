"use client";

import { useSyncExternalStore } from "react";
import { CircleDot, Keyboard, WrapText } from "lucide-react";

import { usePreferences } from "@/lib/store/preferences";
import { useWorkspace } from "@/lib/store/workspace";
import { cn, formatBytes, languageForPath } from "@/lib/utils";
import { previewSession } from "@/lib/webcontainer";

export function StatusBar({
  cursor,
  selection,
  modelLabel,
  saving,
  onShowShortcuts,
}: {
  cursor: { line: number; column: number };
  selection: { characters: number; lines: number } | null;
  modelLabel: string;
  saving: boolean;
  onShowShortcuts: () => void;
}) {
  // Subscribed rather than read during render: the preview session lives
  // outside React, so a plain `getState()` in the body would go stale until
  // something unrelated re-rendered this bar.
  const previewStatus = useSyncExternalStore(
    previewSession.subscribe,
    () => previewSession.getState().status,
    () => "idle" as const
  );
  const previewRunning = previewStatus === "running";

  const activePath = useWorkspace((s) => s.activePath);
  const tabs = useWorkspace((s) => s.tabs);
  const wordWrap = usePreferences((s) => s.wordWrap);
  const toggle = usePreferences((s) => s.toggle);

  const tab = tabs.find((t) => t.path === activePath) ?? null;
  const dirtyCount = tabs.filter((t) => t.draft !== t.saved).length;

  return (
    <footer className="flex h-(--spacing-statusbar) shrink-0 items-center gap-3 border-t border-border bg-surface px-3 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5" title="Live preview status">
        <span
          className={cn(
            "size-1.5 rounded-full",
            previewRunning ? "bg-success" : "bg-subtle/60"
          )}
        />
        {previewRunning ? "Preview live" : "Preview idle"}
      </span>

      <span className="inline-flex items-center gap-1.5" title="Active AI model">
        <CircleDot className="size-3 text-brand" />
        {modelLabel}
      </span>

      {dirtyCount > 0 && (
        <span className="text-brand" title="Files with unsaved changes">
          {dirtyCount} unsaved
        </span>
      )}

      {saving && <span className="text-subtle">Saving…</span>}

      <div className="ml-auto flex items-center gap-3">
        {tab && !tab.isBinary && (
          <>
            {selection && selection.characters > 0 && (
              <span>
                {selection.characters} selected
                {selection.lines > 1 ? ` · ${selection.lines} lines` : ""}
              </span>
            )}

            <span className="tabular-nums" title="Cursor position">
              Ln {cursor.line}, Col {cursor.column}
            </span>

            <button
              type="button"
              onClick={() => toggle("wordWrap")}
              aria-pressed={wordWrap}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-hover hover:text-fg",
                wordWrap && "text-brand"
              )}
              title="Toggle word wrap"
            >
              <WrapText className="size-3" />
              {wordWrap ? "Wrap" : "No wrap"}
            </button>

            <span className="uppercase" title="Language">
              {languageForPath(tab.path)}
            </span>

            {tab.saved.length > 0 && <span title="File size">{formatBytes(tab.saved.length)}</span>}
          </>
        )}

        <button
          type="button"
          onClick={onShowShortcuts}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-hover hover:text-fg"
          title="Keyboard shortcuts"
        >
          <Keyboard className="size-3" />
        </button>
      </div>
    </footer>
  );
}
