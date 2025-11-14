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
    await page.waitForSelector(".vertical-tab-content", { timeout: 2500 });

    // Navigate to Task Sync settings
    const taskSyncTab = page
      .locator(".vertical-tab-nav-item")
      .filter({ hasText: "Task Sync" });
    await taskSyncTab.click();

    // Scroll to Integrations section
    await page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (settingsContainer) {
        settingsContainer.scrollTop = settingsContainer.scrollHeight;
      }
    });

    // Click "Add Mapping" button
    const addButton = page.locator('[data-testid="github-add-mapping-btn"]');
    await addButton.waitFor({ state: "visible", timeout: 2500 });
    await addButton.click();

    // Fill in the mapping fields
    const orgInput = page.locator('[data-testid="github-mapping-org-input-0"]');
    await orgInput.waitFor({ state: "visible", timeout: 2500 });
    await orgInput.fill("test-org");

    const areaInput = page.locator(
      '[data-testid="github-mapping-area-input-0"]'
    );
    await areaInput.waitFor({ state: "visible", timeout: 2500 });
    await areaInput.fill("Test Area");

    const projectInput = page.locator(
      '[data-testid="github-mapping-project-input-0"]'
    );
    await projectInput.waitFor({ state: "visible", timeout: 2500 });
    await projectInput.fill("Test Project");

    // Wait for the mapping to be saved using waitForFunction
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const mappings = plugin.settings.integrations.github.orgRepoMappings;
        return (
          Array.isArray(mappings) &&
          mappings.length === 1 &&
          mappings[0].organization === "test-org" &&
          mappings[0].targetArea === "Test Area" &&
          mappings[0].targetProject === "Test Project"
        );
      },
      { timeout: 2500 }
    );

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
  });

  test("should allow adding multiple mappings", async ({ page }) => {
    // Open settings
    await page.keyboard.press("Control+,");
    await page.waitForSelector(".vertical-tab-content", { timeout: 2500 });

    // Navigate to Task Sync settings
    const taskSyncTab = page
      .locator(".vertical-tab-nav-item")
      .filter({ hasText: "Task Sync" });
    await taskSyncTab.click();

    // Scroll to Integrations section
    await page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (settingsContainer) {
        settingsContainer.scrollTop = settingsContainer.scrollHeight;
      }
    });

    // Add first mapping
    const addButton = page.locator('[data-testid="github-add-mapping-btn"]');
    await addButton.waitFor({ state: "visible", timeout: 2500 });
    await addButton.click();

    const orgInput1 = page.locator(
      '[data-testid="github-mapping-org-input-0"]'
    );
    await orgInput1.waitFor({ state: "visible", timeout: 2500 });
    await orgInput1.fill("org1");

    // Add second mapping
    await addButton.click();

    const orgInput2 = page.locator(
      '[data-testid="github-mapping-org-input-1"]'
    );
    await orgInput2.waitFor({ state: "visible", timeout: 2500 });
    await orgInput2.fill("org2");

    // Wait for both mappings to be saved
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const mappings = plugin.settings.integrations.github.orgRepoMappings;
        return (
          Array.isArray(mappings) &&
          mappings.length === 2 &&
          mappings[0].organization === "org1" &&
          mappings[1].organization === "org2"
        );
      },
      { timeout: 2500 }
    );

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
    await page.waitForSelector(".vertical-tab-content", { timeout: 2500 });

    // Navigate to Task Sync settings
    const taskSyncTab = page
      .locator(".vertical-tab-nav-item")
      .filter({ hasText: "Task Sync" });
    await taskSyncTab.click();

    // Scroll to Integrations section
    await page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (settingsContainer) {
        settingsContainer.scrollTop = settingsContainer.scrollHeight;
      }
    });

    // Click delete button
    const deleteButton = page.locator(
      '[data-testid="github-mapping-delete-btn-0"]'
    );
    await deleteButton.waitFor({ state: "visible", timeout: 2500 });
    await deleteButton.click();

    // Wait for the mapping to be deleted
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const mappings = plugin.settings.integrations.github.orgRepoMappings;
        return Array.isArray(mappings) && mappings.length === 0;
      },
      { timeout: 2500 }
    );

    // Verify the mapping was deleted
    const savedMappings = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.integrations.github.orgRepoMappings;
    });

    expect(savedMappings).toHaveLength(0);

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should update GitHub extension when mappings are changed", async ({
    page,
  }) => {
    // Open settings
    await page.keyboard.press("Control+,");
    await page.waitForSelector(".vertical-tab-content", { timeout: 2500 });

    // Navigate to Task Sync settings
    const taskSyncTab = page
      .locator(".vertical-tab-nav-item")
      .filter({ hasText: "Task Sync" });
    await taskSyncTab.click();

    // Scroll to Integrations section
    await page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (settingsContainer) {
        settingsContainer.scrollTop = settingsContainer.scrollHeight;
      }
    });

    // Add a mapping
    const addButton = page.locator('[data-testid="github-add-mapping-btn"]');
    await addButton.waitFor({ state: "visible", timeout: 2500 });
    await addButton.click();

    // Fill in the mapping
    const orgInput = page.locator('[data-testid="github-mapping-org-input-0"]');
    await orgInput.waitFor({ state: "visible", timeout: 2500 });
    await orgInput.fill("test-org");

    const areaInput = page.locator(
      '[data-testid="github-mapping-area-input-0"]'
    );
    await areaInput.waitFor({ state: "visible", timeout: 2500 });
    await areaInput.fill("Test Area");

    // Wait for the GitHub extension to be updated
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const githubExtension = plugin.host?.getExtensionById?.("github");

        if (!githubExtension) return false;

        const mappings =
          githubExtension.githubOperations.tasks.orgRepoMapper.getMappings();
        return (
          Array.isArray(mappings) &&
          mappings.length === 1 &&
          mappings[0].organization === "test-org" &&
          mappings[0].targetArea === "Test Area"
        );
      },
      { timeout: 2500 }
    );

    // Verify that the GitHub extension was updated with the new mappings
    const extensionMappings = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const githubExtension = plugin.host?.getExtensionById?.("github");

      if (!githubExtension) return null;

      // Get the mappings from the GitHub extension's org/repo mapper
      return githubExtension.githubOperations.tasks.orgRepoMapper.getMappings();
    });

    expect(extensionMappings).not.toBeNull();
    expect(extensionMappings).toHaveLength(1);
    expect(extensionMappings[0].organization).toBe("test-org");
    expect(extensionMappings[0].targetArea).toBe("Test Area");

    // Close settings
    await page.keyboard.press("Escape");
  });
});
