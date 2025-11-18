/**
 * E2E tests for Settings Tab functionality
 * Tests the complete settings UI ported from old-stuff to new architecture
 */

import { test, expect } from "../../helpers/setup";
import {
  openTaskSyncSettings,
  scrollToSettingsSection,
  setSettingValue,
  getPluginSettingValue,
} from "../../helpers/global";

test.describe("Settings Tab", { tag: "@settings" }, () => {
  test("should modify general settings and save changes", async ({ page }) => {
    // Open settings
    await openTaskSyncSettings(page);

    // Find and modify the Tasks Folder setting
    await setSettingValue(page, "Tasks Folder", "MyTasks");

    // Verify the setting was saved by checking plugin settings
    const savedValue = await getPluginSettingValue(page, "tasksFolder");
    expect(savedValue).toBe("MyTasks");

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should display and interact with integrations settings", async ({
    page,
  }) => {
    // Open settings and navigate to integrations
    await openTaskSyncSettings(page);
    await scrollToSettingsSection(page, "Integrations");

    // Navigate to integrations section
    const integrationsSection = page.locator(
      '[data-testid="settings-section-integrations"]'
    );
    await expect(integrationsSection).toBeVisible();

    // Verify integration subsections are present
    const integrationTypes = ["GitHub", "Apple Reminders", "Apple Calendar"];

    for (const integrationType of integrationTypes) {
      const integrationHeader = page.locator(
        `h3:has-text("${integrationType}")`
      );
      await expect(integrationHeader).toBeVisible();
    }

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should modify template settings and verify changes", async ({
    page,
  }) => {
    // Open settings and navigate to templates
    await openTaskSyncSettings(page);
    await scrollToSettingsSection(page, "Templates");

    // Find and modify the Default Task Template setting
    await setSettingValue(page, "Default Task Template", "custom-task.md");

    // Verify the setting was saved
    const savedTemplate = await getPluginSettingValue(
      page,
      "defaultTaskTemplate"
    );
    expect(savedTemplate).toBe("custom-task.md");

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should save settings values as entered", async ({ page }) => {
    // Note: Currently GeneralSettings doesn't implement validation
    // This test verifies that values are saved as entered

    // Open settings
    await openTaskSyncSettings(page);

    // Set a valid folder name
    await setSettingValue(page, "Tasks Folder", "MyValidTasks");

    // Verify the setting was saved
    const savedValue = await getPluginSettingValue(page, "tasksFolder");
    expect(savedValue).toBe("MyValidTasks");

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should persist settings changes", async ({ page }) => {
    // Open settings and make a change
    await openTaskSyncSettings(page);
    await setSettingValue(page, "Tasks Folder", "PersistentTasks");

    // Verify the setting was immediately saved to the plugin
    const savedValue = await getPluginSettingValue(page, "tasksFolder");
    expect(savedValue).toBe("PersistentTasks");

    // Make another change to verify persistence continues to work
    await setSettingValue(page, "Projects Folder", "MyProjects");

    const projectsValue = await getPluginSettingValue(page, "projectsFolder");
    expect(projectsValue).toBe("MyProjects");

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should display bases settings section", async ({ page }) => {
    // Open settings and navigate to bases
    await openTaskSyncSettings(page);
    await scrollToSettingsSection(page, "Bases");

    // Verify bases section is visible
    const basesSection = page.locator('[data-testid="settings-section-bases"]');
    await expect(basesSection).toBeVisible();

    // Verify some key bases settings are present
    const basesFolderSetting = page.locator(
      '.setting-item:has-text("Bases Folder")'
    );
    await expect(basesFolderSetting).toBeVisible();

    const tasksBaseSetting = page.locator(
      '.setting-item:has-text("Tasks Base File")'
    );
    await expect(tasksBaseSetting).toBeVisible();

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should handle multiple setting changes in sequence", async ({
    page,
  }) => {
    // Open settings
    await openTaskSyncSettings(page);

    // Make multiple changes
    await setSettingValue(page, "Tasks Folder", "NewTasks");
    await setSettingValue(page, "Projects Folder", "NewProjects");
    await setSettingValue(page, "Areas Folder", "NewAreas");

    // Verify all changes were saved
    const tasksValue = await getPluginSettingValue(page, "tasksFolder");
    const projectsValue = await getPluginSettingValue(page, "projectsFolder");
    const areasValue = await getPluginSettingValue(page, "areasFolder");

    expect(tasksValue).toBe("NewTasks");
    expect(projectsValue).toBe("NewProjects");
    expect(areasValue).toBe("NewAreas");

    // Close settings
    await page.keyboard.press("Escape");
  });
});
