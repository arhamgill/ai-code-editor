import { test, expect } from "@playwright/test";
import { deleteProject, uniqueName } from "./helpers";

test.describe("projects", () => {
  test("landing page renders and links into the app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ship Next.js features");

    // The CTA label depends on Clerk having resolved the session, which is a
    // client round trip on a cold page.
    await expect(page.getByRole("link", { name: /Open your workspace/ }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("lists templates and creates a project", async ({ page }) => {
    const name = uniqueName("tpl");

    await page.goto("/projects");
    await expect(page.getByText("Blank starter")).toBeVisible();
    await expect(page.getByText("Marketing site")).toBeVisible();
    await expect(page.getByText("Dashboard")).toBeVisible();

    await page.getByText("Blank starter", { exact: true }).click();
    await page.getByLabel("Project name").fill(name);
    await page.getByRole("button", { name: "Create project" }).click();

    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();

    await deleteProject(page, name);
  });

  /**
   * The regression that made the product unusable for every new account: the
   * User row was never provisioned, so the first create died on a foreign-key
   * violation that the UI swallowed silently.
   */
  test("surfaces a server error instead of failing silently", async ({ page }) => {
    await page.goto("/projects");
    await page.route("**/api/projects", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "internal_error", message: "Something went wrong on our end." } }),
      });
    });

    await page.getByText("Blank starter", { exact: true }).click();
    await page.getByLabel("Project name").fill(uniqueName("fail"));
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page.getByRole("status").filter({ hasText: /went wrong/i })).toBeVisible();
  });

  test("rejects a duplicate project name with a clear message", async ({ page }) => {
    const name = uniqueName("dup");

    await page.goto("/projects");
    await page.getByText("Blank starter", { exact: true }).click();
    await page.getByLabel("Project name").fill(name);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 60_000 });

    await page.goto("/projects");
    await page.getByText("Blank starter", { exact: true }).click();
    await page.getByLabel("Project name").fill(name);
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page.getByRole("status").filter({ hasText: /already have a project/i })).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await deleteProject(page, name);
  });

  test("404s a project that does not exist", async ({ page }) => {
    await page.goto("/projects/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText(/doesn't exist/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to projects" })).toBeVisible();
  });
});
