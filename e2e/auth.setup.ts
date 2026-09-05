import { test as setup, expect } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { STORAGE_STATE } from "./helpers";

/**
 * Sign in once and cache the session for every other spec.
 *
 * Uses a Clerk *test* email (`+clerk_test`), which lets the suite satisfy the
 * new-device email verification step with the fixed code `424242` instead of
 * needing a real inbox. `setupClerkTestingToken` bypasses bot protection.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set. Run `npm run e2e:user` to provision a test account."
    );
  }

  await clerkSetup({
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  await setupClerkTestingToken({ page });

  await page.goto("/sign-in");

  // Clerk mounts its card asynchronously; interacting before it is ready hits
  // an empty page shell.
  await page.waitForFunction(() => !!window.Clerk?.loaded, null, { timeout: 45_000 });

  // A previously trusted session short-circuits the whole form.
  if (await page.evaluate(() => !!window.Clerk?.user)) {
    await page.context().storageState({ path: STORAGE_STATE });
    return;
  }

  const identifier = page.getByLabel(/email|identifier/i).first();
  await identifier.waitFor({ state: "visible", timeout: 30_000 });
  await identifier.fill(email);
  await page.getByRole("button", { name: /continue/i }).click();

  const passwordField = page.getByLabel(/password/i).first();
  await passwordField.waitFor({ state: "visible", timeout: 30_000 });
  await passwordField.fill(password);
  await page.getByRole("button", { name: /continue|sign in/i }).first().click();

  // Clerk challenges an unrecognised device with an emailed code. Test
  // addresses always accept 424242, so satisfy the step when it appears —
  // it does not on an already-trusted device, hence the race against sign-in.
  const otpField = page.getByRole("textbox", { name: /verification code/i });
  await Promise.race([
    otpField.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {}),
    page.waitForFunction(() => !!window.Clerk?.user, null, { timeout: 20_000 }).catch(() => {}),
  ]);

  if (await otpField.isVisible().catch(() => false)) {
    await otpField.click();
    await page.keyboard.type("424242", { delay: 40 });
  }

  await expect
    .poll(() => page.evaluate(() => !!window.Clerk?.user), { timeout: 45_000 })
    .toBe(true);

  await page.context().storageState({ path: STORAGE_STATE });
});
