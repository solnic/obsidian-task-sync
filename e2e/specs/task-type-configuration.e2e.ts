/**
 * E2E tests for Task Type Configuration UI
 * Tests the task type management interface in plugin settings
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  waitForAsyncOperation
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks, captureScreenshotOnFailure } from '../helpers/shared-context';

describe('Task Type Configuration', () => {
  const context = setupE2ETestHooks();

  async function openTaskSyncSettings() {
    // Open settings
    console.log('🔧 Opening settings with Ctrl+,');
    await context.page.keyboard.press('Control+,');
    await waitForAsyncOperation(1000);

    // Check if settings opened
    const settingsModal = context.page.locator('.modal-container, .setting-tab-container');
    const settingsVisible = await settingsModal.isVisible();
    console.log(`🔧 Settings modal visible: ${settingsVisible}`);

    if (!settingsVisible) {
      throw new Error('Settings modal did not open');
    }

    // Navigate to Community Plugins
    console.log('🔧 Looking for Community plugins tab');
    const communityPluginsTab = context.page.locator('.vertical-tab-nav-item').filter({ hasText: 'Community plugins' });
    const tabExists = await communityPluginsTab.count();
    console.log(`🔧 Community plugins tab count: ${tabExists}`);

    if (tabExists === 0) {
      // Debug: List all available tabs
      const allTabs = await context.page.locator('.vertical-tab-nav-item').allTextContents();
      console.log('🔧 Available tabs:', allTabs);
      throw new Error('Community plugins tab not found');
    }

    await communityPluginsTab.click();
    await waitForAsyncOperation(500);

    // Find and click Task Sync plugin settings
    console.log('🔧 Looking for Task Sync plugin');
    const taskSyncItems = context.page.locator('.setting-item').filter({ hasText: 'Task Sync' });
    const taskSyncCount = await taskSyncItems.count();
    console.log(`🔧 Task Sync items found: ${taskSyncCount}`);

    if (taskSyncCount === 0) {
      // Debug: List all plugins
      const allPlugins = await context.page.locator('.setting-item').allTextContents();
      console.log('🔧 Available plugins:', allPlugins.slice(0, 10)); // First 10 to avoid spam
      throw new Error('Task Sync plugin not found in settings');
    }

    const taskSyncSettings = taskSyncItems.locator('button').filter({ hasText: 'Options' });
    const optionsButtonExists = await taskSyncSettings.count();
    console.log(`🔧 Options button count: ${optionsButtonExists}`);

    if (optionsButtonExists === 0) {
      throw new Error('Task Sync Options button not found');
    }

    await taskSyncSettings.click();
    await waitForAsyncOperation(1000);

    console.log('🔧 Task Sync settings should now be open');
  }

  async function scrollToTaskTypesSection() {
    // Scroll to Task Types section (no tabs anymore, just sections)
    const taskTypesSection = context.page.locator('.task-sync-section-header').filter({ hasText: 'Task Types' });
    await taskTypesSection.scrollIntoViewIfNeeded();
    await waitForAsyncOperation(1000);
  }

  test('should display task types settings section', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);

    // Capture screenshot before opening settings
    await captureScreenshotOnFailure(context, 'before-opening-settings');

    await openTaskSyncSettings();

    // Capture screenshot after opening settings
    await captureScreenshotOnFailure(context, 'after-opening-settings');

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
    await openTaskSyncSettings();
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
    await openTaskSyncSettings();
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
    await waitForAsyncOperation(2000);

    // Check that new task type appears as a setting item
    const epicSetting = context.page.locator('.setting-item').filter({ hasText: 'Epic' }).first();
    expect(await epicSetting.isVisible()).toBe(true);

    // Check that the Epic setting has a color dropdown
    const epicDropdown = epicSetting.locator('select');
    expect(await epicDropdown.isVisible()).toBe(true);
  });

  test('should prevent adding duplicate task types', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Find the add new task type section
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });

    // Try to add existing task type
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Bug'); // Bug already exists

    // Try to click add button - it should not create a duplicate
    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();
    await waitForAsyncOperation(1000);

    // Check that we still only have one Bug setting
    const bugSettings = context.page.locator('.setting-item').filter({ hasText: 'Bug' });
    const bugCount = await bugSettings.count();
    expect(bugCount).toBe(1); // Should only have one Bug setting
  });

  test('should prevent adding empty task type', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Find the add new task type section
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });

    // Try to add empty task type
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('   '); // Only spaces

    // Try to click add button - it should not create an empty task type
    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();
    await waitForAsyncOperation(1000);

    // Check that no empty task type was added
    const emptySettings = context.page.locator('.setting-item').filter({ hasText: /^\s*$/ });
    const emptyCount = await emptySettings.count();
    expect(emptyCount).toBe(0);
  });

  test('should remove task type', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // First add a new task type to remove
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Story');

    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();
    await waitForAsyncOperation(2000);

    // Find the Story task type setting and its delete button
    const storySetting = context.page.locator('.setting-item').filter({ hasText: 'Story' }).first();
    expect(await storySetting.isVisible()).toBe(true);

    const deleteButton = storySetting.locator('button').filter({ hasText: 'Delete' });
    await deleteButton.click();
    await waitForAsyncOperation(2000);

    // Check that Story task type is no longer in the settings
    const storySettings = context.page.locator('.setting-item').filter({ hasText: 'Story' });
    const storyCount = await storySettings.count();
    expect(storyCount).toBe(0);
  });

  test('should not show delete button for last task type', async () => {
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

    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Check that the single task type doesn't have a delete button
    const taskSetting = context.page.locator('.setting-item').filter({ hasText: 'Task' }).first();
    expect(await taskSetting.isVisible()).toBe(true);

    const deleteButton = taskSetting.locator('button').filter({ hasText: 'Delete' });
    expect(await deleteButton.isVisible()).toBe(false);
  });

  test('should trigger base sync when task type is added', async () => {
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

    await waitForAsyncOperation(2000);

    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Add a new task type
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Research');

    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();
    await waitForAsyncOperation(3000); // Wait for sync to complete

    // Close settings
    await context.page.keyboard.press('Escape');
    await waitForAsyncOperation(1000);

    // Check that the area base was updated with the new task type
    const baseContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const baseFile = app.vault.getAbstractFileByPath('Bases/Test Area.base');
      if (baseFile) {
        return await app.vault.read(baseFile);
      }
      return null;
    });

    expect(baseContent).toContain('name: Researchs'); // Note: pluralized
    expect(baseContent).toContain('Type == "Research"');
  });

  test('should trigger base sync when task type is removed', async () => {
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

    await waitForAsyncOperation(2000);

    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Remove the "Chore" task type
    const choreSetting = context.page.locator('.setting-item').filter({ hasText: 'Chore' }).first();
    const deleteButton = choreSetting.locator('button').filter({ hasText: 'Delete' });
    await deleteButton.click();
    await waitForAsyncOperation(3000); // Wait for sync to complete

    // Close settings
    await context.page.keyboard.press('Escape');
    await waitForAsyncOperation(1000);

    // Check that the area base no longer has the Chore view
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

  test('should handle special characters in task type names', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Add task type with special characters
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });
    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('User Story (UI/UX)');

    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();
    await waitForAsyncOperation(2000);

    // Check that task type appears as a setting
    const userStorySetting = context.page.locator('.setting-item').filter({ hasText: 'User Story (UI/UX)' }).first();
    expect(await userStorySetting.isVisible()).toBe(true);
  });

  test('debug screenshot test', async () => {
    await createTestFolders(context.page);

    // Capture a screenshot manually
    await captureScreenshotOnFailure(context, 'debug-manual-screenshot');

    // Force a failure to test screenshot capture
    expect(true).toBe(false);
  });
});
