/**
 * Line diff based on a real longest-common-subsequence, not set membership.
 *
 * The previous implementation compared `new Set(oldLines)` against
 * `new Set(newLines)`, which reports 0 changes whenever lines are merely
 * reordered or duplicated, and mis-counts any file with repeated lines
 * (closing braces, blank lines — i.e. every source file).
 */

const MAX_LCS_CELLS = 4_000_000; // ~2000x2000 lines before we fall back

function lcsLengths(a, b) {
  // Rolling two-row LCS table: O(n) memory instead of O(n*m).
  const m = b.length;
  let prev = new Uint32Array(m + 1);
  let curr = new Uint32Array(m + 1);
  const rows = [];

  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < m; j++) {
      curr[j + 1] = a[i] === b[j] ? prev[j] + 1 : Math.max(curr[j], prev[j + 1]);
    }
    rows.push(curr);
    prev = curr;
    curr = new Uint32Array(m + 1);
  }
  return rows;
}

/**
 * @returns {{added: number, removed: number}} counts of changed lines.
 */
export function lineDiffStats(oldContent, newContent) {
  if (oldContent === newContent) return { added: 0, removed: 0 };

  const a = oldContent ? oldContent.split("\n") : [];
  const b = newContent ? newContent.split("\n") : [];

  if (a.length === 0) return { added: b.length, removed: 0 };
  if (b.length === 0) return { added: 0, removed: a.length };

  // Trim the common prefix/suffix first — for a typical edit this reduces the
  // LCS problem to a handful of lines.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA + 1);
  const midB = b.slice(start, endB + 1);

  if (midA.length === 0) return { added: midB.length, removed: 0 };
  if (midB.length === 0) return { added: 0, removed: midA.length };

  // Guard against pathological inputs: report the coarse counts instead of
  // allocating gigabytes for a machine-generated file.
  if (midA.length * midB.length > MAX_LCS_CELLS) {
    return { added: midB.length, removed: midA.length };
  }

  const rows = lcsLengths(midA, midB);
  const common = rows[rows.length - 1][midB.length];

  return { added: midB.length - common, removed: midA.length - common };
}
