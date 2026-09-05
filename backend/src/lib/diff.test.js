import { describe, it, expect } from "vitest";
import { lineDiffStats } from "./diff.js";

describe("lineDiffStats", () => {
  it("reports nothing for identical content", () => {
    expect(lineDiffStats("a\nb\nc", "a\nb\nc")).toEqual({ added: 0, removed: 0 });
  });

  it("counts a pure insertion", () => {
    expect(lineDiffStats("a\nc", "a\nb\nc")).toEqual({ added: 1, removed: 0 });
  });

  it("counts a pure deletion", () => {
    expect(lineDiffStats("a\nb\nc", "a\nc")).toEqual({ added: 0, removed: 1 });
  });

  it("counts a replacement as one added and one removed", () => {
    expect(lineDiffStats("a\nb\nc", "a\nB\nc")).toEqual({ added: 1, removed: 1 });
  });

  it("treats an empty original as all-added", () => {
    expect(lineDiffStats("", "a\nb")).toEqual({ added: 2, removed: 0 });
  });

  it("treats an empty replacement as all-removed", () => {
    expect(lineDiffStats("a\nb", "")).toEqual({ added: 0, removed: 2 });
  });

  // The set-based implementation this replaced returned {0,0} here, because
  // both sides contain exactly the same *distinct* lines.
  it("detects a reorder that set membership misses", () => {
    const stats = lineDiffStats("a\nb\nc", "c\nb\na");
    expect(stats.added).toBeGreaterThan(0);
    expect(stats.removed).toBeGreaterThan(0);
  });

  // Real source files are full of repeated lines like "}" and "".
  it("counts duplicate lines correctly", () => {
    expect(lineDiffStats("}\n}\n}", "}\n}")).toEqual({ added: 0, removed: 1 });
    expect(lineDiffStats("}\n}", "}\n}\n}")).toEqual({ added: 1, removed: 0 });
  });

  it("handles a realistic single-line edit in a large file", () => {
    const lines = Array.from({ length: 500 }, (_, i) => `const v${i} = ${i};`);
    const before = lines.join("\n");
    const after = lines.with(250, "const v250 = 999;").join("\n");
    expect(lineDiffStats(before, after)).toEqual({ added: 1, removed: 1 });
  });

  it("stays fast on large unrelated files instead of allocating a huge table", () => {
    const a = Array.from({ length: 6000 }, (_, i) => `alpha ${i}`).join("\n");
    const b = Array.from({ length: 6000 }, (_, i) => `beta ${i}`).join("\n");
    const start = Date.now();
    const stats = lineDiffStats(a, b);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(stats.added).toBe(6000);
    expect(stats.removed).toBe(6000);
  });
});
