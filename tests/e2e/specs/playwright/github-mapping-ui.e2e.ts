/**
 * E2E tests for GitHub Organization/Repository Mapping UI
 * Tests the Settings UI for configuring GitHub org/repo mappings
 */

import { test, expect } from "../../helpers/setup";
import { enableIntegration } from "../../helpers/global";

test.describe("GitHub Mapping UI", () => {
  test.beforeEach(async ({ page }) => {
    await enableIntegration(page, "github");
  });

  test("should allow adding and configuring a mapping through the UI", async ({
    page,
  }) => {
    // Open settings
    await page.keyboard.press("Control+,");
    await page.waitForSelector(".vertical-tab-content", { timeout: 5000 });

    // Navigate to Task Sync settings
    const taskSyncTab = page
      .locator(".vertical-tab-nav-item")
      .filter({ hasText: "Task Sync" });
    await taskSyncTab.click();
    await page.waitForTimeout(500);

    // Scroll to Integrations section
    await page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (settingsContainer) {
        settingsContainer.scrollTop = settingsContainer.scrollHeight;
      }
    });

    // Wait for GitHub settings to be visible
    await page.waitForTimeout(1000);

    // Click "Add Mapping" button
    const addButton = page.locator('[data-testid="github-add-mapping-btn"]');
    await addButton.waitFor({ state: "visible", timeout: 10000 });
    await addButton.click();

    // Wait for the new mapping item to appear
    await page.waitForTimeout(500);

    // Fill in the mapping fields
    const orgInput = page.locator('[data-testid="github-mapping-org-input-0"]');
    await orgInput.waitFor({ state: "visible", timeout: 5000 });
    await orgInput.fill("test-org");
    await page.waitForTimeout(500);

    const areaInput = page.locator('[data-testid="github-mapping-area-input-0"]');
    await areaInput.waitFor({ state: "visible", timeout: 5000 });
    await areaInput.fill("Test Area");
    await page.waitForTimeout(500);

    const projectInput = page.locator(
      '[data-testid="github-mapping-project-input-0"]'
    );
    await projectInput.waitFor({ state: "visible", timeout: 5000 });
    await projectInput.fill("Test Project");
    await page.waitForTimeout(500);

    // Verify the mapping was saved
    const savedMappings = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.integrations.github.orgRepoMappings;
    });

    expect(savedMappings).toHaveLength(1);
    expect(savedMappings[0].organization).toBe("test-org");
    expect(savedMappings[0].targetArea).toBe("Test Area");
    expect(savedMappings[0].targetProject).toBe("Test Project");

    // Close settings
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("should allow adding multiple mappings", async ({ page }) => {
    // Open settings
    await page.keyboard.press("Control+,");
    await page.waitForSelector(".vertical-tab-content", { timeout: 5000 });

    // Navigate to Task Sync settings
    const taskSyncTab = page
      .locator(".vertical-tab-nav-item")
      .filter({ hasText: "Task Sync" });
    await taskSyncTab.click();
    await page.waitForTimeout(500);

    // Scroll to Integrations section
    await page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (settingsContainer) {
        settingsContainer.scrollTop = settingsContainer.scrollHeight;
      }
    });

    // Wait for GitHub settings to be visible
    await page.waitForTimeout(1000);

    // Add first mapping
    const addButton = page.locator('[data-testid="github-add-mapping-btn"]');
    await addButton.waitFor({ state: "visible", timeout: 10000 });
    await addButton.click();
    await page.waitForTimeout(500);

    const orgInput1 = page.locator('[data-testid="github-mapping-org-input-0"]');
    await orgInput1.fill("org1");
    await page.waitForTimeout(300);

    // Add second mapping
    await addButton.click();
    await page.waitForTimeout(500);

    const orgInput2 = page.locator('[data-testid="github-mapping-org-input-1"]');
    await orgInput2.fill("org2");
    await page.waitForTimeout(300);

    // Verify both mappings were saved
    const savedMappings = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.integrations.github.orgRepoMappings;
    });

    expect(savedMappings).toHaveLength(2);
    expect(savedMappings[0].organization).toBe("org1");
    expect(savedMappings[1].organization).toBe("org2");

    // Close settings
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("should allow deleting a mapping", async ({ page }) => {
    // First, add a mapping programmatically
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      plugin.settings.integrations.github.orgRepoMappings = [
        {
          organization: "to-delete",
          targetArea: "Area",
          targetProject: "Project",
          priority: 1,
        },
      ];
      await plugin.saveSettings();
    });

    // Open settings
    await page.keyboard.press("Control+,");
    await page.waitForSelector(".vertical-tab-content", { timeout: 5000 });

    // Navigate to Task Sync settings
    const taskSyncTab = page
      .locator(".vertical-tab-nav-item")
      .filter({ hasText: "Task Sync" });
    await taskSyncTab.click();
    await page.waitForTimeout(500);

    // Scroll to Integrations section
    await page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (settingsContainer) {
        settingsContainer.scrollTop = settingsContainer.scrollHeight;
      }
    });

    // Wait for GitHub settings to be visible
    await page.waitForTimeout(1000);

    // Click delete button
    const deleteButton = page.locator(
      '[data-testid="github-mapping-delete-btn-0"]'
    );
    await deleteButton.waitFor({ state: "visible", timeout: 5000 });
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Verify the mapping was deleted
    const savedMappings = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.integrations.github.orgRepoMappings;
    });

    expect(savedMappings).toHaveLength(0);

    // Close settings
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });
});

