import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "tests/**/*.test.js"],
    env: {
      NODE_ENV: "test",
      // Values only need to satisfy env.js validation; nothing here talks to a
      // real service. Integration tests stub the Prisma and Groq boundaries.
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      CLERK_SECRET_KEY: "sk_test_dummy",
      GROQ_API_KEY: "gsk_test_dummy",
      STORAGE_DIR: "./storage/.test",
    },
  },
});
