import { PrismaClient } from "@prisma/client";
import { isProd } from "./env.js";

// Next.js-style singleton: nodemon reloads this module on every save, and a new
// PrismaClient per reload exhausts the database's connection pool within a few
// minutes of active development.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__forgePrisma ??
  new PrismaClient({
    log: isProd ? ["error"] : ["error", "warn"],
  });

if (!isProd) globalForPrisma.__forgePrisma = prisma;

export default prisma;
