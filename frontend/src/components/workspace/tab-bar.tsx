"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { useWorkspace } from "@/lib/store/workspace";
import { cn, dirName, fileName } from "@/lib/utils";
import { FileIcon } from "./file-icon";

/**
 * Open-file tabs.
 *
 * Scrolls horizontally rather than wrapping, keeps the active tab in view, and
 * disambiguates same-named files (three `page.tsx` tabs are otherwise
 * indistinguishable) by appending the parent folder.
 */
export function TabBar({ onClose }: { onClose: (path: string) => void }) {
  const tabs = useWorkspace((s) => s.tabs);
  const activePath = useWorkspace((s) => s.activePath);
  const activate = useWorkspace((s) => s.activate);

  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activePath]);

  if (tabs.length === 0) return null;

  // Only disambiguate names that actually collide.
  const nameCounts = tabs.reduce<Record<string, number>>((acc, tab) => {
    const name = fileName(tab.path);
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label="Open files"
      className="flex h-(--spacing-tabbar) shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface scrollbar-none"
    >
      {tabs.map((tab) => {
        const name = fileName(tab.path);
        const parent = fileName(dirName(tab.path));
        const isActive = tab.path === activePath;
        const isDirty = tab.draft !== tab.saved;

        return (
          <button
            key={tab.path}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            title={tab.path}
            onClick={() => activate(tab.path)}
            onAuxClick={(e) => {
              // Middle-click closes, matching every editor and browser.
              if (e.button === 1) {
                e.preventDefault();
                onClose(tab.path);
              }
            }}
            className={cn(
              "group/tab relative flex max-w-[220px] shrink-0 items-center gap-1.5 border-r border-border px-3",
              "text-[12.5px] transition-colors",
              isActive ? "bg-canvas text-bright" : "text-muted hover:bg-hover hover:text-fg"
            )}
          >
            {isActive && <span className="absolute inset-x-0 top-0 h-[1.5px] bg-brand" aria-hidden />}

            <FileIcon name={name} />
            <span className="truncate">{name}</span>
            {nameCounts[name] > 1 && parent && (
              <span className="shrink-0 truncate text-[11px] text-subtle">{parent}</span>
            )}

            <span
              // A fixed-width slot so the tab never resizes when the dot
              // swaps for the close button on hover.
              className="relative ml-0.5 flex size-4 shrink-0 items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.path);
              }}
              role="button"
              tabIndex={-1}
              aria-label={`Close ${name}`}
            >
              {isDirty ? (
                <>
                  <span
                    className="size-[7px] rounded-full bg-brand group-hover/tab:hidden"
                    title="Unsaved changes"
                  />
                  <X className="hidden size-3.5 rounded-[3px] text-muted hover:bg-active hover:text-fg group-hover/tab:block" />
                </>
              ) : (
                <X
                  className={cn(
                    "size-3.5 rounded-[3px] text-subtle transition-opacity hover:bg-active hover:text-fg",
                    isActive ? "opacity-60" : "opacity-0 group-hover/tab:opacity-60"
                  )}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
