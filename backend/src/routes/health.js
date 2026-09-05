import express from "express";
import prisma from "../db.js";
import { env } from "../env.js";

const router = express.Router();

const startedAt = Date.now();

/** Liveness: is the process up? Cheap enough for a 1s interval probe. */
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    env: env.NODE_ENV,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

/** Readiness: can we actually serve traffic? Touches the database. */
router.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready", database: "up" });
  } catch (err) {
    console.error("[health] database unreachable:", err.message);
    res.status(503).json({ status: "degraded", database: "down" });
  }
});

export default router;
