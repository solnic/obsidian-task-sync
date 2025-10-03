/**
 * E2E tests for basic Svelte app initialization
 * Tests that the plugin loads and the main view renders
 */

import { test, expect } from "../../helpers/setup";
import { executeCommand } from "../../helpers/global";

test.describe("Svelte App Initialization", () => {
  test("should load plugin and render main view with tasks view", async ({
    page,
  }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Check that the TasksView component is displayed
    await expect(page.locator('[data-testid="tasks-view"]')).toBeVisible();

    // Check that the Local Tasks header is displayed
    await expect(page.locator("text=Local Tasks")).toBeVisible();
  });

  test("should scan and load existing task files during initialization", async ({
    page,
  }) => {
    // Create sample task files before plugin loads
    await page.evaluate(async () => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create sample task files with proper frontmatter
      const task1Content = `---
Title: Sample Task 1
Type: Task
Status: Not Started
Priority: High
Done: false
---

This is a sample task for testing task scanning.`;

      const task2Content = `---
Title: Sample Task 2
Type: Task
Status: In Progress
Priority: Medium
Done: false
Areas: ["Development"]
---

Another sample task with areas.`;

      await app.vault.create("Tasks/Sample Task 1.md", task1Content);
      await app.vault.create("Tasks/Sample Task 2.md", task2Content);
    });

    // Now reload the plugin to trigger task scanning
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Disable and re-enable plugin to trigger fresh initialization
      await app.plugins.disablePlugin("obsidian-task-sync");
      await app.plugins.enablePlugin("obsidian-task-sync");
    });

    // Wait a bit for plugin to initialize
    await page.waitForTimeout(1000);

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible (use first() to handle multiple instances)
    await expect(page.locator(".task-sync-app").first()).toBeVisible();

    // Check that tasks are loaded and displayed (use more specific selectors)
    await expect(
      page.locator(".task-sync-item-title").filter({ hasText: "Sample Task 1" })
    ).toBeVisible();
    await expect(
      page.locator(".task-sync-item-title").filter({ hasText: "Sample Task 2" })
    ).toBeVisible();

    // Verify task properties are displayed correctly
    await expect(page.locator("text=High")).toBeVisible(); // Priority
    await expect(page.locator("text=Medium")).toBeVisible(); // Priority
    await expect(page.locator("text=Development")).toBeVisible(); // Area
  });

  test("should show plugin is loaded in ribbon", async ({ page }) => {
    // Look for the Task Sync ribbon icon (checkbox icon)
    const ribbonIcon = page.locator(
      '.side-dock-ribbon-action[aria-label*="Task Sync"]'
    );
    await expect(ribbonIcon).toBeVisible();
  });
});
