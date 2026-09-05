/**
 * Provision (or reuse) the Clerk account the e2e suite signs in as.
 *
 * The address deliberately uses Clerk's `+clerk_test` convention: those
 * addresses never send real email and always accept the fixed verification
 * code `424242`, which is what lets the suite get past the "new device"
 * challenge without an inbox.
 *
 * Run with:  npm run e2e:user
 */
import { createClerkClient } from "@clerk/backend";

const EMAIL = process.env.E2E_USER_EMAIL ?? "forge.e2e+clerk_test@example.com";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "ForgeE2E!test-2026-xyz";

if (!EMAIL.includes("+clerk_test")) {
  console.warn(
    `[e2e] ${EMAIL} is not a +clerk_test address. Sign-in will require a real emailed code.`
  );
}

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  console.error("CLERK_SECRET_KEY is not set. Add it to backend/.env first.");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey });

const existing = await clerk.users.getUserList({ emailAddress: [EMAIL] });
let user = existing.data[0];

if (user) {
  console.log(`[e2e] Reusing existing test user ${user.id} (${EMAIL})`);
} else {
  user = await clerk.users.createUser({
    emailAddress: [EMAIL],
    password: PASSWORD,
    firstName: "Forge",
    lastName: "Tester",
    skipPasswordChecks: true,
  });
  console.log(`[e2e] Created test user ${user.id} (${EMAIL})`);
}

console.log("\nAdd these to your environment (or backend/.env) before running the suite:\n");
console.log(`  E2E_USER_EMAIL=${EMAIL}`);
console.log(`  E2E_USER_PASSWORD=${PASSWORD}\n`);
