import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";

import { env, corsOrigins, isProd, isTest } from "./env.js";
import { errorHandler, notFoundHandler, asyncHandler } from "./lib/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { apiLimiter } from "./middleware/rateLimit.js";

import healthRouter from "./routes/health.js";
import projectsRouter from "./routes/projects.js";
import chatsRouter from "./routes/chats.js";
import agentRouter from "./routes/agent.js";

export function createApp() {
  const app = express();

  // Behind a proxy (Railway, Render, Fly) the client IP arrives in a header;
  // without this the rate limiter would key every request to the proxy.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // The API serves JSON, never HTML, so CSP has nothing to protect here and
      // COEP would break the cross-origin fetches the editor depends on.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      // An allowlist, not `cors()`. With the wildcard, any page the user
      // visited could call this API with their session token.
      origin(origin, callback) {
        if (!origin) return callback(null, true); // curl, health checks, same-origin
        if (corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true,
      maxAge: 86_400,
    })
  );

  app.use(compression());
  app.use(express.json({ limit: "25mb" }));

  if (!isTest) {
    app.use(morgan(isProd ? "combined" : "dev"));
  }

  app.use("/api", healthRouter);

  app.use(clerkMiddleware());

  // Everything below requires a signed-in user and a provisioned DB row.
  app.use("/api", apiLimiter, requireAuth);

  app.get(
    "/api/me",
    asyncHandler(async (req, res) => {
      res.json({ id: req.dbUser.id, email: req.dbUser.email, createdAt: req.dbUser.createdAt });
    })
  );

  app.use("/api/projects", projectsRouter);
  app.use("/api/projects/:projectId/chats", chatsRouter);
  app.use("/api/agent", agentRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { env };
