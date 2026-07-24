import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import { clerkMiddleware, clerkClient, getAuth } from "@clerk/express";
import prisma from "./db.js";
import projectRouter from "./projects.js";
import agentRouter from "./agent.js";

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

// Mount AI agent router
app.use("/api/agent", agentRouter);

// Helper to ensure Clerk user is synced with local Postgres DB
async function getOrSyncUser(userId) {
  // Check if user exists in database
  let dbUser = await prisma.user.findUnique({ where: { id: userId } });

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
        }
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
  res.json({ message: "Hello from the Forge Express backend!" });
});

// GET /api/me - Authenticated route that syncs the Clerk user into Postgres
app.get("/api/me", async (req, res) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    return res.status(401).json({ error: "Unauthorized", message: "You must be signed in." });
  }

  try {
    const dbUser = await getOrSyncUser(auth.userId);
    res.json({ userId: dbUser.id, email: dbUser.email });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Express API server running in [${NODE_ENV}] mode on http://localhost:${PORT}`);
});
