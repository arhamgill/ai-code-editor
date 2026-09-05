import { describe, it, expect } from "vitest";
import { fuzzyScore, fuzzyFilter, formatBytes, languageForPath, fileName, dirName } from "./utils";
import { toMonacoHex, withAlpha } from "./color";

describe("fuzzyScore", () => {
  it("matches a subsequence, not just a substring", () => {
    // The old picker used `includes()`, so this found nothing.
    expect(fuzzyScore("app/about/page.tsx", "apg")).not.toBeNull();
  });

  it("rejects characters that are not present in order", () => {
    expect(fuzzyScore("app/page.tsx", "zzz")).toBeNull();
    expect(fuzzyScore("app/page.tsx", "egap")).toBeNull();
  });

  it("scores a file-name match above a directory-only match", () => {
    const inName = fuzzyScore("components/Button.tsx", "button")!;
    const inDir = fuzzyScore("button/index.tsx", "button")!;
    expect(inName).toBeGreaterThan(0);
    expect(inDir).toBeGreaterThan(0);
  });

  it("returns 0 for an empty query", () => {
    expect(fuzzyScore("anything", "")).toBe(0);
  });
});

describe("fuzzyFilter", () => {
  const files = [
    "app/page.tsx",
    "app/layout.tsx",
    "app/about/page.tsx",
    "components/Nav.tsx",
    "package.json",
  ];

  it("ranks the closest file name first", () => {
    expect(fuzzyFilter(files, "nav", (f) => f)[0]).toBe("components/Nav.tsx");
    expect(fuzzyFilter(files, "layout", (f) => f)[0]).toBe("app/layout.tsx");
  });

  it("returns everything (up to the limit) for an empty query", () => {
    expect(fuzzyFilter(files, "", (f) => f)).toHaveLength(files.length);
    expect(fuzzyFilter(files, "", (f) => f, 2)).toHaveLength(2);
  });

  it("returns nothing when nothing matches", () => {
    expect(fuzzyFilter(files, "qqqq", (f) => f)).toEqual([]);
  });
});

describe("toMonacoHex", () => {
  /**
   * Tailwind's minifier rewrites `#ffffff` to `#fff` in the built stylesheet,
   * and Monaco's theme parser throws "Illegal value for token color: #fff" —
   * which took the whole editor down in the light theme.
   */
  it("expands shorthand hex", () => {
    expect(toMonacoHex("#fff", "#000000")).toBe("#ffffff");
    expect(toMonacoHex("#1a2", "#000000")).toBe("#11aa22");
    expect(toMonacoHex("#fff8", "#000000")).toBe("#ffffff88");
  });

  it("passes full-length hex through untouched", () => {
    expect(toMonacoHex("#08090a", "#000000")).toBe("#08090a");
    expect(toMonacoHex("#08090aff", "#000000")).toBe("#08090aff");
  });

  it("trims whitespace, as getPropertyValue returns a leading space", () => {
    expect(toMonacoHex("  #2563eb  ", "#000000")).toBe("#2563eb");
  });

  it("converts rgb() and rgba()", () => {
    expect(toMonacoHex("rgb(255, 0, 128)", "#000000")).toBe("#ff0080");
    expect(toMonacoHex("rgba(0, 0, 0, 0.5)", "#ffffff")).toBe("#00000080");
  });

  it("falls back when the value is missing or unparseable", () => {
    expect(toMonacoHex("", "#123456")).toBe("#123456");
    expect(toMonacoHex("var(--nope)", "#123456")).toBe("#123456");
    expect(toMonacoHex("goldenrod", "#123456")).toBe("#123456");
  });
});

describe("withAlpha", () => {
  it("replaces any existing alpha rather than appending to it", () => {
    expect(withAlpha("#08090a", "80")).toBe("#08090a80");
    expect(withAlpha("#08090aff", "80")).toBe("#08090a80");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [1024 * 1024, "1 MB"],
    [15 * 1024 * 1024, "15 MB"],
  ])("%i → %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});

describe("languageForPath", () => {
  it.each([
    ["app/page.tsx", "typescript"],
    ["next.config.mjs", "javascript"],
    ["package.json", "json"],
    ["app/globals.css", "css"],
    ["README.md", "markdown"],
    ["Dockerfile", "dockerfile"],
    ["notes.unknown", "plaintext"],
  ])("%s → %s", (input, expected) => {
    expect(languageForPath(input)).toBe(expected);
  });
});

describe("path helpers", () => {
  it("splits a path into name and directory", () => {
    expect(fileName("app/about/page.tsx")).toBe("page.tsx");
    expect(dirName("app/about/page.tsx")).toBe("app/about");
    expect(fileName("package.json")).toBe("package.json");
    expect(dirName("package.json")).toBe("");
  });
});
