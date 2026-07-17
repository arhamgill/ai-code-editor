import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import { clerkMiddleware, clerkClient, getAuth } from "@clerk/express";
import prisma from "./db.js";
import projectRouter from "./projects.js";
import chatRouter from "./chat.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(morgan(NODE_ENV === "development" ? "dev" : "combined"));

// Apply Clerk middleware globally
app.use(clerkMiddleware());

// Mount projects API router
app.use("/api/projects", projectRouter);

// Mount chat API router
app.use("/api/chat", chatRouter);

// Helper to ensure Clerk user is synced with local Postgres DB
async function getOrSyncUser(userId) {
  // Check if user exists in database
  let dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { snippets: true } } }
  });

  if (!dbUser) {
    try {
      // Fetch details from Clerk
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress || `${userId}@clerk-no-email.local`;

      // Provision user in database safely using upsert to avoid race conditions
      dbUser = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: email
        },
        include: { _count: { select: { snippets: true } } }
      });
      console.log(`[Database] Synced user: ${email} (ID: ${userId})`);
    } catch (err) {
      console.error("[Database Error] Failed to sync Clerk user to Postgres:", err);
      throw err;
    }
  }

  return dbUser;
}

// Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: NODE_ENV
  });
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the AuraEdit Express backend!" });
});

// Protected route that checks for authentication and syncs user with DB
app.get("/api/protected", async (req, res) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "You must be logged in to access this protected API route."
    });
  }

  try {
    const dbUser = await getOrSyncUser(auth.userId);

    res.json({
      message: "Welcome to the secure AuraEdit API!",
      userId: dbUser.id,
      email: dbUser.email,
      snippetCount: dbUser._count.snippets,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// GET /api/snippets - Fetch all snippets for the logged-in user
app.get("/api/snippets", async (req, res) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Ensure user is synced
    await getOrSyncUser(auth.userId);

    const snippets = await prisma.snippet.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" }
    });

    res.json(snippets);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// POST /api/snippets - Save a new snippet to Postgres
app.post("/api/snippets", async (req, res) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { title, code } = req.body;

  if (!title || !code) {
    return res.status(400).json({ error: "Bad Request", message: "Title and code are required." });
  }

  try {
    // Ensure user is synced
    await getOrSyncUser(auth.userId);

    const snippet = await prisma.snippet.create({
      data: {
        title,
        code,
        userId: auth.userId
      }
    });

    res.json(snippet);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Express API server running in [${NODE_ENV}] mode on http://localhost:${PORT}`);
});
