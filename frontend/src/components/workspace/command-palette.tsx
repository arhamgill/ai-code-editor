"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMounted } from "@/lib/hooks";
import { createPortal } from "react-dom";
import { CornerDownLeft, File, Search } from "lucide-react";

import { cn, fileName, dirName, fuzzyFilter } from "@/lib/utils";
import { Kbd } from "@/components/ui/primitives";
import { FileIcon } from "./file-icon";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon: React.ReactNode;
  run: () => void;
  /** Hidden from the list when false. */
  enabled?: boolean;
}

type Row =
  | { kind: "command"; command: Command }
  | { kind: "file"; path: string };

/**
 * Command palette and fuzzy file finder in one surface.
 *
 * `mode="files"` (Mod+P) searches only files; `mode="all"` (Mod+K) puts
 * commands first and falls through to files. Both are scored by relevance
 * rather than the old `includes()` filter in tree order.
 */
interface PaletteProps {
  open: boolean;
  mode: "all" | "files";
  onClose: () => void;
  commands: Command[];
  files: string[];
  onOpenFile: (path: string) => void;
}

/**
 * Gate component.
 *
 * The panel's query and highlight live in `PaletteBody`, which is mounted only
 * while the palette is open and keyed by mode. Remounting resets that state for
 * free — the alternative, clearing it from an effect on `open`, costs a
 * cascading render every time the palette appears.
 */
export function CommandPalette(props: PaletteProps) {
  const mounted = useIsMounted();
  if (!mounted || !props.open) return null;
  return <PaletteBody key={props.mode} {...props} />;
}

function PaletteBody({ mode, onClose, commands, files, onOpenFile }: PaletteProps) {
  const [query, setQuery] = useState("");
  const [rawIndex, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<Row[]>(() => {
    const trimmed = query.trim();

    const fileRows: Row[] = fuzzyFilter(files, trimmed, (path) => path, mode === "files" ? 60 : 12).map(
      (path) => ({ kind: "file", path })
    );

    if (mode === "files") return fileRows;

    const available = commands.filter((command) => command.enabled !== false);
    const commandRows: Row[] = fuzzyFilter(available, trimmed, (c) => c.label, 20).map((command) => ({
      kind: "command",
      command,
    }));

    // With no query, commands alone are the useful view — a dump of every file
    // is noise. Once you type, files join in.
    return trimmed ? [...commandRows, ...fileRows] : commandRows;
  }, [query, mode, commands, files]);

  // Clamped on read rather than corrected from an effect, so the list can
  // shrink under the cursor without an extra render.
  const index = Math.min(rawIndex, Math.max(0, rows.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const choose = (row: Row) => {
    onClose();
    // Defer so the palette has unmounted before focus moves into the editor.
    window.setTimeout(() => {
      if (row.kind === "command") row.command.run();
      else onOpenFile(row.path);
    }, 0);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh] animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "files" ? "Go to file" : "Command palette"}
        className="relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border-strong bg-overlay shadow-[var(--shadow-modal)] animate-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5">
          <Search className="size-4 shrink-0 text-subtle" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => (i + 1) % Math.max(1, rows.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => (i - 1 + rows.length) % Math.max(1, rows.length));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (rows[index]) choose(rows[index]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder={mode === "files" ? "Go to file…" : "Type a command or search files…"}
            className="h-12 w-full bg-transparent text-[14px] text-fg placeholder:text-subtle focus:outline-none"
          />
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-subtle">
              No matches for &ldquo;{query}&rdquo;
            </p>
          ) : (
            rows.map((row, i) => {
              const selected = i === index;
              const key = row.kind === "command" ? row.command.id : `file:${row.path}`;

              return (
                <button
                  key={key}
                  data-index={i}
                  type="button"
                  onMouseMove={() => setIndex(i)}
                  onClick={() => choose(row)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    selected ? "bg-brand-subtle" : "hover:bg-hover"
                  )}
                >
                  {row.kind === "command" ? (
                    <>
                      <span className={cn("shrink-0", selected ? "text-brand" : "text-subtle")}>
                        {row.command.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-[13px]",
                            selected ? "text-brand" : "text-fg"
                          )}
                        >
                          {row.command.label}
                        </span>
                        {row.command.hint && (
                          <span className="block truncate text-[11.5px] text-subtle">
                            {row.command.hint}
                          </span>
                        )}
                      </span>
                      {row.command.shortcut && <Kbd>{row.command.shortcut}</Kbd>}
                    </>
                  ) : (
                    <>
                      <FileIcon name={fileName(row.path)} />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-[13px]",
                            selected ? "text-brand" : "text-fg"
                          )}
                        >
                          {fileName(row.path)}
                        </span>
                        {dirName(row.path) && (
                          <span className="block truncate font-mono text-[11px] text-subtle">
                            {dirName(row.path)}
                          </span>
                        )}
                      </span>
                      <File className="size-3 shrink-0 text-subtle/50" aria-hidden />
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-surface px-3 py-1.5 text-[11px] text-subtle">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="size-3" /> select
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
