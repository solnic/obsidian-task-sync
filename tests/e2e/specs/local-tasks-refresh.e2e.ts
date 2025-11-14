/**
 * E2E tests for LocalTasksService refresh functionality
 * Tests that the refresh button shows loading indicators and triggers sync
 */

import { test, expect } from "../helpers/setup";
import {
  openTasksView,
  waitForLocalTasksToLoad,
  refreshTasks,
} from "../helpers/tasks-view-helpers";
import { createTask } from "../helpers/entity-helpers";

test.describe("LocalTasksService Refresh", () => {
  test("should refresh tasks successfully when refresh button is clicked", async ({
    page,
  }) => {
    // Create a test task first
    await createTask(page, {
      title: "Refresh Test Task",
      category: "Feature",
      priority: "Medium",
    });

    // Open Tasks view and wait for local tasks to load
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify task is present
    await page.waitForSelector(
      '.task-sync-item-title:has-text("Refresh Test Task")',
      { timeout: 2500 }
    );

    // Create another task directly in the vault (simulating external change)
    await page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create(
        "Tasks/External Refresh Task.md",
        `---
Title: External Refresh Task
Type: Task
Category: Bug
Priority: High
Status: In Progress
Done: false
---

Task created directly in vault for refresh test.`
      );
    });

    // Click refresh button
    const refreshButton = page.locator(
      '[data-testid="task-sync-local-refresh-button"]'
    );
    await refreshButton.click();

    // Wait for refresh to complete and new task to appear
    await page.waitForSelector(
      '.task-sync-item-title:has-text("External Refresh Task")',
      { timeout: 2500 }
    );

    // Verify both tasks are present after refresh
    const originalTask = await page
      .locator('.task-sync-item-title:has-text("Refresh Test Task")')
      .count();
    const newTask = await page
      .locator('.task-sync-item-title:has-text("External Refresh Task")')
      .count();

    expect(originalTask).toBe(1);
    expect(newTask).toBe(1);
  });

  test("should handle refresh errors gracefully", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Mock a refresh error by temporarily breaking the extension
    await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const originalRefresh = plugin.host.getExtensionById("obsidian").refresh;

      // Temporarily replace refresh with a failing function
      plugin.host.getExtensionById("obsidian").refresh = async () => {
        throw new Error("Simulated refresh error");
      };

      // Restore after a short delay
      setTimeout(() => {
        plugin.host.getExtensionById("obsidian").refresh = originalRefresh;
      }, 100);
    });

    // Click refresh button
    const refreshButton = page.locator(
      '[data-testid="task-sync-local-refresh-button"]'
    );
    await refreshButton.click();

    // Wait for error to appear
    await page.waitForSelector(".task-sync-error-message", {
      state: "visible",
      timeout: 2500,
    });

    // Verify error message is displayed
    const errorMessage = await page
      .locator(".task-sync-error-message")
      .textContent();
    expect(errorMessage).toContain("Simulated refresh error");

    // Verify loading indicator is no longer visible
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    const isLoadingVisible = await loadingIndicator.isVisible();
    expect(isLoadingVisible).toBe(false);
  });
});
