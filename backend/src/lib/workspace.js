import fs from "fs/promises";
import path from "path";
import { resolveInProject, toPosix } from "./paths.js";
import { AppError } from "./errors.js";

/** Directories never surfaced to the editor, the agent, or the preview. */
export const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  ".vercel",
  ".cache",
  "dist",
  "build",
  "out",
  "coverage",
  ".prisma",
]);

/** Extensions we refuse to store or read at all. */
export const BLOCKED_EXTS = new Set([
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".mp4", ".mov", ".avi", ".mkv",
  ".tmp", ".lock",
]);

/** Extensions returned to the client as base64 data URLs instead of text. */
const IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
};

/** Hard ceilings. A runaway file should degrade, never take the process down. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB per file
export const MAX_AGENT_READ_BYTES = 128 * 1024; // 128 KB fed to the model
export const MAX_PROJECT_FILES = 4000;

export function isImagePath(p) {
  return path.extname(p).toLowerCase() in IMAGE_MIME;
}

export function imageMime(p) {
  return IMAGE_MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

export function isBlockedPath(p) {
  const posix = toPosix(p);
  if (posix.split("/").some((seg) => IGNORED_DIRS.has(seg))) return true;
  return BLOCKED_EXTS.has(path.extname(posix).toLowerCase());
}

/**
 * Recursive file tree for the explorer. Directories first, then files, each
 * alphabetically — matching how editors present a workspace.
 */
export async function readTree(dir, baseDir = dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  const nodes = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const abs = path.join(dir, entry.name);
    const rel = toPosix(path.relative(baseDir, abs));

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: rel,
        type: "directory",
        children: await readTree(abs, baseDir),
      });
    } else if (entry.isFile()) {
      if (BLOCKED_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
      let size = 0;
      try {
        size = (await fs.stat(abs)).size;
      } catch {
        /* raced with a delete — report it as empty rather than failing the tree */
      }
      nodes.push({ name: entry.name, path: rel, type: "file", size });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

/** Flat list of text-file paths, used to give the agent a workspace map. */
export async function listTextFiles(dir, baseDir = dir, acc = []) {
  if (acc.length >= MAX_PROJECT_FILES) return acc;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await listTextFiles(abs, baseDir, acc);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (BLOCKED_EXTS.has(ext) || ext in IMAGE_MIME) continue;
      acc.push(toPosix(path.relative(baseDir, abs)));
      if (acc.length >= MAX_PROJECT_FILES) break;
    }
  }
  return acc;
}

/**
 * Read a file for the client. Images come back as data URLs; text is capped so
 * a huge generated file cannot exhaust memory.
 */
export async function readProjectFile(userId, projectId, relPath, { maxBytes = MAX_FILE_BYTES } = {}) {
  const abs = resolveInProject(userId, projectId, relPath);

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch (err) {
    if (err.code === "ENOENT") throw AppError.notFound(`No such file: ${toPosix(relPath)}`);
    throw err;
  }
  if (stat.isDirectory()) throw AppError.badRequest(`${toPosix(relPath)} is a folder, not a file.`);

  if (isImagePath(abs)) {
    if (stat.size > MAX_FILE_BYTES) {
      throw AppError.tooLarge("That image is too large to open in the editor (max 2 MB).");
    }
    const buf = await fs.readFile(abs);
    return {
      path: toPosix(relPath),
      content: `data:${imageMime(abs)};base64,${buf.toString("base64")}`,
      isBinary: true,
      size: stat.size,
      truncated: false,
    };
  }

  if (stat.size > maxBytes) {
    const handle = await fs.open(abs, "r");
    try {
      const buf = Buffer.alloc(maxBytes);
      await handle.read(buf, 0, maxBytes, 0);
      return {
        path: toPosix(relPath),
        content: buf.toString("utf8"),
        isBinary: false,
        size: stat.size,
        truncated: true,
      };
    } finally {
      await handle.close();
    }
  }

  return {
    path: toPosix(relPath),
    content: await fs.readFile(abs, "utf8"),
    isBinary: false,
    size: stat.size,
    truncated: false,
  };
}

/** Read a file's text, or return null when it does not exist yet. */
export async function tryReadText(absPath) {
  try {
    return await fs.readFile(absPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "EISDIR") return null;
    throw err;
  }
}

const DATA_URL_RE = /^data:([^;,]+);base64,(.*)$/s;

/** Write a file, decoding base64 data URLs back into real binary content. */
export async function writeProjectFile(userId, projectId, relPath, content) {
  const abs = resolveInProject(userId, projectId, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });

  const match = typeof content === "string" ? content.match(DATA_URL_RE) : null;
  if (match) {
    await fs.writeFile(abs, Buffer.from(match[2], "base64"));
  } else {
    await fs.writeFile(abs, content ?? "", "utf8");
  }
  return abs;
}

/** file/dir counts and total bytes, skipping ignored directories. */
export async function projectStats(dir) {
  let files = 0;
  let directories = 0;
  let bytes = 0;

  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        directories++;
        await walk(abs);
      } else if (entry.isFile()) {
        files++;
        try {
          bytes += (await fs.stat(abs)).size;
        } catch {
          /* ignore */
        }
      }
    }
  }

  await walk(dir);
  return { files, directories, bytes };
}
