import { test, expect } from "@playwright/test";
import {
  createProject,
  deleteProject,
  editorText,
  openFile,
  typeAtTop,
  uniqueName,
  withSignedInPage,
} from "./helpers";

/**
 * The critical path a new user actually walks: create a project, open a file,
 * edit it, save it, and navigate with the keyboard.
 */
test.describe("workspace", () => {
  const projectName = uniqueName("ws");
  let projectId = "";

  test.beforeAll(async ({ browser }) => {
    await withSignedInPage(browser, async (page) => {
      projectId = await createProject(page, "Blank starter", projectName);
    });
  });

  test.afterAll(async ({ browser }) => {
    await withSignedInPage(browser, (page) => deleteProject(page, projectName));
  });

  test.beforeEach(async ({ page }) => {
    // Go straight to the project under test rather than clicking whichever
    // card happens to sort first.
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible();
  });

  test("shows the project tree and opens a file into a tab", async ({ page }) => {
    await expect(page.getByRole("treeitem", { name: /package\.json/ })).toBeVisible();

    await openFile(page, ["app", "page.tsx"]);

    await expect(page.getByRole("tab", { name: /page\.tsx/ })).toBeVisible();
    await expect(page.locator(".monaco-editor")).toBeVisible();
  });

  test("marks a file dirty on edit and clears it on save", async ({ page }) => {
    await openFile(page, ["app", "page.tsx"]);
    await page.locator(".monaco-editor").click();
    await page.keyboard.type("// edited by the e2e suite\n");

    // The header only offers Save while something is unsaved.
    const save = page.getByRole("button", { name: /^Save/ });
    await expect(save).toBeVisible();

    await page.keyboard.press("Control+s");
    await expect(page.getByText(/Saved page\.tsx/)).toBeVisible();
    await expect(save).toBeHidden();
  });

  test("keeps edits after a reload once saved", async ({ page }) => {
    await openFile(page, ["app", "page.tsx"]);
    const marker = `// persisted ${Date.now()}`;

    await page.locator(".monaco-editor").click();
    await page.keyboard.type(`${marker}\n`);
    await page.keyboard.press("Control+s");
    await expect(page.getByText(/Saved page\.tsx/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("tree", { name: "Project files" })).toBeVisible({ timeout: 45_000 });
    await openFile(page, ["app", "page.tsx"]);

    // Monaco streams its own bundle and then the model, so give the rendered
    // lines their own poll rather than racing the default assertion timeout.
    await expect.poll(() => editorText(page), { timeout: 45_000 }).toContain(marker);
  });

  test("opens the command palette and jumps to a file", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+p");
    const finder = page.getByRole("dialog", { name: "Go to file" });
    await expect(finder).toBeVisible();

    await page.keyboard.type("layout");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("tab", { name: /layout\.tsx/ })).toBeVisible();
  });

  test("toggles panels from the keyboard", async ({ page }) => {
    const assistant = page.getByRole("complementary").filter({ hasText: "Assistant" });

    await page.keyboard.press("Control+i");
    await expect(assistant).toBeHidden();

    await page.keyboard.press("Control+i");
    await expect(assistant).toBeVisible();
  });

  test("creates and deletes a file", async ({ page }) => {
    const fileName = `scratch-${Date.now()}.ts`;

    await page.getByRole("button", { name: "New file" }).first().click();
    await page.getByRole("dialog").getByRole("textbox").fill(fileName);
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByRole("treeitem", { name: new RegExp(fileName) })).toBeVisible();

    const node = page.getByRole("treeitem", { name: new RegExp(fileName) });
    await node.hover();
    await page.getByRole("button", { name: `Delete ${fileName}` }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("treeitem", { name: new RegExp(fileName) })).toHaveCount(0);
  });

  test("warns before discarding unsaved changes", async ({ page }) => {
    await openFile(page, ["app", "page.tsx"]);
    await page.locator(".monaco-editor").click();
    await page.keyboard.type("// unsaved\n");

    await page.getByRole("tab", { name: /page\.tsx/ }).getByRole("button").click();

    await expect(page.getByText(/Discard changes to page\.tsx/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("tab", { name: /page\.tsx/ })).toBeVisible();
  });
});
