import express from "express";
import { getAuth } from "@clerk/express";
import fs from "fs/promises";
import path from "path";
import prisma from "./db.js";

const router = express.Router();
const STORAGE_ROOT = path.resolve("./storage/users");

// Helper to ensure path is secure and stays within the user's project folder
function getSecurePath(userId, projectName, relativeFilePath) {
  const userDir = path.join(STORAGE_ROOT, userId);
  const projectDir = path.join(userDir, projectName);

  if (!relativeFilePath) {
    return projectDir;
  }

  const absoluteFilePath = path.join(projectDir, relativeFilePath);

  // Prevent Directory Traversal Attacks: Verify absolute path starts with project dir
  if (!absoluteFilePath.startsWith(projectDir)) {
    throw new Error("Security Violation: Access denied outside project boundary.");
  }

  return absoluteFilePath;
}

// Helper to read directory recursively and build file tree
async function readDirectoryTree(dirPath, baseDir) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, entryPath).replace(/\\/g, "/");

    // Skip blacklisted folders
    if (["node_modules", "dist", ".next", ".git", ".turbo", "build", "out", ".prisma"].includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relativePath,
        type: "directory",
        children: await readDirectoryTree(entryPath, baseDir)
      });
    } else {
      // Skip blacklisted binary file extensions
      const ext = path.extname(entry.name).toLowerCase();
      if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".dll", ".exe", ".tmp"].includes(ext)) {
        continue;
      }

      result.push({
        name: entry.name,
        path: relativePath,
        type: "file"
      });
    }
  }

  // Sort directories first, then files alphabetically
  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Helper to recursively delete folders on disk (Node v14+ alternative)
async function deleteFolderRecursive(folderPath) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to delete folder: ${folderPath}`, err);
  }
}

// 1. GET /api/projects - List all projects for logged-in user
router.get("/", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const projects = await prisma.project.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" }
    });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 2. POST /api/projects/upload - Upload folder/project files
router.post("/upload", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { name, files } = req.body;

  if (!name || !Array.isArray(files)) {
    return res.status(400).json({ error: "Bad Request", message: "Project name and files are required." });
  }

  // Sanitize project name
  const sanitizedName = name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
  if (!sanitizedName) {
    return res.status(400).json({ error: "Bad Request", message: "Invalid project name." });
  }

  try {
    // Check if project exists in database
    const existingProject = await prisma.project.findFirst({
      where: { userId: auth.userId, name: sanitizedName }
    });

    if (existingProject) {
      return res.status(409).json({ error: "Conflict", message: "A project with this name already exists." });
    }

    // Write metadata to database
    const project = await prisma.project.create({
      data: {
        name: sanitizedName,
        userId: auth.userId
      }
    });

    // Write files to disk
    for (const file of files) {
      const { path: relativePath, content } = file;

      // Filter out blacklisted directories in paths
      const pathParts = relativePath.split(/[/\\]/);
      if (pathParts.some(part => ["node_modules", "dist", ".next", ".git", ".turbo", "build", "out"].includes(part))) {
        continue;
      }

      // Check binary extensions
      const ext = path.extname(relativePath).toLowerCase();
      if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".dll", ".exe", ".tmp"].includes(ext)) {
        continue;
      }

      const absolutePath = getSecurePath(auth.userId, sanitizedName, relativePath);
      const directory = path.dirname(absolutePath);

      // Ensure subdirectory structure exists
      await fs.mkdir(directory, { recursive: true });
      // Write file contents
      await fs.writeFile(absolutePath, content, "utf8");
    }

    console.log(`[Storage] Saved project [${sanitizedName}] for user [${auth.userId}]`);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 3. GET /api/projects/:id/files - Get project file tree
router.get("/:id/files", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: auth.userId }
    });

    if (!project) {
      return res.status(404).json({ error: "Not Found", message: "Project not found." });
    }

    const projectDir = getSecurePath(auth.userId, project.name);

    // Create dir if it doesn't exist on disk (failsafe)
    await fs.mkdir(projectDir, { recursive: true });

    const fileTree = await readDirectoryTree(projectDir, projectDir);
    res.json(fileTree);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 4. POST /api/projects/:id/read - Read content of specific file
router.post("/:id/read", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { path: relativePath } = req.body;
  if (!relativePath) {
    return res.status(400).json({ error: "Bad Request", message: "File path is required." });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: auth.userId }
    });

    if (!project) {
      return res.status(404).json({ error: "Not Found", message: "Project not found." });
    }

    const absolutePath = getSecurePath(auth.userId, project.name, relativePath);
    const content = await fs.readFile(absolutePath, "utf8");

    res.json({ path: relativePath, content });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 5. POST /api/projects/:id/write - Save content to a specific file
router.post("/:id/write", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { path: relativePath, content } = req.body;
  if (!relativePath || content === undefined) {
    return res.status(400).json({ error: "Bad Request", message: "File path and content are required." });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: auth.userId }
    });

    if (!project) {
      return res.status(404).json({ error: "Not Found", message: "Project not found." });
    }

    const absolutePath = getSecurePath(auth.userId, project.name, relativePath);
    const directory = path.dirname(absolutePath);

    // Ensure containing directory exists (for new file creations)
    await fs.mkdir(directory, { recursive: true });
    // Write new content
    await fs.writeFile(absolutePath, content, "utf8");

    console.log(`[Storage] File updated: ${relativePath} in project ${project.name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 5.5 POST /api/projects/:id/mkdir - Create a directory recursively
router.post("/:id/mkdir", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { path: relativePath } = req.body;
  if (!relativePath) {
    return res.status(400).json({ error: "Bad Request", message: "Directory path is required." });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: auth.userId }
    });

    if (!project) {
      return res.status(404).json({ error: "Not Found", message: "Project not found." });
    }

    const absolutePath = getSecurePath(auth.userId, project.name, relativePath);
    await fs.mkdir(absolutePath, { recursive: true });

    console.log(`[Storage] Created folder: ${relativePath} in project ${project.name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 5.6 DELETE /api/projects/:id/file - Delete a specific file or folder recursively
router.delete("/:id/file", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { path: relativePath } = req.body;
  if (!relativePath) {
    return res.status(400).json({ error: "Bad Request", message: "Path is required." });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: auth.userId }
    });

    if (!project) {
      return res.status(404).json({ error: "Not Found", message: "Project not found." });
    }

    const absolutePath = getSecurePath(auth.userId, project.name, relativePath);

    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true, force: true });
    } else {
      await fs.unlink(absolutePath);
    }

    console.log(`[Storage] Deleted item: ${relativePath} in project ${project.name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 6. DELETE /api/projects/:id - Delete project and clean storage
router.delete("/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: auth.userId }
    });

    if (!project) {
      return res.status(404).json({ error: "Not Found", message: "Project not found." });
    }

    const projectDir = getSecurePath(auth.userId, project.name);

    // Delete from database
    await prisma.project.delete({
      where: { id: req.params.id }
    });

    // Delete from disk
    await deleteFolderRecursive(projectDir);

    console.log(`[Storage] Deleted project [${project.name}] for user [${auth.userId}]`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

export default router;
