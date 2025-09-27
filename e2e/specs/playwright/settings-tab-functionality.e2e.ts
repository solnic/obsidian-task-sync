/**
 * E2E tests for Settings Tab functionality
 * Tests the complete settings UI ported from old-stuff to new architecture
 */

import { test, expect } from "../../helpers/setup";
import { executeCommand } from "../../helpers/global";

test.describe("Settings Tab Functionality", () => {
  test("should open settings tab and display all sections", async ({
    page,
  }) => {
    // Open settings using Obsidian API
    await page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    // Wait for settings to load
    await page.waitForTimeout(1000);

    // Verify all main sections are present
    const sections = [
      "General",
      "Templates",
      "Bases",
      "Task Properties",
      "Task Categories",
      "Task Priorities",
      "Task Statuses",
      "Integrations",
    ];

    for (const sectionName of sections) {
      const sectionHeader = page.locator(
        `[data-testid="settings-section-${sectionName
          .toLowerCase()
          .replace(/\s+/g, "-")}"]`
      );
      await expect(sectionHeader).toBeVisible();
    }

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should modify general settings and save changes", async ({ page }) => {
    // Open settings
    await page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    await page.waitForTimeout(1000);

    // Find and modify the Tasks Folder setting
    const tasksFolderInput = page.locator(
      '.setting-item:has-text("Tasks Folder") input'
    );
    await expect(tasksFolderInput).toBeVisible();

    // Clear and set new value
    await tasksFolderInput.fill("MyTasks");

    // Verify the setting was saved by checking plugin settings
    const savedValue = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.tasksFolder;
    });

    expect(savedValue).toBe("MyTasks");

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should display and interact with task categories settings", async ({
    page,
  }) => {
    // Open settings
    await page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    await page.waitForTimeout(1000);

    // Navigate to task categories section
    const taskCategoriesSection = page.locator(
      '[data-testid="settings-section-task-categories"]'
    );
    await expect(taskCategoriesSection).toBeVisible();

    // Scroll to the section
    await taskCategoriesSection.scrollIntoViewIfNeeded();

    // Verify default task types are displayed
    const defaultTypes = ["Task", "Bug", "Feature", "Improvement", "Chore"];

    for (const typeName of defaultTypes) {
      const typeElement = page.locator(`.setting-item:has-text("${typeName}")`);
      await expect(typeElement).toBeVisible();
    }

    // Look for add new task category section
    const addSection = page.locator(
      '.setting-item:has-text("Add New Task Category")'
    );
    await expect(addSection).toBeVisible();

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should display and interact with integrations settings", async ({
    page,
  }) => {
    // Open settings
    await page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    await page.waitForTimeout(1000);

    // Navigate to integrations section
    const integrationsSection = page.locator(
      '[data-testid="settings-section-integrations"]'
    );
    await expect(integrationsSection).toBeVisible();

    // Scroll to the section
    await integrationsSection.scrollIntoViewIfNeeded();

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
    // Open settings
    await page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    await page.waitForTimeout(1000);

    // Navigate to templates section
    const templatesSection = page.locator(
      '[data-testid="settings-section-templates"]'
    );
    await expect(templatesSection).toBeVisible();
    await templatesSection.scrollIntoViewIfNeeded();

    // Find and modify the Default Task Template setting
    const taskTemplateInput = page.locator(
      '.setting-item:has-text("Default Task Template") input'
    );
    await expect(taskTemplateInput).toBeVisible();

    // Set new template value
    await taskTemplateInput.fill("custom-task.md");

    // Verify the setting was saved
    const savedTemplate = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.defaultTaskTemplate;
    });

    expect(savedTemplate).toBe("custom-task.md");

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should handle settings validation correctly", async ({ page }) => {
    // Open settings
    await page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    await page.waitForTimeout(1000);

    // Try to set an invalid folder name (with invalid characters)
    const tasksFolderInput = page.locator(
      '.setting-item:has-text("Tasks Folder") input'
    );
    await expect(tasksFolderInput).toBeVisible();

    // Try to set invalid folder name
    await tasksFolderInput.fill("Tasks<>:");

    // The validation should prevent this from being saved
    // Check that the plugin settings didn't change to the invalid value
    const savedValue = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.tasksFolder;
    });

    // Should not be the invalid value
    expect(savedValue).not.toBe("Tasks<>:");

    // Close settings
    await page.keyboard.press("Escape");
  });
});
