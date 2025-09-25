/**
 * E2E tests for basic Svelte app initialization
 * Tests that the plugin loads and the main view renders
 */

import { test, expect } from "../../helpers/setup";
import { executeCommand } from "../../helpers/global";

test.describe("Svelte App Initialization", () => {
  test("should load plugin and render main view with hello message", async ({ page }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Check that the hello message is displayed
    await expect(page.locator("text=Hello from Task Sync")).toBeVisible();
  });

  test("should show plugin is loaded in ribbon", async ({ page }) => {
    // Check that the Task Sync ribbon icon is present
    await expect(page.locator('.workspace-ribbon-collapse-btn')).toBeVisible();
    
    // Look for the Task Sync ribbon icon (checkbox icon)
    const ribbonIcon = page.locator('.side-dock-ribbon-action[aria-label*="Task Sync"]');
    await expect(ribbonIcon).toBeVisible();
  });
});
