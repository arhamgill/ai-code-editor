import fs from "fs/promises";

import { createApp, env } from "./app.js";
import prisma from "./db.js";
import { STORAGE_ROOT } from "./lib/paths.js";

async function main() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[server] Forge API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`[server] Project files: ${STORAGE_ROOT}`);
  });

  // Long-lived SSE streams will otherwise keep the process alive forever on a
  // deploy; give in-flight work a few seconds, then stop waiting.
  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down…`);
    const force = setTimeout(() => {
      console.warn("[server] Forcing exit after 10s grace period.");
      process.exit(1);
    }, 10_000).unref();

    server.close(async () => {
      clearTimeout(force);
      await prisma.$disconnect().catch(() => {});
      console.log("[server] Closed cleanly.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("[server] Unhandled promise rejection:", reason);
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
