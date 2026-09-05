import path from "node:path";
import { expect, type Browser, type Page } from "@playwright/test";

/** Where auth.setup.ts caches the signed-in session. */
export const STORAGE_STATE = path.join(process.cwd(), "e2e/.auth/user.json");

/**
 * Run something in a signed-in page outside a test body.
 *
 * `browser.newPage()` opens an *anonymous* context — it does not inherit the
 * project's `storageState`, so `beforeAll`/`afterAll` hooks would run signed
 * out. This builds the context explicitly.
 */
export async function withSignedInPage(browser: Browser, fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await context.newPage();
  try {
    await fn(page);
  } finally {
    await context.close();
  }
}

/** A name unlikely to collide with a leftover project from a previous run. */
export function uniqueName(prefix = "e2e"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Create a project from a template and land in its workspace. */
export async function createProject(page: Page, template: string, name: string) {
  await page.goto("/projects");

  const card = page.getByText(template, { exact: true });
  await expect(card).toBeVisible();

  const nameField = page.getByLabel("Project name");
  // The card is a client component; a click that lands before hydration is
  // swallowed, so retry until the dialog actually opens.
  await expect(async () => {
    await card.click();
    await expect(nameField).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  await nameField.fill(name);
  await page.getByRole("button", { name: "Create project" }).click();

  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();

  return page.url().split("/").pop()!;
}

/** Remove a project so a run leaves no residue behind. */
export async function deleteProject(page: Page, name: string) {
  await page.goto("/projects");
  const card = page.locator("div").filter({ hasText: new RegExp(`^${name}`) }).last();
  const button = page.getByRole("button", { name: `Delete ${name}` });

  if ((await button.count()) === 0) return;
  await card.hover();
  await button.click();
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByRole("heading", { name: name, exact: true })).toHaveCount(0);
}

/** Open a file from the explorer, expanding folders along the way. */
export async function openFile(page: Page, segments: string[]) {
  for (const segment of segments.slice(0, -1)) {
    await page.getByRole("treeitem", { name: new RegExp(`^${segment}`) }).first().click();
    await page.waitForTimeout(250);
  }
  const leaf = segments[segments.length - 1];
  await page.getByRole("treeitem", { name: new RegExp(leaf.replace(".", "\\.")) }).first().click();
}

/**
 * Type at the very start of the open file.
 *
 * Clicking the editor's centre drops the caret wherever that happens to be, so
 * the inserted text can land off-screen — and Monaco virtualises its lines, so
 * anything scrolled out of view is simply absent from the DOM. Homing first
 * keeps assertions against the rendered text deterministic.
 */
export async function typeAtTop(page: Page, text: string) {
  const editor = page.locator(".monaco-editor").first();
  await editor.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type(text);
}

/**
 * Read the editor's rendered text with whitespace normalised.
 *
 * Monaco renders indentation with non-breaking spaces, so `innerText` comes
 * back with U+00A0 where the source has U+0020 — a plain `toContain` against
 * the text you typed will fail on a string that looks identical.
 */
export async function editorText(page: Page): Promise<string> {
  const raw = await page.locator(".monaco-editor .view-lines").first().innerText().catch(() => "");
  return raw.replace(/ /g, " ");
}
