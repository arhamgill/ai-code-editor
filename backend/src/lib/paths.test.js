import { describe, it, expect } from "vitest";
import path from "path";

import { resolveInProject, projectDir, isSafeRelativePath, toPosix, STORAGE_ROOT } from "./paths.js";
import { AppError } from "./errors.js";

const USER = "user_abc";
const PROJECT = "11111111-2222-3333-4444-555555555555";

const inside = (p) => {
  const rel = path.relative(projectDir(USER, PROJECT), p);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

describe("resolveInProject", () => {
  it("resolves ordinary nested paths inside the project", () => {
    const resolved = resolveInProject(USER, PROJECT, "app/about/page.tsx");
    expect(inside(resolved)).toBe(true);
    expect(resolved.endsWith(path.join("app", "about", "page.tsx"))).toBe(true);
  });

  it("returns the project root for an empty path", () => {
    expect(resolveInProject(USER, PROJECT, "")).toBe(projectDir(USER, PROJECT));
    expect(resolveInProject(USER, PROJECT, undefined)).toBe(projectDir(USER, PROJECT));
  });

  it("rejects parent-directory traversal", () => {
    expect(() => resolveInProject(USER, PROJECT, "../secrets.txt")).toThrow(AppError);
    expect(() => resolveInProject(USER, PROJECT, "app/../../secrets.txt")).toThrow(AppError);
    expect(() => resolveInProject(USER, PROJECT, "../../../../../../etc/passwd")).toThrow(AppError);
  });

  // The regression this whole module exists for. The previous implementation
  // checked `absolute.startsWith(projectDir)`, so a sibling directory sharing a
  // name prefix slipped through and one project could read another's files.
  it("rejects a sibling directory that shares a name prefix", () => {
    expect(() => resolveInProject(USER, "app", "../app-other/.env")).toThrow(AppError);
    expect(() => resolveInProject(USER, "proj", "../proj-backup/secret.ts")).toThrow(AppError);
  });

  it("rejects escaping into another user's storage", () => {
    expect(() => resolveInProject(USER, PROJECT, `../../other_user/${PROJECT}/app/page.tsx`)).toThrow(
      AppError
    );
  });

  it("rejects absolute paths and Windows drive letters", () => {
    expect(() => resolveInProject(USER, PROJECT, "/etc/passwd")).toThrow(AppError);
    expect(() => resolveInProject(USER, PROJECT, "C:\\Windows\\System32\\config")).toThrow(AppError);
  });

  it("rejects NUL bytes, which can truncate paths in native syscalls", () => {
    expect(() => resolveInProject(USER, PROJECT, "app/page.tsx\0.png")).toThrow(AppError);
  });

  it("rejects a path that resolves to the project root itself", () => {
    expect(() => resolveInProject(USER, PROJECT, "app/..")).toThrow(AppError);
  });

  it("normalises backslash separators without escaping", () => {
    const resolved = resolveInProject(USER, PROJECT, "app\\page.tsx");
    expect(inside(resolved)).toBe(true);
  });

  it("keeps every project under the configured storage root", () => {
    expect(projectDir(USER, PROJECT).startsWith(STORAGE_ROOT)).toBe(true);
  });
});

describe("isSafeRelativePath", () => {
  it.each([
    ["app/page.tsx", true],
    ["package.json", true],
    ["a/b/c/d.ts", true],
    ["../escape", false],
    ["app/../../escape", false],
    ["/absolute", false],
    ["C:/windows", false],
    ["", false],
    ["app//double", false],
  ])("%s → %s", (input, expected) => {
    expect(isSafeRelativePath(input)).toBe(expected);
  });
});

describe("toPosix", () => {
  it("normalises separators and strips a leading ./", () => {
    expect(toPosix("app\\components\\Nav.tsx")).toBe("app/components/Nav.tsx");
    expect(toPosix("./app/page.tsx")).toBe("app/page.tsx");
    expect(toPosix("/app/page.tsx")).toBe("app/page.tsx");
  });
});
