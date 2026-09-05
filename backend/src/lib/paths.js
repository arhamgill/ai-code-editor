import path from "path";
import { env } from "../env.js";
import { AppError } from "./errors.js";

export const STORAGE_ROOT = path.resolve(env.STORAGE_DIR);

/**
 * Absolute directory for a project's files.
 *
 * Keyed by project *id* rather than project name. The id is a server-generated
 * uuid, so no part of this path is ever influenced by user input, and renaming
 * a project is a pure metadata change that never touches the filesystem.
 */
export function projectDir(userId, projectId) {
  return path.join(STORAGE_ROOT, userId, projectId);
}

/**
 * Resolve a user-supplied relative path inside a project, or throw.
 *
 * The previous implementation checked `absolute.startsWith(projectDir)`, which
 * is unsound in two ways:
 *   1. A sibling directory sharing a prefix passes the check — for project
 *      "app", the path "../app-other/secrets" resolves to ".../app-other/..."
 *      which literally starts with ".../app".
 *   2. It compares un-normalised strings, so casing and separator quirks on
 *      Windows can slip through.
 *
 * `path.relative` is the correct primitive: for a contained path it returns a
 * relative path that neither starts with ".." nor is absolute.
 */
export function resolveInProject(userId, projectId, relativePath) {
  const root = projectDir(userId, projectId);

  if (relativePath === undefined || relativePath === null || relativePath === "") {
    return root;
  }

  if (typeof relativePath !== "string") {
    throw AppError.badRequest("Path must be a string.");
  }

  // Reject NUL bytes outright — they can truncate paths in native syscalls.
  if (relativePath.includes("\0")) {
    throw AppError.badRequest("Path contains an invalid character.");
  }

  // Absolute paths and Windows drive letters are never valid project paths.
  if (path.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath)) {
    throw AppError.badRequest("Path must be relative to the project root.");
  }

  const absolute = path.resolve(root, relativePath);
  const rel = path.relative(root, absolute);

  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw AppError.forbidden("That path is outside the project.");
  }

  return absolute;
}

/** Normalise any path to forward slashes, with no leading "./" or "/". */
export function toPosix(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");
}

/**
 * Validate a relative path before it is written, without touching the disk.
 * Used to filter uploads, where a single bad entry should be skipped rather
 * than failing the whole import.
 */
export function isSafeRelativePath(relativePath) {
  const raw = String(relativePath ?? "");
  if (!raw || raw.includes("\0")) return false;

  // Test the *raw* input for absoluteness: toPosix strips a leading slash, so
  // normalising first would quietly rewrite "/etc/passwd" into the plausible
  // relative path "etc/passwd" and report it as safe.
  if (raw.startsWith("/") || raw.startsWith("\\") || /^[a-zA-Z]:/.test(raw)) return false;

  const p = toPosix(raw);
  return !p.split("/").some((seg) => seg === ".." || seg === "");
}
