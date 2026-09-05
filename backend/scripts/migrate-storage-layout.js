/**
 * One-off migration: storage/users/<userId>/<projectName>
 *                 → storage/users/<userId>/<projectId>
 *
 * Project directories used to be named after the project, which meant the
 * filesystem path was derived from user input and a rename would have orphaned
 * every file. Files are now keyed by the server-generated project id.
 *
 * Safe to run more than once — a project already at its id path is skipped.
 * Run with `npm run migrate:storage` from backend/.
 */
import fs from "fs/promises";
import path from "path";

import prisma from "../src/db.js";
import { STORAGE_ROOT } from "../src/lib/paths.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, userId: true },
  });

  console.log(
    `${DRY_RUN ? "[dry run] " : ""}Checking ${projects.length} project(s) under ${STORAGE_ROOT}\n`
  );

  let moved = 0;
  let alreadyDone = 0;
  let missing = 0;

  for (const project of projects) {
    const userDir = path.join(STORAGE_ROOT, project.userId);
    const legacyDir = path.join(userDir, project.name);
    const targetDir = path.join(userDir, project.id);

    if (await exists(targetDir)) {
      alreadyDone++;
      continue;
    }
    if (!(await exists(legacyDir))) {
      console.warn(`  ! ${project.name} (${project.id}) — no files on disk, skipping`);
      missing++;
      continue;
    }

    console.log(`  → ${project.name}  ${project.name}/ → ${project.id}/`);
    if (!DRY_RUN) {
      await fs.mkdir(userDir, { recursive: true });
      await fs.rename(legacyDir, targetDir);
    }
    moved++;
  }

  console.log(
    `\nDone. moved=${moved} already-migrated=${alreadyDone} missing-on-disk=${missing}`
  );
  if (DRY_RUN && moved > 0) console.log("Re-run without --dry-run to apply.");
}

main()
  .catch((err) => {
    console.error("Storage migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
