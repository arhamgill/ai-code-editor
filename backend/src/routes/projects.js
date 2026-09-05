import express from "express";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

import prisma from "../db.js";
import { AppError, asyncHandler, parseBody } from "../lib/errors.js";
import { projectDir, resolveInProject, isSafeRelativePath, toPosix } from "../lib/paths.js";
import {
  readTree,
  readProjectFile,
  writeProjectFile,
  projectStats,
  isBlockedPath,
  MAX_FILE_BYTES,
} from "../lib/workspace.js";
import { requireProject } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

/* ────────────────────────────── schemas ────────────────────────────── */

const projectName = z
  .string()
  .trim()
  .min(1, "Give your project a name.")
  .max(60, "Project names are limited to 60 characters.")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9 ._-]*$/,
    "Use letters, numbers, spaces, dots, dashes or underscores."
  );

const relPath = z.string().trim().min(1, "A file path is required.").max(400);

const createSchema = z.object({
  name: projectName,
  files: z
    .array(z.object({ path: z.string().max(400), content: z.string().optional() }))
    .max(5000, "That folder has too many files to import (limit 5000)."),
});

const writeSchema = z.object({ path: relPath, content: z.string() });
const pathSchema = z.object({ path: relPath });
const renameSchema = z.object({ from: relPath, to: relPath });
const renameProjectSchema = z.object({ name: projectName });

/* ───────────────────────────── helpers ─────────────────────────────── */

const shape = (p) => ({
  id: p.id,
  name: p.name,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const touch = (id) =>
  prisma.project.update({ where: { id }, data: { updatedAt: new Date() } }).catch(() => {});

/**
 * A Next.js project is the only thing this editor knows how to preview, so
 * imports are checked up front rather than failing confusingly at `npm run dev`.
 */
function looksLikeNextProject(files) {
  const pkg = files.find((f) => toPosix(f.path).toLowerCase() === "package.json");
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg.content || "{}");
      const deps = { ...parsed.dependencies, ...parsed.devDependencies };
      if (deps.next) return true;
    } catch {
      /* malformed package.json — fall through to the structural check */
    }
  }
  return files.some((f) => {
    const p = toPosix(f.path).toLowerCase();
    return (
      /^next\.config\.(js|mjs|ts|cjs)$/.test(p) ||
      p.startsWith("app/") ||
      p.startsWith("pages/") ||
      p.startsWith("src/app/") ||
      p.startsWith("src/pages/")
    );
  });
}

/* ────────────────────────────── routes ─────────────────────────────── */

// List projects, newest activity first.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(projects.map(shape));
  })
);

// Create a project from a template or an imported folder.
router.post(
  "/",
  uploadLimiter,
  asyncHandler(async (req, res) => {
    const { name, files } = parseBody(createSchema, req.body);

    if (!files.length) {
      throw AppError.badRequest("A project needs at least one file.");
    }
    if (!looksLikeNextProject(files)) {
      throw AppError.unprocessable(
        "This doesn't look like a Next.js project. Make sure the folder has a package.json listing \"next\" as a dependency, plus an app/ or pages/ directory."
      );
    }

    const duplicate = await prisma.project.findFirst({
      where: { userId: req.userId, name },
    });
    if (duplicate) {
      throw AppError.conflict(`You already have a project called "${name}".`);
    }

    const project = await prisma.project.create({
      data: { name, userId: req.userId },
    });

    try {
      let written = 0;
      for (const file of files) {
        const rel = toPosix(file.path);
        if (!rel || !isSafeRelativePath(rel) || isBlockedPath(rel)) continue;
        if ((file.content?.length ?? 0) > MAX_FILE_BYTES) continue;
        await writeProjectFile(req.userId, project.id, rel, file.content ?? "");
        written++;
      }
      if (written === 0) {
        throw AppError.unprocessable("None of the selected files could be imported.");
      }
    } catch (err) {
      // Never leave a project row pointing at a half-written directory.
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      await fs.rm(projectDir(req.userId, project.id), { recursive: true, force: true }).catch(() => {});
      throw err;
    }

    res.status(201).json(shape(project));
  })
);

