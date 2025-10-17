/**
 * E2E tests for comprehensive refresh command
 * Tests that the improved "Refresh Tasks" command properly rebuilds all data
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  executeCommand,
  fileExists,
  readVaultFile,
  waitForFileUpdate,
  waitForNotice,
} from "../../helpers/global";
import { createTask } from "../../helpers/entity-helpers";

test.describe("Comprehensive Refresh", () => {
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
    await executeCommand(page, "Task Sync: Refresh Tasks");

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

  test("should show comprehensive refresh results", async ({ page }) => {
    // Create a task to ensure there's something to refresh
    await createTask(page, {
      title: "Refresh Results Test",
      description: "Testing refresh results display",
      status: "Not Started",
      priority: "Low",
      done: false,
    });

    // Listen for console messages during refresh
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Task Sync:") || msg.text().includes("refresh")) {
        consoleMessages.push(msg.text());
      }
    });

    // Execute the comprehensive refresh command
    await executeCommand(page, "Task Sync: Refresh Tasks");

    // Wait for the refresh to complete by waiting for console messages
    await page.waitForFunction(
      () => {
        // Check if we have any refresh-related console messages
        return (
          (window as any).testConsoleMessages &&
          (window as any).testConsoleMessages.length > 0
        );
      },
      undefined,
      { timeout: 5000 }
    );

    // Check that we captured some refresh-related console messages
    expect(consoleMessages.length).toBeGreaterThan(0);

    // Verify we see the expected refresh messages
    const hasStartMessage = consoleMessages.some((msg) =>
      msg.includes("Starting comprehensive refresh operation")
    );
    const hasCompleteMessage = consoleMessages.some((msg) =>
      msg.includes("Comprehensive refresh completed successfully")
    );

    expect(hasStartMessage || hasCompleteMessage).toBe(true);
  });
});
