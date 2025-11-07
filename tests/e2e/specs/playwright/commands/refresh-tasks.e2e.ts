/**
 * E2E tests for comprehensive refresh command
 * Tests that the improved "Refresh Tasks" command properly rebuilds all data
 */

import { test, expect } from "../../../helpers/setup";
import {
  openView,
  executeCommand,
  fileExists,
  readVaultFile,
  waitForFileUpdate,
  waitForFileCreation,
  waitForFileContentToContain,
  replaceFileFrontmatter,
} from "../../../helpers/global";
import {
  createTask,
  createTaskEntityWithoutFile,
  createTaskWithSource,
  getTaskByTitle,
} from "../../../helpers/entity-helpers";

test.describe("Commands / Task Refresh", () => {
  test("should rebuild all task data and fix missing properties", async ({
    page,
  }) => {
    await replaceFileFrontmatter(page, "Tasks/Sample Task 1.md", {
      Title: "Sample Task 1",
      Type: "Task"
    });

    // Execute the comprehensive refresh command
    await executeCommand(page, "Refresh Tasks");

    // Wait for the refresh to complete by waiting for file to be updated
    await waitForFileUpdate(
      page,
      "Tasks/Sample Task 1.md",
      "Status: Backlog"
    );

    // Verify the file was repaired
    const repairedContent = await readVaultFile(
      page,
      "Tasks/Sample Task 1.md"
    );
    expect(repairedContent).toBeTruthy();
    expect(repairedContent).toContain("Status:");
    expect(repairedContent).toContain("Sample Task 1");

    // Verify the task still appears in the UI
    await openView(page, "task-sync-main");

    // Switch to Local Tasks tab (Context tab is default)
    const localServiceButton = page.locator('[data-testid="service-local"]');
    await localServiceButton.click();

    // Wait for local service to be visible
    await page.waitForSelector('[data-testid="local-service"]', {
      state: "visible",
      timeout: 5000,
    });

    // Wait for tasks to load by checking for the task to appear
    await page.waitForSelector(
      '.task-sync-item-title:has-text("Sample Task 1")',
      {
        timeout: 5000,
      }
    );

    // Check that the task appears in the local tasks view
    const taskInUI = await page
      .locator('.task-sync-item-title:has-text("Sample Task 1")')
      .count();
    expect(taskInUI).toBe(1);
  });

  test("should recreate files for entities with non-existent file paths", async ({
    page,
  }) => {
    // Create a task entity directly in the store without creating a file
    // This simulates the scenario where data.json has a task but the file is missing
    const task = await createTaskEntityWithoutFile(page, {
      title: "Task Without File",
      description: "This task has no file",
      status: "In Progress",
      priority: "High",
      filePath: "Tasks/Task Without File.md",
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Task Without File");
    expect(task.source.keys.obsidian).toBe("Tasks/Task Without File.md");

    // Verify the file doesn't exist
    const fileExistsBefore = await fileExists(
      page,
      "Tasks/Task Without File.md"
    );
    expect(fileExistsBefore).toBe(false);

    // Execute the refresh tasks command
    await executeCommand(page, "Refresh Tasks");

    // Wait for the file to be created with proper timeout
    await waitForFileCreation(page, "Tasks/Task Without File.md", 10000);

    // Wait for the file content to be fully written
    await waitForFileContentToContain(
      page,
      "Tasks/Task Without File.md",
      "Task Without File"
    );

    // Verify the file was created
    const fileExistsAfter = await fileExists(
      page,
      "Tasks/Task Without File.md"
    );
    expect(fileExistsAfter).toBe(true);

    // Verify the file has correct content
    const content = await readVaultFile(page, "Tasks/Task Without File.md");
    expect(content).toBeTruthy();
    expect(content).toContain("Task Without File");
    expect(content).toContain("This task has no file");
    expect(content).toContain("Status: In Progress");
    expect(content).toContain("Priority: High");
  });

  test("should remove obsolete front-matter properties", async ({ page }) => {
    // Create a task first
    const task = await createTask(page, {
      title: "Task With Obsolete Props",
      description: "This task will have obsolete properties added",
      status: "Backlog",
      priority: "Low",
      done: false,
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Task With Obsolete Props");

    // Verify task file was created
    const taskExists = await fileExists(
      page,
      "Tasks/Task With Obsolete Props.md"
    );
    expect(taskExists).toBe(true);

    // Add obsolete properties to the front-matter
    await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);

      if (file) {
        await app.fileManager.processFrontMatter(file, (frontMatter: any) => {
          // Add some obsolete properties
          frontMatter["ObsoleteProperty1"] = "should be removed";
          frontMatter["OldField"] = "also should be removed";
          frontMatter["DeprecatedKey"] = 123;
        });
      }
    }, "Tasks/Task With Obsolete Props.md");

    // Verify the obsolete properties were added
    const contentWithObsolete = await readVaultFile(
      page,
      "Tasks/Task With Obsolete Props.md"
    );
    expect(contentWithObsolete).toContain("ObsoleteProperty1");
    expect(contentWithObsolete).toContain("OldField");
    expect(contentWithObsolete).toContain("DeprecatedKey");

    // Execute the refresh tasks command
    await executeCommand(page, "Refresh Tasks");

    // Wait for the file to be updated (check that valid properties are still there)
    await waitForFileContentToContain(
      page,
      "Tasks/Task With Obsolete Props.md",
      "Status: Backlog"
    );

    // Verify the obsolete properties were removed
    const cleanedContent = await readVaultFile(
      page,
      "Tasks/Task With Obsolete Props.md"
    );
    expect(cleanedContent).not.toContain("ObsoleteProperty1");
    expect(cleanedContent).not.toContain("OldField");
    expect(cleanedContent).not.toContain("DeprecatedKey");

    // Verify valid properties are still there
    expect(cleanedContent).toContain("Task With Obsolete Props");
    expect(cleanedContent).toContain("Status: Backlog");
    expect(cleanedContent).toContain("Priority: Low");
  });

  test("should preserve source.extension for GitHub tasks during refresh", async ({
    page,
  }) => {
    // Create a task with GitHub source extension
    const githubTask = await createTaskWithSource(page, {
      title: "GitHub Task for Refresh Test",
      description: "This task is from GitHub",
      category: "Bug",
      status: "In Progress",
      priority: "High",
      source: {
        extension: "github",
        keys: {
          github: "https://github.com/test/repo/issues/123",
        },
        data: {
          id: 123,
          number: 123,
          html_url: "https://github.com/test/repo/issues/123",
          title: "GitHub Task for Refresh Test",
          state: "open",
        },
      },
    });

    expect(githubTask).toBeTruthy();
    expect(githubTask.title).toBe("GitHub Task for Refresh Test");
    expect(githubTask.source.extension).toBe("github");

    // Verify task file was created
    const taskExists = await fileExists(
      page,
      "Tasks/GitHub Task for Refresh Test.md"
    );
    expect(taskExists).toBe(true);

    // Verify initial source.extension is 'github'
    const initialTask = await getTaskByTitle(
      page,
      "GitHub Task for Refresh Test"
    );
    expect(initialTask).toBeDefined();
    expect(initialTask.source.extension).toBe("github");
    expect(initialTask.source.keys.github).toBe(
      "https://github.com/test/repo/issues/123"
    );

    // Execute the refresh tasks command
    await executeCommand(page, "Refresh Tasks");

    // Wait for the refresh to complete by waiting for file to be updated
    await waitForFileUpdate(
      page,
      "Tasks/GitHub Task for Refresh Test.md",
      "Status: In Progress"
    );

    // Verify the task still has source.extension set to 'github' after refresh
    const refreshedTask = await getTaskByTitle(
      page,
      "GitHub Task for Refresh Test"
    );
    expect(refreshedTask).toBeDefined();
    expect(refreshedTask.source.extension).toBe("github");
    expect(refreshedTask.source.keys.github).toBe(
      "https://github.com/test/repo/issues/123"
    );

    // Verify the file still exists and has correct content
    const content = await readVaultFile(
      page,
      "Tasks/GitHub Task for Refresh Test.md"
    );
    expect(content).toBeTruthy();
    expect(content).toContain("GitHub Task for Refresh Test");
    expect(content).toContain("This task is from GitHub");
    expect(content).toContain("Status: In Progress");
    expect(content).toContain("Priority: High");
  });
});
