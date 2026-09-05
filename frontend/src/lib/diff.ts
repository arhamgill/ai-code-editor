export type DiffKind = "add" | "remove" | "context";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** 1-based line number in the original file, null for added lines. */
  oldNumber: number | null;
  /** 1-based line number in the new file, null for removed lines. */
  newNumber: number | null;
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  added: number;
  removed: number;
  /** True when the files are identical. */
  unchanged: boolean;
  /** True when the diff was too large to compute exactly. */
  approximate: boolean;
}

const MAX_LCS_CELLS = 4_000_000;

/**
 * Myers-style diff via a rolling LCS table.
 *
 * The previous implementation guessed with a five-line lookahead, so any edit
 * that moved a block further than that produced a diff full of phantom
 * add/remove pairs — the "view diff" panel routinely showed an entire file as
 * rewritten when one line had changed.
 */
function diffLines(a: string[], b: string[]): DiffLine[] {
  const out: DiffLine[] = [];

  // Common prefix and suffix are context by definition; trimming them keeps
  // the quadratic step small for the edits people actually make.
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }

  for (let i = 0; i < prefix; i++) {
    out.push({ kind: "context", text: a[i], oldNumber: i + 1, newNumber: i + 1 });
  }

  const midA = a.slice(prefix, a.length - suffix);
  const midB = b.slice(prefix, b.length - suffix);

  if (midA.length * midB.length > MAX_LCS_CELLS) {
    // Fall back to a block replacement rather than freezing the tab.
    midA.forEach((text, i) =>
      out.push({ kind: "remove", text, oldNumber: prefix + i + 1, newNumber: null })
    );
    midB.forEach((text, i) =>
      out.push({ kind: "add", text, oldNumber: null, newNumber: prefix + i + 1 })
    );
  } else if (midA.length === 0) {
    midB.forEach((text, i) =>
      out.push({ kind: "add", text, oldNumber: null, newNumber: prefix + i + 1 })
    );
  } else if (midB.length === 0) {
    midA.forEach((text, i) =>
      out.push({ kind: "remove", text, oldNumber: prefix + i + 1, newNumber: null })
    );
  } else {
    // Full LCS table over the changed middle, then walk it back.
    const n = midA.length;
    const m = midB.length;
    const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i][j] =
          midA[i] === midB[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        out.push({
          kind: "context",
          text: midA[i],
          oldNumber: prefix + i + 1,
          newNumber: prefix + j + 1,
        });
        i++;
        j++;
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        out.push({ kind: "remove", text: midA[i], oldNumber: prefix + i + 1, newNumber: null });
        i++;
      } else {
        out.push({ kind: "add", text: midB[j], oldNumber: null, newNumber: prefix + j + 1 });
        j++;
      }
    }
    while (i < n) {
      out.push({ kind: "remove", text: midA[i], oldNumber: prefix + i + 1, newNumber: null });
      i++;
    }
    while (j < m) {
      out.push({ kind: "add", text: midB[j], oldNumber: null, newNumber: prefix + j + 1 });
      j++;
    }
  }

  for (let k = 0; k < suffix; k++) {
    const oldIdx = a.length - suffix + k;
    const newIdx = b.length - suffix + k;
    out.push({
      kind: "context",
      text: a[oldIdx],
      oldNumber: oldIdx + 1,
      newNumber: newIdx + 1,
    });
  }

  return out;
}

/**
 * Group changed lines into hunks with `context` lines of surrounding code, so
 * a one-line change in a 900-line file renders as a few lines, not 900.
 */
export function computeDiff(before: string, after: string, context = 3): DiffResult {
  if (before === after) {
    return { hunks: [], added: 0, removed: 0, unchanged: true, approximate: false };
  }

  const a = before.length ? before.split("\n") : [];
  const b = after.length ? after.split("\n") : [];
  const approximate = a.length * b.length > MAX_LCS_CELLS;

  const lines = diffLines(a, b);
  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "remove").length;

  // Mark every line within `context` of a change as worth keeping.
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, i) => {
    if (line.kind === "context") return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) {
      keep[k] = true;
    }
  });

  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;

  lines.forEach((line, i) => {
    if (!keep[i]) {
      current = null;
      return;
    }
    if (!current) {
      current = {
        oldStart: line.oldNumber ?? current_oldStart(lines, i),
        newStart: line.newNumber ?? current_newStart(lines, i),
        lines: [],
      };
      hunks.push(current);
    }
    current.lines.push(line);
  });

  return { hunks, added, removed, unchanged: false, approximate };
}

/** Nearest known old-file line number at or after `index`, for hunk headers. */
function current_oldStart(lines: DiffLine[], index: number): number {
  for (let i = index; i < lines.length; i++) {
    if (lines[i].oldNumber !== null) return lines[i].oldNumber!;
  }
  return 1;
}

function current_newStart(lines: DiffLine[], index: number): number {
  for (let i = index; i < lines.length; i++) {
    if (lines[i].newNumber !== null) return lines[i].newNumber!;
  }
  return 1;
}
