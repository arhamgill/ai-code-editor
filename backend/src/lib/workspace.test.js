import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";

import { STORAGE_ROOT, projectDir } from "./paths.js";
import {
  readTree,
  listTextFiles,
  readProjectFile,
  writeProjectFile,
  projectStats,
  isBlockedPath,
  tryReadText,
  MAX_AGENT_READ_BYTES,
} from "./workspace.js";
import { AppError } from "./errors.js";

const USER = "test_user";
const PROJECT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const root = projectDir(USER, PROJECT);

async function seed(files) {
  await fs.rm(root, { recursive: true, force: true });
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(root, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
}

beforeEach(async () => {
  await seed({
    "package.json": '{"name":"demo","dependencies":{"next":"15.1.0"}}',
    "app/page.tsx": "export default function Page() {\n  return <h1>Hi</h1>;\n}\n",
    "app/layout.tsx": "export default function Layout() {}\n",
    "components/Nav.tsx": "export function Nav() {}\n",
    "node_modules/left-pad/index.js": "module.exports = 1;",
    ".next/build-manifest.json": "{}",
    "assets/logo.zip": "binary-ish",
  });
});

afterAll(async () => {
  await fs.rm(path.join(STORAGE_ROOT, USER), { recursive: true, force: true });
});

describe("readTree", () => {
  it("lists directories before files, each alphabetically", async () => {
    const tree = await readTree(root);
    expect(tree.map((n) => n.name)).toEqual(["app", "assets", "components", "package.json"]);
    expect(tree[0].type).toBe("directory");
  });

  it("omits node_modules and build output", async () => {
    const names = JSON.stringify(await readTree(root));
    expect(names).not.toContain("node_modules");
    expect(names).not.toContain(".next");
  });

  it("omits archive and binary extensions", async () => {
    const assets = (await readTree(root)).find((n) => n.name === "assets");
    expect(assets.children).toEqual([]);
  });

  it("reports file sizes and posix paths", async () => {
    const app = (await readTree(root)).find((n) => n.name === "app");
    const page = app.children.find((n) => n.name === "page.tsx");
    expect(page.path).toBe("app/page.tsx");
    expect(page.size).toBeGreaterThan(0);
  });

  it("returns an empty tree rather than throwing for a missing project", async () => {
    expect(await readTree(projectDir(USER, "does-not-exist"))).toEqual([]);
  });
});

describe("listTextFiles", () => {
  it("returns a flat list of editable files only", async () => {
    const files = (await listTextFiles(root)).sort();
    expect(files).toEqual([
      "app/layout.tsx",
      "app/page.tsx",
      "components/Nav.tsx",
      "package.json",
    ]);
  });
});

describe("readProjectFile", () => {
  it("reads a text file", async () => {
    const file = await readProjectFile(USER, PROJECT, "app/page.tsx");
    expect(file.content).toContain("<h1>Hi</h1>");
    expect(file.isBinary).toBe(false);
    expect(file.truncated).toBe(false);
  });

  it("404s a file that does not exist", async () => {
    await expect(readProjectFile(USER, PROJECT, "nope.ts")).rejects.toThrow(AppError);
  });

  it("refuses to read a directory as a file", async () => {
    await expect(readProjectFile(USER, PROJECT, "app")).rejects.toThrow(/folder, not a file/);
  });

  it("truncates instead of loading an oversized file into memory", async () => {
    await writeProjectFile(USER, PROJECT, "big.txt", "x".repeat(5000));
    const file = await readProjectFile(USER, PROJECT, "big.txt", { maxBytes: 1000 });

    expect(file.truncated).toBe(true);
    expect(file.content).toHaveLength(1000);
    expect(file.size).toBe(5000);
  });

  it("blocks traversal through the read path", async () => {
    await expect(readProjectFile(USER, PROJECT, "../../../etc/passwd")).rejects.toThrow(AppError);
  });
});

describe("writeProjectFile", () => {
  it("creates missing parent directories", async () => {
    await writeProjectFile(USER, PROJECT, "a/b/c/deep.ts", "export const x = 1;");
    expect(await tryReadText(path.join(root, "a/b/c/deep.ts"))).toBe("export const x = 1;");
  });

  it("decodes a base64 data URL back into real bytes", async () => {
    // A 1x1 transparent GIF.
    const dataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    await writeProjectFile(USER, PROJECT, "pixel.gif", dataUrl);

    const bytes = await fs.readFile(path.join(root, "pixel.gif"));
    expect(bytes.subarray(0, 3).toString()).toBe("GIF");
  });

  it("round-trips an image back out as a data URL", async () => {
    const dataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    await writeProjectFile(USER, PROJECT, "pixel.gif", dataUrl);

    const file = await readProjectFile(USER, PROJECT, "pixel.gif");
    expect(file.isBinary).toBe(true);
    expect(file.content.startsWith("data:image/gif;base64,")).toBe(true);
  });
});

describe("projectStats", () => {
  it("counts only files the editor can see", async () => {
    const stats = await projectStats(root);
    expect(stats.files).toBe(5); // 4 text files + the .zip, which stats still sizes
    expect(stats.directories).toBe(3);
    expect(stats.bytes).toBeGreaterThan(0);
  });
});

describe("isBlockedPath", () => {
  it.each([
    ["app/page.tsx", false],
    ["package.json", false],
    ["node_modules/react/index.js", true],
    [".next/cache/x", true],
    ["dist/bundle.js", true],
    ["assets/archive.zip", true],
    ["bin/tool.exe", true],
  ])("%s → blocked=%s", (input, expected) => {
    expect(isBlockedPath(input)).toBe(expected);
  });
});

describe("agent read cap", () => {
  it("is smaller than the editor cap, so the model never sees a whole huge file", () => {
    expect(MAX_AGENT_READ_BYTES).toBeLessThan(2 * 1024 * 1024);
  });
});
