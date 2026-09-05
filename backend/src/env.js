import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// Fail fast and loudly at boot rather than with a confusing 500 on the first
// request. Every value the app reads from the environment is declared here.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),

  /// Comma-separated list of origins allowed to call the API.
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  /// Where project files are written. Relative paths resolve from backend/.
  STORAGE_DIR: z.string().default("./storage/users"),

  /// Guard rails for the agent loop.
  AGENT_MAX_STEPS: z.coerce.number().int().positive().default(12),
  AGENT_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(15),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  console.error(`\n[env] Invalid backend environment configuration:\n${issues}\n`);
  console.error("Copy backend/.env.example to backend/.env and fill in the values.\n");
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
