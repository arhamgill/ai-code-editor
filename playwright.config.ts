import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

/**
 * Reuse the app's own env files so the suite needs no separate configuration —
 * but copy across only the keys the suite actually needs.
 *
 * A blanket `dotenv.config()` also imports `NODE_ENV=development` from
 * backend/.env, and that leaks into the servers Playwright spawns: `next start`
 * then serves a production build while believing it is in development.
 */
for (const path of ["backend/.env", "frontend/.env.local"]) {
  const parsed = dotenv.config({ path, processEnv: {} }).parsed ?? {};
  for (const key of [
    "CLERK_SECRET_KEY",
    "CLERK_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "E2E_USER_EMAIL",
    "E2E_USER_PASSWORD",
    "E2E_BASE_URL",
  ]) {
    if (parsed[key] && !process.env[key]) process.env[key] = parsed[key];
  }
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // A shared Clerk account and one storage bucket per user means parallel
  // specs would fight over the same project list.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  // Clerk development instances rate-limit repeated sign-ins and occasionally
  // fail to mount their card, so one retry keeps the suite honest without
  // masking real failures.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
  },

  projects: [
    // Signs in once and writes the storage state every other spec reuses.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],

  /**
   * Boot both servers automatically.
   *
   * The frontend runs a **production** build, not `next dev`. Turbopack's dev
   * server recompiles on demand and restarts itself when it nears its memory
   * ceiling, which showed up as different specs failing on blank pages from
   * one run to the next. `next start` is also several times faster per
   * navigation, so the whole suite is quicker as well.
   *
   * Set E2E_USE_DEV_SERVER=1 to point the suite at an already-running dev
   * server while iterating on a test.
   */
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "npm run dev --prefix backend",
          url: "http://localhost:5000/api/health",
          reuseExistingServer: true,
          timeout: 60_000,
        },
        {
          // `npm run e2e` builds the frontend first, so this only has to serve
          // it. Chaining the build in here made the failure mode opaque when
          // the build itself went wrong.
          command: process.env.E2E_USE_DEV_SERVER
            ? "npm run dev --prefix frontend"
            : "npm run start --prefix frontend",
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 180_000,
        },
      ],
});
