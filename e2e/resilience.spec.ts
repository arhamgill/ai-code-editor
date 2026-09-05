import { test, expect } from "@playwright/test";

/**
 * Regression cover for the failure that made the app unusable: the landing
 * page gated its navigation on Clerk's `isLoaded`, so if clerk.accounts.dev
 * was slow, blocked by an extension, or rate-limited, visitors were left with
 * two skeletons and no way in.
 *
 * These run signed out with Clerk's origins aborted.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("degrades when Clerk is unreachable", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**://*.clerk.accounts.dev/**", (route) => route.abort());
    await page.route("**://*.clerk.com/**", (route) => route.abort());
  });

  test("landing page still offers a way into the app", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ship Next.js features");

    // The signed-out affordance must render without waiting on Clerk.
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Start building free/ })).toBeVisible();

    // And nothing may be left spinning in its place.
    await expect(page.locator(".skeleton")).toHaveCount(0);
  });

  test("the primary call to action actually navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Start building free/ }).click();
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test("a gated route explains itself instead of spinning forever", async ({ page }) => {
    await page.goto("/projects");

    await expect(page.getByText(/Can't reach the sign-in service/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  });
});
