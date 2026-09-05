import { describe, it, expect } from "vitest";
import { computeDiff } from "./diff";

const flat = (before: string, after: string, context = 3) =>
  computeDiff(before, after, context).hunks.flatMap((h) => h.lines);

const render = (before: string, after: string, context = 3) =>
  flat(before, after, context).map(
    (l) => `${l.kind === "add" ? "+" : l.kind === "remove" ? "-" : " "}${l.text}`
  );

describe("computeDiff", () => {
  it("reports identical files as unchanged", () => {
    const result = computeDiff("a\nb", "a\nb");
    expect(result.unchanged).toBe(true);
    expect(result.hunks).toHaveLength(0);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("marks a single changed line", () => {
    const result = computeDiff("a\nb\nc", "a\nB\nc");
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(render("a\nb\nc", "a\nB\nc")).toEqual([" a", "-b", "+B", " c"]);
  });

  it("handles a pure insertion", () => {
    expect(render("a\nc", "a\nb\nc")).toEqual([" a", "+b", " c"]);
  });

  it("handles a pure deletion", () => {
    expect(render("a\nb\nc", "a\nc")).toEqual([" a", "-b", " c"]);
  });

  it("treats an empty original as all additions", () => {
    const result = computeDiff("", "a\nb");
    expect(result.added).toBe(2);
    expect(result.removed).toBe(0);
  });

  it("numbers lines against the correct side", () => {
    const lines = flat("a\nb\nc", "a\nB\nc");
    const removed = lines.find((l) => l.kind === "remove")!;
    const added = lines.find((l) => l.kind === "add")!;

    expect(removed.oldNumber).toBe(2);
    expect(removed.newNumber).toBeNull();
    expect(added.newNumber).toBe(2);
    expect(added.oldNumber).toBeNull();
  });

  /**
   * The regression this rewrite exists for. The old five-line-lookahead
   * heuristic reported a block moved further than that as a wholesale rewrite,
   * so the diff viewer routinely showed an entire file as changed.
   */
  it("does not report a far-moved block as a full rewrite", () => {
    const before = ["a", "b", "c", "d", "e", "f", "g", "h", "MOVED", "i", "j"].join("\n");
    const after = ["MOVED", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].join("\n");

    const result = computeDiff(before, after);
    // One line moved: at most one add and one remove, not eleven of each.
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
  });

  it("keeps a one-line edit in a large file to a small hunk", () => {
    const lines = Array.from({ length: 400 }, (_, i) => `line ${i}`);
    const before = lines.join("\n");
    const after = lines.with(200, "line CHANGED").join("\n");

    const result = computeDiff(before, after, 3);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    // 3 lines of context either side, plus the -/+ pair.
    expect(result.hunks).toHaveLength(1);
    expect(result.hunks[0].lines.length).toBeLessThanOrEqual(9);
  });

  it("splits distant edits into separate hunks", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`);
    const after = lines.with(10, "A").with(80, "B").join("\n");

    const result = computeDiff(lines.join("\n"), after, 2);
    expect(result.hunks).toHaveLength(2);
  });

  it("degrades gracefully instead of hanging on two huge unrelated files", () => {
    const a = Array.from({ length: 3000 }, (_, i) => `alpha ${i}`).join("\n");
    const b = Array.from({ length: 3000 }, (_, i) => `beta ${i}`).join("\n");

    const start = Date.now();
    const result = computeDiff(a, b);
    expect(Date.now() - start).toBeLessThan(4000);
    expect(result.added).toBe(3000);
    expect(result.removed).toBe(3000);
  });
});
