import { test, expect } from "../helpers/setup";
import {
  executeCommand,
  createFile,
  openFile,
  waitForFileCreation,
  getFrontMatter,
  expectNotice,
} from "../helpers/global";

test.describe("Task Creation with Context Defaults", () => {
  test("prefills Project from Projects/<Project>/ context and shows contextual title", async ({
    page,
  }) => {
    // Arrange: ensure project folder and context file exist and are active
    await page.evaluate(async () => {
      const app = (window as any).app;
      const folderPath = "Projects/Alpha";
      const exists = await app.vault.adapter.exists(folderPath);
      if (!exists) {
        await app.vault.createFolder(folderPath);
      }
    });
    await createFile(
      page,
      "Projects/Alpha/index.md",
      { Title: "Alpha" },
      "# Alpha\n"
    );
    await openFile(page, "Projects/Alpha/index.md");

    // Act: invoke Create Task command
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Assert: modal title indicates project context
    await expect(page.locator(".task-sync-modal-header h2")).toContainText(
      "Create Task for Project: Alpha"
    );

    // Fill in title and create
    const title = "Task in Alpha";
    await page.fill('[data-testid="property-title"]', title);
    await page.click('[data-testid="submit-button"]');

    await expect(page.locator(".task-sync-modal-container")).toBeHidden();
    await expectNotice(page, "created successfully");

    // Verify file and front-matter
    const expectedPath = `Tasks/${title}.md`;
    await waitForFileCreation(page, expectedPath);
    const fm = await getFrontMatter(page, expectedPath);
    expect(fm.Project).toBe("Alpha");
  });

  test("prefills Areas from Areas/<Area>/ context and shows contextual title", async ({
    page,
  }) => {
    // Arrange: ensure area folder and context file exist and are active
    await page.evaluate(async () => {
      const app = (window as any).app;
      const folderPath = "Areas/Marketing";
      const exists = await app.vault.adapter.exists(folderPath);
      if (!exists) {
        await app.vault.createFolder(folderPath);
      }
    });
    await createFile(
      page,
      "Areas/Marketing/index.md",
      { Title: "Marketing" },
      "# Marketing\n"
    );
    await openFile(page, "Areas/Marketing/index.md");

    // Act: invoke Create Task command
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Assert: modal title indicates area context
    await expect(page.locator(".task-sync-modal-header h2")).toContainText(
      "Create Task for Area: Marketing"
    );

    // Fill in title and create
    const title = "Task in Marketing";
    await page.fill('[data-testid="property-title"]', title);
    await page.click('[data-testid="submit-button"]');

    await expect(page.locator(".task-sync-modal-container")).toBeHidden();
    await expectNotice(page, "created successfully");

    // Verify file and front-matter
    const expectedPath = `Tasks/${title}.md`;
    await waitForFileCreation(page, expectedPath);
    const fm = await getFrontMatter(page, expectedPath);
    expect(Array.isArray(fm.Areas)).toBe(true);
    expect(fm.Areas).toContain("Marketing");
  });

  test("prefills Parent task when invoked from within a task file", async ({
    page,
  }) => {
    // Arrange: create a parent task file and open it
    const parentTitle = "Parent task For Subtask";
    await createFile(
      page,
      `Tasks/${parentTitle}.md`,
      {
        Title: parentTitle,
        Category: "Task",
        Type: "Task",
        Status: "Backlog",
      },
      `---\nTitle: ${parentTitle}\nCategory: Task\nType: Task\nStatus: Backlog\n---\n`
    );
    await openFile(page, `Tasks/${parentTitle}.md`);

    // Act: invoke Create Task command
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // When opening from a task file, contextual title should indicate subtask
    await expect(page.locator(".task-sync-modal-header h2")).toContainText(
      `Create Subtask of: ${parentTitle}`
    );

    // Fill in the subtask title and create
    const childTitle = "Child of Parent";
    await page.fill('[data-testid="property-title"]', childTitle);
    await page.click('[data-testid="submit-button"]');

    await expect(page.locator(".task-sync-modal-container")).toBeHidden();
    await expectNotice(page, "created successfully");

    // Verify file and front-matter; Parent task should be wiki link (single-value association)
    const expectedPath = `Tasks/${childTitle}.md`;
    await waitForFileCreation(page, expectedPath);
    const fm = await getFrontMatter(page, expectedPath);
    expect(fm["Parent task"]).toBe(
      `[[Tasks/${parentTitle}.md|${parentTitle}]]`
    );
  });
});
