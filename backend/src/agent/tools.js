import fs from "fs/promises";
import path from "path";

import { resolveInProject, toPosix, isSafeRelativePath } from "../lib/paths.js";
import {
  readTree,
  tryReadText,
  isBlockedPath,
  isImagePath,
  IGNORED_DIRS,
  BLOCKED_EXTS,
  MAX_AGENT_READ_BYTES,
  MAX_FILE_BYTES,
} from "../lib/workspace.js";
import { lineDiffStats } from "../lib/diff.js";

export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List every file and folder in the project. Use this only if the workspace map in the system prompt was truncated or you need to confirm a path.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a file's full contents. Always read a file before writing to it, since write_file replaces the entire file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to the project root, e.g. app/page.tsx" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create a file or replace an existing one with the complete new contents. Never pass a partial file or a placeholder comment.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to the project root." },
          content: { type: "string", description: "The entire file contents." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file or folder. Use sparingly and only when the user asked for it.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Path relative to the project root." } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description:
        "Search the project's text files for a string and get back matching files with line numbers. Use this to find where something is defined or used.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Literal text to search for (case-insensitive)." },
        },
        required: ["query"],
      },
    },
  },
];

const MAX_SEARCH_FILES = 400;
const MAX_SEARCH_RESULTS = 20;
const MAX_MATCHES_PER_FILE = 5;

async function searchFiles(rootDir, query) {
  const needle = query.toLowerCase();
  const results = [];
  let scanned = 0;

  async function walk(dir) {
    if (results.length >= MAX_SEARCH_RESULTS || scanned >= MAX_SEARCH_FILES) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= MAX_SEARCH_RESULTS || scanned >= MAX_SEARCH_FILES) return;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (BLOCKED_EXTS.has(ext) || isImagePath(entry.name)) continue;

      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        continue;
      }
      if (stat.size > MAX_FILE_BYTES) continue;

      scanned++;
      const content = await tryReadText(abs);
      if (!content || !content.toLowerCase().includes(needle)) continue;

      const matches = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length && matches.length < MAX_MATCHES_PER_FILE; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          matches.push({ line: i + 1, text: lines[i].trim().slice(0, 200) });
        }
      }
      results.push({ path: toPosix(path.relative(rootDir, abs)), matches });
    }
  }

  await walk(rootDir);
  return { results, truncated: scanned >= MAX_SEARCH_FILES };
}

/**
 * Build the tool executors for one run.
 *
 * `onFileChange` is called after every successful mutation so the caller can
 * stream the change to the UI, and `checkpoint.capture` runs *before* the write
 * so the pre-edit content is always recoverable.
 */
export function createToolExecutors({ userId, projectId, projectDir, checkpoint, onFileChange }) {
  const requirePath = (raw) => {
    const rel = toPosix(raw);
    if (!rel) throw new Error("A path is required.");
    if (!isSafeRelativePath(rel)) {
      throw new Error(`"${rel}" is not a valid project path. Use a path relative to the project root, with no "..".`);
    }
    if (isBlockedPath(rel)) {
      throw new Error(`"${rel}" is not a file this editor can work with.`);
    }
    return rel;
  };

  return {
    async list_files() {
      return { files: await readTree(projectDir) };
    },

    async read_file(args) {
      const rel = requirePath(args.path);
      const abs = resolveInProject(userId, projectId, rel);
      const content = await tryReadText(abs);

      if (content === null) {
        // A clear miss the model can recover from beats a thrown error.
        return { error: `No file at "${rel}". Call list_files to see what exists.` };
      }
      if (content.length > MAX_AGENT_READ_BYTES) {
        return {
          path: rel,
          content: content.slice(0, MAX_AGENT_READ_BYTES),
          truncated: true,
          note: `File is ${content.length} characters; only the first ${MAX_AGENT_READ_BYTES} are shown. Do not rewrite this file from the truncated copy — you would delete the rest.`,
        };
      }
      return { path: rel, content, truncated: false };
    },

    async write_file(args) {
      const rel = requirePath(args.path);
      const content = typeof args.content === "string" ? args.content : "";

      if (content.length > MAX_FILE_BYTES) {
        throw new Error(`Refusing to write ${rel}: content exceeds the 2 MB file limit.`);
      }

      await checkpoint.capture(rel);

      const abs = resolveInProject(userId, projectId, rel);
      const before = await tryReadText(abs);

      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");

      const stats = lineDiffStats(before ?? "", content);
      const action = before === null ? "created" : "modified";

      onFileChange({ action, path: rel, ...stats });
      return { ok: true, path: rel, action, ...stats };
    },

    async delete_file(args) {
      const rel = requirePath(args.path);
      await checkpoint.capture(rel);

      const abs = resolveInProject(userId, projectId, rel);
      try {
        await fs.rm(abs, { recursive: true, force: false });
      } catch (err) {
        if (err.code === "ENOENT") return { error: `Nothing to delete at "${rel}".` };
        throw err;
      }

      onFileChange({ action: "deleted", path: rel, added: 0, removed: 0 });
      return { ok: true, path: rel, action: "deleted" };
    },

    async search_files(args) {
      const query = String(args.query ?? "").trim();
      if (!query) return { error: "A search query is required." };
      return searchFiles(projectDir, query);
    },
  };
}
