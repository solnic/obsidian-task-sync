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
} from "../../../helpers/global";
import {
  createTask,
  createTaskEntityWithoutFile,
} from "../../../helpers/entity-helpers";

test.describe("Commands / Task Refresh", () => {
  test("should rebuild all task data and fix missing properties", async ({
    page,
  }) => {
    // Create a task first
    const task = await createTask(page, {
      title: "Test Refresh Task",
      description: "A task to test the comprehensive refresh",
      status: "Not Started",
      priority: "Medium",
      done: false,
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Test Refresh Task");

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/Test Refresh Task.md");
    expect(taskExists).toBe(true);

    // Read the initial file content
    const initialContent = await readVaultFile(
      page,
      "Tasks/Test Refresh Task.md"
    );
    expect(initialContent).toBeTruthy();
    expect(initialContent).toContain("Test Refresh Task");
    expect(initialContent).toContain(
      "A task to test the comprehensive refresh"
    );

    // Simulate file corruption by removing a required property
    await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);

      if (file) {
        const content = await app.vault.read(file);
        // Remove the "Status" property to simulate corruption
        const corruptedContent = content.replace(/^Status:.*$/m, "");
        await app.vault.modify(file, corruptedContent);
      }
    }, "Tasks/Test Refresh Task.md");

    // Verify the property was removed
    const corruptedContent = await readVaultFile(
      page,
      "Tasks/Test Refresh Task.md"
    );
    expect(corruptedContent).not.toContain("Status:");

    // Execute the comprehensive refresh command
    await executeCommand(page, "Refresh Tasks");

    // Wait for the refresh to complete by waiting for file to be updated
    await waitForFileUpdate(
      page,
      "Tasks/Test Refresh Task.md",
      "Status: Backlog"
    );

    // Verify the file was repaired
    const repairedContent = await readVaultFile(
      page,
      "Tasks/Test Refresh Task.md"
    );
    expect(repairedContent).toBeTruthy();
    expect(repairedContent).toContain("Status:");
    expect(repairedContent).toContain("Test Refresh Task");
    expect(repairedContent).toContain(
      "A task to test the comprehensive refresh"
    );

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
      '.task-sync-item-title:has-text("Test Refresh Task")',
      {
        timeout: 5000,
      }
    );

    // Check that the task appears in the local tasks view
    const taskInUI = await page
      .locator('.task-sync-item-title:has-text("Test Refresh Task")')
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

    // Wait for the file to be created
    await waitForFileCreation(page, "Tasks/Task Without File.md");

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
});
