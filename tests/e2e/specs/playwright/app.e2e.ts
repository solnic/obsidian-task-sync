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

  test("should show plugin is loaded in ribbon", async ({ page }) => {
    // Look for the Task Sync ribbon icon (checkbox icon)
    const ribbonIcon = page.locator(
      '.side-dock-ribbon-action[aria-label*="Task Sync"]'
    );
    await expect(ribbonIcon).toBeVisible();
  });
});
