"use client";

import { useMemo, useState } from "react";
import { Columns2, Rows3 } from "lucide-react";

import { computeDiff, type DiffLine } from "@/lib/diff";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Segmented, Spinner } from "@/components/ui/primitives";

export interface DiffTarget {
  path: string;
  before: string;
  after: string;
  /** True while the "before" side is still being fetched. */
  loading?: boolean;
  /** Set when the previous content couldn't be recovered. */
  unavailable?: string;
}

export function DiffModal({
  target,
  onClose,
  onRevert,
}: {
  target: DiffTarget | null;
  onClose: () => void;
  onRevert?: (path: string, content: string) => void;
}) {
  const [layout, setLayout] = useState<"unified" | "split">("unified");

  const diff = useMemo(
    () => (target && !target.loading ? computeDiff(target.before, target.after) : null),
    [target]
  );

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      size="full"
      title={<span className="font-mono text-[13px]">{target?.path}</span>}
      description={
        diff
          ? diff.unchanged
            ? "No changes"
            : `${diff.added} added, ${diff.removed} removed${diff.approximate ? " (approximate — file is very large)" : ""}`
          : undefined
      }
      footer={
        <>
          <Segmented
            size="xs"
            value={layout}
            onChange={setLayout}
            options={[
              { value: "unified", label: <><Rows3 className="size-3" /> Unified</> },
              { value: "split", label: <><Columns2 className="size-3" /> Split</> },
            ]}
          />
          <div className="ml-auto flex gap-2">
            {onRevert && target && !target.loading && !target.unavailable && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onRevert(target.path, target.before);
                  onClose();
                }}
              >
                Revert this file
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      }
    >
      <div className="min-h-[240px]">
        {!target ? null : target.loading ? (
          <div className="flex h-60 items-center justify-center">
            <Spinner className="size-5 text-subtle" />
          </div>
        ) : target.unavailable ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">{target.unavailable}</p>
        ) : diff?.unchanged ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            These two versions are identical.
          </p>
        ) : layout === "split" ? (
          <SplitDiff hunks={diff!.hunks} />
        ) : (
          <UnifiedDiff hunks={diff!.hunks} />
        )}
      </div>
    </Modal>
  );
}

const LINE_STYLES: Record<DiffLine["kind"], string> = {
  add: "bg-added-bg",
  remove: "bg-removed-bg",
  context: "",
};

const SIGN: Record<DiffLine["kind"], string> = { add: "+", remove: "−", context: " " };

function UnifiedDiff({ hunks }: { hunks: { oldStart: number; newStart: number; lines: DiffLine[] }[] }) {
  return (
    <div className="overflow-x-auto font-mono text-[11.5px] leading-[1.55]">
      {hunks.map((hunk, index) => (
        <div key={index}>
          <div className="sticky top-0 z-10 border-y border-border bg-raised px-3 py-1 text-[10.5px] text-subtle">
            @@ −{hunk.oldStart} +{hunk.newStart} @@
          </div>
          {hunk.lines.map((line, i) => (
            <div key={i} className={cn("flex", LINE_STYLES[line.kind])}>
              <span className="w-11 shrink-0 select-none px-1 text-right text-subtle/60">
                {line.oldNumber ?? ""}
              </span>
              <span className="w-11 shrink-0 select-none px-1 text-right text-subtle/60">
                {line.newNumber ?? ""}
              </span>
              <span
                className={cn(
                  "w-4 shrink-0 select-none text-center",
                  line.kind === "add" ? "text-added" : line.kind === "remove" ? "text-removed" : "text-subtle/40"
                )}
              >
                {SIGN[line.kind]}
              </span>
              <span className="whitespace-pre pr-4 text-fg">{line.text || " "}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SplitDiff({ hunks }: { hunks: { oldStart: number; newStart: number; lines: DiffLine[] }[] }) {
  return (
    <div className="overflow-x-auto font-mono text-[11.5px] leading-[1.55]">
      {hunks.map((hunk, index) => (
        <div key={index}>
          <div className="sticky top-0 z-10 border-y border-border bg-raised px-3 py-1 text-[10.5px] text-subtle">
            @@ −{hunk.oldStart} +{hunk.newStart} @@
          </div>
          {pairLines(hunk.lines).map((pair, i) => (
            <div key={i} className="grid grid-cols-2 divide-x divide-border">
              <Side line={pair.left} side="left" />
              <Side line={pair.right} side="right" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Side({ line, side }: { line: DiffLine | null; side: "left" | "right" }) {
  if (!line) return <div className="bg-raised/40" />;

  return (
    <div className={cn("flex", LINE_STYLES[line.kind])}>
      <span className="w-11 shrink-0 select-none px-1 text-right text-subtle/60">
        {(side === "left" ? line.oldNumber : line.newNumber) ?? ""}
      </span>
      <span className="whitespace-pre pr-3 text-fg">{line.text || " "}</span>
    </div>
  );
}

/** Line up removals against the additions that replaced them. */
function pairLines(lines: DiffLine[]): { left: DiffLine | null; right: DiffLine | null }[] {
  const rows: { left: DiffLine | null; right: DiffLine | null }[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.kind === "context") {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }

    const removals: DiffLine[] = [];
    const additions: DiffLine[] = [];
    while (i < lines.length && lines[i].kind === "remove") removals.push(lines[i++]);
    while (i < lines.length && lines[i].kind === "add") additions.push(lines[i++]);

    const height = Math.max(removals.length, additions.length);
    for (let k = 0; k < height; k++) {
      rows.push({ left: removals[k] ?? null, right: additions[k] ?? null });
    }
  }

  return rows;
}
