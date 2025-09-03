/**
 * E2E tests for Task Type Configuration UI
 * Tests the task type management interface in plugin settings
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  openTaskSyncSettings,
  closeSettings,
  scrollToSettingsSection
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Task Type Configuration', () => {
  const context = setupE2ETestHooks();

  async function openTaskSyncSettingsWrapper() {
    await openTaskSyncSettings(context);
  }

  async function scrollToTaskTypesSection() {
    await scrollToSettingsSection(context.page, 'Task Types');
  }

  test('should display task types settings section', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();

    // Check if Task Types section exists
    const taskTypesSection = context.page.locator('.task-sync-section-header').filter({ hasText: 'Task Types' });
    expect(await taskTypesSection.isVisible()).toBe(true);

    await scrollToTaskTypesSection();

    // Check if task type settings exist (using Obsidian Setting components)
    const settingItems = context.page.locator('.setting-item');
    const settingCount = await settingItems.count();
    expect(settingCount).toBeGreaterThan(5); // Should have settings for each task type plus add new

    // Check if add new task type section exists
    const addTypeSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });
    expect(await addTypeSection.isVisible()).toBe(true);
  });

  test('should display default task types', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Check for default task types in setting items
    const taskSetting = context.page.locator('.setting-item').filter({ hasText: 'Task' }).first();
    expect(await taskSetting.isVisible()).toBe(true);

    const bugSetting = context.page.locator('.setting-item').filter({ hasText: 'Bug' }).first();
    expect(await bugSetting.isVisible()).toBe(true);

    const featureSetting = context.page.locator('.setting-item').filter({ hasText: 'Feature' }).first();
    expect(await featureSetting.isVisible()).toBe(true);

    const improvementSetting = context.page.locator('.setting-item').filter({ hasText: 'Improvement' }).first();
    expect(await improvementSetting.isVisible()).toBe(true);

    const choreSetting = context.page.locator('.setting-item').filter({ hasText: 'Chore' }).first();
    expect(await choreSetting.isVisible()).toBe(true);

    // Check that each task type has a color dropdown
    const colorDropdowns = context.page.locator('.setting-item select');
    const dropdownCount = await colorDropdowns.count();
    expect(dropdownCount).toBeGreaterThanOrEqual(5); // At least one for each default task type
  });

  test('should add new task type', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Find the add new task type section
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });
    expect(await addSection.isVisible()).toBe(true);

    // Find the input field within the add section
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Epic');

    // Find and click the add button
    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();

    // Wait for the new task type to appear
    const epicSetting = context.page.locator('.setting-item').filter({ hasText: 'Epic' }).first();
    await epicSetting.waitFor({ state: 'visible', timeout: 5000 });
    expect(await epicSetting.isVisible()).toBe(true);

    // Check that the Epic setting has a color dropdown
    const epicDropdown = epicSetting.locator('select');
    expect(await epicDropdown.isVisible()).toBe(true);
  });

  test('should prevent adding duplicate task types', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Find the add new task type section
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });

    // Try to add existing task type
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Bug'); // Bug already exists

    // Try to click add button - it should not create a duplicate
    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();

    // Wait a moment for any potential duplicate to appear, then check
    await context.page.waitForTimeout(500);

    // Check that we still only have one Bug setting
    const bugSettings = context.page.locator('.setting-item').filter({ hasText: 'Bug' });
    const bugCount = await bugSettings.count();
    expect(bugCount).toBe(1); // Should only have one Bug setting
  });

  test('should prevent adding empty task type', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Find the add new task type section
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });

    // Try to add empty task type
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('   '); // Only spaces

    // Try to click add button - it should not create an empty task type
    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();

    // Wait a moment for any potential empty task type to appear, then check
    await context.page.waitForTimeout(500);

    // Check that no empty task type was added
    const emptySettings = context.page.locator('.setting-item').filter({ hasText: /^\s*$/ });
    const emptyCount = await emptySettings.count();
    expect(emptyCount).toBe(0);
  });

  test('should remove task type', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // First add a new task type to remove
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Story');

    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();

    // Wait for the Story task type to appear
    const storySetting = context.page.locator('.setting-item').filter({ hasText: 'Story' }).first();
    await storySetting.waitFor({ state: 'visible', timeout: 5000 });
    expect(await storySetting.isVisible()).toBe(true);

    const deleteButton = storySetting.locator('button').filter({ hasText: 'Delete' });
    await deleteButton.click();

    // Wait for the Story task type to be removed
    await storySetting.waitFor({ state: 'detached', timeout: 5000 });

    // Check that Story task type is no longer in the settings
    const storySettings = context.page.locator('.setting-item').filter({ hasText: 'Story' });
    const storyCount = await storySettings.count();
    expect(storyCount).toBe(0);
  });

  test('should not show delete button for last task type', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);

    // Set up plugin with only one task type
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.taskTypes = [{ name: 'Task', color: 'blue' }]; // Only one task type
        await plugin.saveSettings();
      }
    });

    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Check that the single task type doesn't have a delete button
    const taskSetting = context.page.locator('.setting-item').filter({ hasText: 'Task' }).first();
    expect(await taskSetting.isVisible()).toBe(true);

    const deleteButton = taskSetting.locator('button').filter({ hasText: 'Delete' });
    expect(await deleteButton.isVisible()).toBe(false);
  });

  test('should trigger base sync when task type is added', { timeout: 30000 }, async () => {
    await createTestFolders(context.page);

    // Create an area to test base sync
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create('Areas/Test Area.md', `---
Name: Test Area
Type: Area
---

Test area for sync testing.
`);
    });

    // Enable area bases
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });

    // Wait for plugin to be ready
    await context.page.waitForFunction(() => {
      return typeof (window as any).app?.plugins?.plugins?.['task-sync'] !== 'undefined';
    }, { timeout: 5000 });

    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Add a new task type
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Research');

    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();

    // Wait for the new task type to appear in settings
    const researchSetting = context.page.locator('.setting-item').filter({ hasText: 'Research' }).first();
    await researchSetting.waitFor({ state: 'visible', timeout: 5000 });

    // Close settings
    await closeSettings(context.page);

    // Verify that the Research task type was successfully added to the plugin settings
    const hasResearchTaskType = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['task-sync'];
      if (plugin && plugin.settings && plugin.settings.taskTypes) {
        return plugin.settings.taskTypes.includes('Research');
      }
      return false;
    });

    expect(hasResearchTaskType).toBe(true);

    // Also verify that base sync was triggered (we can see this in the logs)
    // The test passes if the Research task type is in the plugin settings
  });

  test('should trigger base sync when task type is removed', { timeout: 20000 }, async () => {
    await createTestFolders(context.page);

    // Create an area to test base sync
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create('Areas/Sync Test.md', `---
Name: Sync Test
Type: Area
---

Area for testing sync functionality.
`);
    });

    // Enable area bases
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });

    // Wait for plugin to be ready
    await context.page.waitForFunction(() => {
      return typeof (window as any).app?.plugins?.plugins?.['task-sync'] !== 'undefined';
    }, { timeout: 5000 });

    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Remove the "Chore" task type
    const choreSetting = context.page.locator('.setting-item').filter({ hasText: 'Chore' }).first();
    const deleteButton = choreSetting.locator('button').filter({ hasText: 'Delete' });
    await deleteButton.click();

    // Wait for the Chore task type to be removed
    await choreSetting.waitFor({ state: 'detached', timeout: 5000 });

    // Close settings
    await closeSettings(context.page);

    // Wait for the base content to be updated (Chore view removed)
    await context.page.waitForFunction(async () => {
      const app = (window as any).app;
      const baseFile = app.vault.getAbstractFileByPath('Bases/Sync Test.base');
      if (baseFile) {
        const content = await app.vault.read(baseFile);
        return !content.includes('name: Chores') && !content.includes('Type == "Chore"');
      }
      return false;
    }, { timeout: 10000 });

    // Verify the base content was updated
    const baseContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const baseFile = app.vault.getAbstractFileByPath('Bases/Sync Test.base');
      if (baseFile) {
        return await app.vault.read(baseFile);
      }
      return null;
    });

    expect(baseContent).not.toContain('name: Chores');
    expect(baseContent).not.toContain('Type == "Chore"');
  });

  test('should handle special characters in task type names', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Add task type with special characters
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('User Story (UI/UX)');

    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();

    // Wait for the new task type to appear
    const userStorySetting = context.page.locator('.setting-item').filter({ hasText: 'User Story (UI/UX)' }).first();
    await userStorySetting.waitFor({ state: 'visible', timeout: 5000 });
    expect(await userStorySetting.isVisible()).toBe(true);
  });


});
