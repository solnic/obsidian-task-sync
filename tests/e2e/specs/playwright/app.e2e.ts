/**
 * E2E tests for basic Svelte app initialization
 * Tests that the plugin loads and the main view renders
 */

import { test, expect } from "../../helpers/setup";
import { executeCommand, waitForFileProcessed } from "../../helpers/global";

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

      // Disable and re-enable plugin to trigger fresh initialization
      await app.plugins.disablePlugin("obsidian-task-sync");
      await app.plugins.enablePlugin("obsidian-task-sync");
    });

    // Wait for plugin to be fully initialized
    await page.waitForFunction(
      () => {
        const plugin = (window as any).app.plugins.plugins[
          "obsidian-task-sync"
        ];
        return (
          plugin &&
          plugin.settings &&
          (window as any).app.plugins.isEnabled("obsidian-task-sync")
        );
      },
      undefined,
      { timeout: 5000 }
    );

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

  test("should preserve updatedAt timestamps during initial task load", async ({
    page,
  }) => {
    // Create a task file before plugin loads
    await page.evaluate(async () => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create a task file
      const taskContent = `---
Title: Timestamp Test Task
Type: Task
Status: Not Started
Priority: Medium
Done: false
---

Task for testing timestamp preservation.`;

      await app.vault.create("Tasks/Timestamp Test Task.md", taskContent);
    });

    // Reload the plugin to trigger task scanning
    await page.evaluate(async () => {
      const app = (window as any).app;
      await app.plugins.disablePlugin("obsidian-task-sync");
      await app.plugins.enablePlugin("obsidian-task-sync");
    });

    // Wait for plugin to initialize and tasks to be loaded
    await page.waitForFunction(
      () => {
        const plugin = (window as any).app.plugins.plugins[
          "obsidian-task-sync"
        ];
        if (!plugin || !plugin.settings) return false;

        try {
          const { get } = require("svelte/store");
          const tasks = get(
            plugin.host.getExtensionById("obsidian").getTasks()
          );
          return tasks.some((t: any) => t.title === "Timestamp Test Task");
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 5000 }
    );

    // Get the task's initial timestamps
    const initialTimestamps = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const { get } = require("svelte/store");
      const tasks = get(plugin.host.getExtensionById("obsidian").getTasks());
      const task = tasks.find((t: any) => t.title === "Timestamp Test Task");
      return {
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });

    // Get the task's timestamps again
    const finalTimestamps = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const { get } = require("svelte/store");
      const tasks = get(plugin.host.getExtensionById("obsidian").getTasks());
      const task = tasks.find((t: any) => t.title === "Timestamp Test Task");
      return {
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });

    // Verify timestamps haven't changed
    expect(finalTimestamps.createdAt).toBe(initialTimestamps.createdAt);
    expect(finalTimestamps.updatedAt).toBe(initialTimestamps.updatedAt);
  });

  test("should show context tab button above service tabs", async ({
    page,
  }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Context tab button should be visible above service tabs
    const contextTabButton = page.locator('[data-testid="context-tab-button"]');
    await expect(contextTabButton).toBeVisible();

    // Should have info icon
    await expect(contextTabButton.locator('[data-icon="info"]')).toBeVisible();

    // Should not be active by default
    await expect(contextTabButton).not.toHaveClass(/active/);
  });

  test("should show context widget when context tab is clicked", async ({
    page,
  }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Click context tab button
    const contextTabButton = page.locator('[data-testid="context-tab-button"]');
    await contextTabButton.click();

    // Context tab should be active
    await expect(contextTabButton).toHaveClass(/active/);

    // Context widget content should be visible
    const contextTabContent = page.locator(
      '[data-testid="context-tab-content"]'
    );
    await expect(contextTabContent).toBeVisible();

    // Service content should be hidden
    const serviceContent = page.locator('[data-testid="service-content"]');
    await expect(serviceContent).not.toBeVisible();
  });

  test("should hide context tab when service tab is clicked", async ({
    page,
  }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Click context tab first
    const contextTabButton = page.locator('[data-testid="context-tab-button"]');
    await contextTabButton.click();
    await expect(contextTabButton).toHaveClass(/active/);

    // Click a service tab (local service)
    const localServiceButton = page.locator('[data-testid="service-local"]');
    await localServiceButton.click();

    // Context tab should no longer be active
    await expect(contextTabButton).not.toHaveClass(/active/);

    // Service content should be visible
    const serviceContent = page.locator('[data-testid="service-content"]');
    await expect(serviceContent).toBeVisible();

    // Context tab content should be hidden
    const contextTabContent = page.locator(
      '[data-testid="context-tab-content"]'
    );
    await expect(contextTabContent).not.toBeVisible();
  });
});
