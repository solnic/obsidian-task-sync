/**
 * E2E tests for Settings Tab functionality
 * Tests the complete settings UI ported from old-stuff to new architecture
 */

import { test, expect } from "../../helpers/setup";
import {
  openTaskSyncSettings,
  openTaskCategoriesSettings,
  scrollToSettingsSection,
  addTaskCategory,
  verifyTaskCategoryExists,
  deleteTaskCategory,
  setSettingValue,
  getPluginSettingValue,
} from "../../helpers/global";

test.describe("Settings Tab Functionality", () => {
  test("should open settings tab and display all sections", async ({
    page,
  }) => {
    // Open settings using helper
    await openTaskSyncSettings(page);

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
    await openTaskSyncSettings(page);

    // Find and modify the Tasks Folder setting
    await setSettingValue(page, "Tasks Folder", "MyTasks");

    // Verify the setting was saved by checking plugin settings
    const savedValue = await getPluginSettingValue(page, "tasksFolder");
    expect(savedValue).toBe("MyTasks");

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should display and interact with task categories settings", async ({
    page,
  }) => {
    // Open task categories settings
    await openTaskCategoriesSettings(page);

    // Verify default task types are displayed using the helper
    const defaultTypes = ["Task", "Bug", "Feature", "Improvement", "Chore"];

    for (const typeName of defaultTypes) {
      const exists = await verifyTaskCategoryExists(page, typeName);
      expect(exists).toBe(true);
    }

    // Look for add new task category section
    const addSection = page.locator(
      '[data-testid="add-task-category-section"]'
    );
    await expect(addSection).toBeVisible();

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

  test("should add and remove task categories", async ({ page }) => {
    // Open task categories settings
    await openTaskCategoriesSettings(page);

    // Add a new task category
    await addTaskCategory(page, "Epic");

    // Verify the category was added
    const exists = await verifyTaskCategoryExists(page, "Epic");
    expect(exists).toBe(true);

    // Verify it's in the plugin settings
    const taskTypes = await getPluginSettingValue(page, "taskTypes");
    const epicType = taskTypes.find((type: any) => type.name === "Epic");
    expect(epicType).toBeDefined();
    expect(epicType.color).toBeDefined(); // Should have some color

    // Remove the category
    await deleteTaskCategory(page, "Epic");

    // Verify the category was removed
    const stillExists = await verifyTaskCategoryExists(page, "Epic");
    expect(stillExists).toBe(false);

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should prevent adding duplicate task categories", async ({ page }) => {
    // Open task categories settings
    await openTaskCategoriesSettings(page);

    // Try to add a category that already exists
    const addSection = page.locator(
      '[data-testid="add-task-category-section"]'
    );
    await addSection.scrollIntoViewIfNeeded();

    const nameInput = page.locator('[data-testid="task-category-name-input"]');
    await nameInput.fill("Task"); // This should already exist

    const addButton = page.locator('[data-testid="add-task-category-button"]');
    await addButton.click();

    // Should show an error notice
    // Wait a moment for any notice to appear
    await page.waitForTimeout(1000);

    // Verify that no duplicate was added by checking the count
    const taskTypes = await getPluginSettingValue(page, "taskTypes");
    const taskCount = taskTypes.filter(
      (type: any) => type.name === "Task"
    ).length;
    expect(taskCount).toBe(1);

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should verify task category management workflow", async ({ page }) => {
    // Open task categories settings
    await openTaskCategoriesSettings(page);

    // Verify we can add a category and it appears in settings
    await addTaskCategory(page, "Story");

    // Verify the category exists
    const exists = await verifyTaskCategoryExists(page, "Story");
    expect(exists).toBe(true);

    // Verify it's in the plugin settings
    const taskTypes = await getPluginSettingValue(page, "taskTypes");
    const storyType = taskTypes.find((type: any) => type.name === "Story");
    expect(storyType).toBeDefined();

    // Clean up - remove the category
    await deleteTaskCategory(page, "Story");

    // Verify it was removed
    const stillExists = await verifyTaskCategoryExists(page, "Story");
    expect(stillExists).toBe(false);

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

  test("should display task properties settings section", async ({ page }) => {
    // Open settings and navigate to task properties
    await openTaskSyncSettings(page);
    await scrollToSettingsSection(page, "Task Properties");

    // Verify task properties section is visible
    const taskPropertiesSection = page.locator(
      '[data-testid="settings-section-task-properties"]'
    );
    await expect(taskPropertiesSection).toBeVisible();

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should display task priorities settings section", async ({ page }) => {
    // Open settings and navigate to task priorities
    await openTaskSyncSettings(page);
    await scrollToSettingsSection(page, "Task Priorities");

    // Verify task priorities section is visible
    const taskPrioritiesSection = page.locator(
      '[data-testid="settings-section-task-priorities"]'
    );
    await expect(taskPrioritiesSection).toBeVisible();

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should display task statuses settings section", async ({ page }) => {
    // Open settings and navigate to task statuses
    await openTaskSyncSettings(page);
    await scrollToSettingsSection(page, "Task Statuses");

    // Verify task statuses section is visible
    const taskStatusesSection = page.locator(
      '[data-testid="settings-section-task-statuses"]'
    );
    await expect(taskStatusesSection).toBeVisible();

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
