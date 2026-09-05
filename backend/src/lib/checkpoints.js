import fs from "fs/promises";
import path from "path";
import prisma from "../db.js";
import { projectDir, resolveInProject } from "./paths.js";
import { tryReadText } from "./workspace.js";

/**
 * After undoing a file creation, walk back up removing directories the file
 * left empty — otherwise restoring an "add app/about/page.tsx" edit leaves a
 * stray app/about/ folder sitting in the explorer.
 */
async function pruneEmptyDirs(startDir, stopDir) {
  let dir = startDir;
  while (dir.startsWith(stopDir) && dir !== stopDir) {
    try {
      const entries = await fs.readdir(dir);
      if (entries.length > 0) return;
      await fs.rmdir(dir);
    } catch {
      return;
    }
    dir = path.dirname(dir);
  }
}

/**
 * Snapshot the current contents of a set of paths.
 *
 * Called *lazily* by the agent, one path at a time, just before that path is
 * first modified in a run — so we capture the true pre-run state without
 * having to guess up front which files the model will touch.
 *
 * A `null` content means "did not exist", which restore turns back into a
 * delete. That distinction is what lets Restore undo a file *creation*.
 */
export class CheckpointRecorder {
  constructor({ userId, projectId, chatId }) {
    this.userId = userId;
    this.projectId = projectId;
    this.chatId = chatId;
    /** @type {Map<string, string|null>} */
    this.snapshots = new Map();
  }

  get size() {
    return this.snapshots.size;
  }

  /** Record the pre-edit content of `relPath` the first time it is touched. */
  async capture(relPath) {
    if (this.snapshots.has(relPath)) return;
    const abs = resolveInProject(this.userId, this.projectId, relPath);
    this.snapshots.set(relPath, await tryReadText(abs));
  }

  /** Persist the snapshot. Returns the checkpoint, or null if nothing changed. */
  async commit({ messageId, label }) {
    if (this.snapshots.size === 0) return null;

    return prisma.checkpoint.create({
      data: {
        projectId: this.projectId,
        chatId: this.chatId ?? null,
        messageId: messageId ?? null,
        label: label || "Before AI edit",
        files: {
          create: [...this.snapshots].map(([p, content]) => ({ path: p, content })),
        },
      },
      include: { files: { select: { path: true } } },
    });
  }
}

/**
 * Roll every file in a checkpoint back to its recorded state.
 * @returns {Promise<{restored: string[], deleted: string[]}>}
 */
export async function restoreCheckpoint(userId, projectId, checkpoint) {
  const restored = [];
  const deleted = [];
  const root = projectDir(userId, projectId);

  for (const file of checkpoint.files) {
    const abs = resolveInProject(userId, projectId, file.path);
    if (file.content === null) {
      // The file did not exist before the run — undoing means removing it.
      await fs.rm(abs, { force: true }).catch(() => {});
      await pruneEmptyDirs(path.dirname(abs), root);
      deleted.push(file.path);
    } else {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, file.content, "utf8");
      restored.push(file.path);
    }
  }

  return { restored, deleted };
}