// Rename a project. Files are keyed by id, so nothing on disk moves.
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    const { name } = parseBody(renameProjectSchema, req.body);

    if (name !== project.name) {
      const clash = await prisma.project.findFirst({
        where: { userId: req.userId, name, NOT: { id: project.id } },
      });
      if (clash) throw AppError.conflict(`You already have a project called "${name}".`);
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { name },
    });
    res.json(shape(updated));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    await prisma.project.delete({ where: { id: project.id } });
    await fs.rm(projectDir(req.userId, project.id), { recursive: true, force: true }).catch((err) => {
      console.error(`[storage] Orphaned directory for project ${project.id}:`, err.message);
    });
    res.json({ ok: true });
  })
);

router.get(
  "/:id/files",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    const dir = projectDir(req.userId, project.id);
    await fs.mkdir(dir, { recursive: true });
    res.json(await readTree(dir));
  })
);

router.get(
  "/:id/stats",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    const stats = await projectStats(projectDir(req.userId, project.id));
    res.json({ ...shape(project), ...stats });
  })
);

// Reading a file is a GET with the path as a query param — it is a read, and
// making it cacheable and linkable matters more than hiding the path.
router.get(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    const { path: rel } = parseBody(pathSchema, { path: req.query.path });
    res.json(await readProjectFile(req.userId, project.id, rel));
  })
);

router.put(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    const { path: rel, content } = parseBody(writeSchema, req.body);

    if (!isSafeRelativePath(rel)) throw AppError.badRequest("That path is not valid.");
    if (isBlockedPath(rel)) throw AppError.badRequest("That file type cannot be edited here.");
    if (content.length > MAX_FILE_BYTES) {
      throw AppError.tooLarge("That file is too large to save (max 2 MB).");
    }

    await writeProjectFile(req.userId, project.id, rel, content);
    await touch(project.id);
    res.json({ ok: true, path: toPosix(rel), bytes: Buffer.byteLength(content) });
  })
);

router.post(
  "/:id/folder",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    const { path: rel } = parseBody(pathSchema, req.body);

    if (!isSafeRelativePath(rel)) throw AppError.badRequest("That path is not valid.");
    await fs.mkdir(resolveInProject(req.userId, project.id, rel), { recursive: true });
    await touch(project.id);
    res.json({ ok: true, path: toPosix(rel) });
  })
);

router.post(
  "/:id/rename",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    const { from, to } = parseBody(renameSchema, req.body);

    if (!isSafeRelativePath(to)) throw AppError.badRequest("That destination path is not valid.");

    const src = resolveInProject(req.userId, project.id, from);
    const dest = resolveInProject(req.userId, project.id, to);

    if (src === dest) return res.json({ ok: true, path: toPosix(to) });

    // Renaming onto an existing file would silently destroy it.
    try {
      await fs.access(dest);
      throw AppError.conflict(`"${toPosix(to)}" already exists.`);
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err.code !== "ENOENT") throw err;
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.rename(src, dest);
    } catch (err) {
      if (err.code === "ENOENT") throw AppError.notFound(`No such file: ${toPosix(from)}`);
      throw err;
    }

    await touch(project.id);
    res.json({ ok: true, from: toPosix(from), path: toPosix(to) });
  })
);

router.delete(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const project = await requireProject(req.userId, req.params.id);
    const { path: rel } = parseBody(pathSchema, { path: req.query.path ?? req.body?.path });

    const abs = resolveInProject(req.userId, project.id, rel);
    try {
      await fs.rm(abs, { recursive: true, force: false });
    } catch (err) {
      if (err.code === "ENOENT") throw AppError.notFound(`No such file: ${toPosix(rel)}`);
      throw err;
    }

    await touch(project.id);
    res.json({ ok: true, path: toPosix(rel) });
  })
);

export default router;
