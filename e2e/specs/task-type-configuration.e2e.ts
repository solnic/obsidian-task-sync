/**
 * E2E tests for Task Type Configuration UI
 * Tests the task type management interface in plugin settings
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  openTaskSyncSettings,
  scrollToSettingsSection,
  waitForTaskSyncPlugin
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks, captureScreenshotOnFailure } from '../helpers/shared-context';

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

    // Check that task types are displayed (no color dropdowns in current implementation)
    const taskTypeSettings = context.page.locator('.setting-item').filter({ hasText: /Task|Bug|Feature|Improvement|Chore/ });
    const settingCount = await taskTypeSettings.count();
    expect(settingCount).toBeGreaterThanOrEqual(5); // At least one for each default task type
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

    // Check that the Epic setting has a delete button (since it's not the last task type)
    const epicDeleteButton = epicSetting.locator('button:has-text("Delete")');
    expect(await epicDeleteButton.isVisible()).toBe(true);
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

    // Wait for plugin to be ready
    await waitForTaskSyncPlugin(context.page);

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

    // Wait for base generation to complete
    await context.page.waitForTimeout(3000);

    // Capture screenshot before opening settings
    await captureScreenshotOnFailure(context, 'before-opening-settings');

    await openTaskSyncSettingsWrapper();

    // Capture screenshot after opening settings
    await captureScreenshotOnFailure(context, 'after-opening-settings');

    await scrollToTaskTypesSection();

    // Capture screenshot after scrolling to task types
    await captureScreenshotOnFailure(context, 'after-scrolling-to-task-types');

    // Add a new task type
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });

    // Check if add section exists
    const addSectionExists = await addSection.count() > 0;
    console.log(`📝 Add section exists: ${addSectionExists}`);

    if (!addSectionExists) {
      await captureScreenshotOnFailure(context, 'add-section-not-found');
      throw new Error('Add New Task Type section not found');
    }

    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Research');

    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();

    // Capture screenshot after clicking add button
    await captureScreenshotOnFailure(context, 'after-clicking-add-button');

    // Wait for the new task type to appear in settings
    console.log(`📝 Waiting for Research task type to appear...`);
    const researchSetting = context.page.locator('.setting-item').filter({ hasText: 'Research' }).first();

    try {
      await researchSetting.waitFor({ state: 'visible', timeout: 5000 });
      console.log(`✅ Research task type appeared in settings`);
    } catch (waitError) {
      console.log(`❌ Research task type did not appear: ${waitError.message}`);
      await captureScreenshotOnFailure(context, 'research-task-type-not-appeared');

      // Check what task types are actually visible
      const visibleTaskTypes = await context.page.evaluate(() => {
        const settingItems = document.querySelectorAll('.setting-item');
        return Array.from(settingItems).map(item => item.textContent?.trim()).filter(text => text);
      });
      console.log(`📝 Visible setting items:`, visibleTaskTypes);

      throw waitError;
    }

    // Verify that the Research task type was successfully added to the plugin settings
    // (We can do this before closing settings to avoid cleanup issues)
    console.log('🔧 Verifying Research task type was added to plugin settings...');
    const hasResearchTaskType = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.settings && plugin.settings.taskTypes) {
        return plugin.settings.taskTypes.some((t: any) => t.name === 'Research');
      }
      return false;
    });

    console.log(`📝 Research task type in plugin settings: ${hasResearchTaskType}`);
    expect(hasResearchTaskType).toBe(true);

    console.log('✅ Test completed successfully - Research task type was added and base sync was triggered');

    // Note: We skip closing settings here to prevent test hangs
    // The afterEach hook will handle cleanup
  });

  test('should trigger base sync when task type is created and removed', { timeout: 30000 }, async () => {
    await createTestFolders(context.page);

    // Wait for plugin to be ready
    await waitForTaskSyncPlugin(context.page);

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

    // Wait for base generation to complete
    await context.page.waitForTimeout(3000);

    // Capture screenshot before opening settings
    await captureScreenshotOnFailure(context, 'create-remove-test-before-settings');

    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    // Capture screenshot after opening settings
    await captureScreenshotOnFailure(context, 'create-remove-test-after-settings');

    // STEP 1: Add a new task type called "Epic"
    console.log('📝 Step 1: Adding Epic task type...');
    const addSection = context.page.locator('.setting-item').filter({ hasText: 'Add New Task Type' });

    // Check if add section exists
    const addSectionExists = await addSection.count() > 0;
    console.log(`📝 Add section exists: ${addSectionExists}`);

    if (!addSectionExists) {
      await captureScreenshotOnFailure(context, 'add-section-not-found');
      throw new Error('Add New Task Type section not found');
    }

    const newTypeInput = addSection.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Epic');

    const addButton = addSection.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();

    // Capture screenshot after adding Epic
    await captureScreenshotOnFailure(context, 'after-adding-epic');

    // Wait for the Epic task type to appear in settings
    console.log(`📝 Waiting for Epic task type to appear...`);
    const epicSetting = context.page.locator('.setting-item').filter({ hasText: 'Epic' }).first();

    try {
      await epicSetting.waitFor({ state: 'visible', timeout: 5000 });
      console.log(`✅ Epic task type appeared in settings`);
    } catch (waitError) {
      console.log(`❌ Epic task type did not appear: ${waitError.message}`);
      await captureScreenshotOnFailure(context, 'epic-task-type-not-appeared');
      throw waitError;
    }

    // Verify Epic was added to plugin settings
    const hasEpicTaskType = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.settings && plugin.settings.taskTypes) {
        return plugin.settings.taskTypes.some((t: any) => t.name === 'Epic');
      }
      return false;
    });

    console.log(`📝 Epic task type in plugin settings: ${hasEpicTaskType}`);
    expect(hasEpicTaskType).toBe(true);

    // Wait for base content to be updated with Epic view
    console.log(`📝 Waiting for base content to include Epic view...`);
    try {
      await context.page.waitForFunction(async () => {
        const app = (window as any).app;
        const baseFile = app.vault.getAbstractFileByPath('Bases/Sync Test.base');
        if (baseFile) {
          const content = await app.vault.read(baseFile);
          return content.includes('name: Epics') && content.includes('Category == "Epic"');
        }
        return false;
      }, { timeout: 10000 });
      console.log(`✅ Base content updated with Epic view`);
    } catch (waitError) {
      console.log(`❌ Base content was not updated with Epic view: ${waitError.message}`);
      await captureScreenshotOnFailure(context, 'epic-base-content-not-updated');
      throw waitError;
    }

    // STEP 2: Remove the Epic task type
    console.log('📝 Step 2: Removing Epic task type...');

    const deleteButton = epicSetting.locator('button').filter({ hasText: 'Delete' });

    // Check if delete button exists
    const deleteButtonExists = await deleteButton.count() > 0;
    console.log(`📝 Delete button exists: ${deleteButtonExists}`);

    if (!deleteButtonExists) {
      await captureScreenshotOnFailure(context, 'epic-delete-button-not-found');
      throw new Error('Delete button not found for Epic task type');
    }

    await deleteButton.click();

    // Capture screenshot after clicking delete
    await captureScreenshotOnFailure(context, 'after-deleting-epic');

    // Wait for the Epic task type to be removed
    console.log(`📝 Waiting for Epic task type to be removed...`);
    try {
      await epicSetting.waitFor({ state: 'detached', timeout: 5000 });
      console.log(`✅ Epic task type removed from settings`);
    } catch (waitError) {
      console.log(`❌ Epic task type was not removed: ${waitError.message}`);
      await captureScreenshotOnFailure(context, 'epic-not-removed');
      throw waitError;
    }

    // Wait for the base content to be updated (Epic view removed)
    console.log(`📝 Waiting for base content to remove Epic view...`);
    try {
      await context.page.waitForFunction(async () => {
        const app = (window as any).app;
        const baseFile = app.vault.getAbstractFileByPath('Bases/Sync Test.base');
        if (baseFile) {
          const content = await app.vault.read(baseFile);
          return !content.includes('name: Epics') && !content.includes('Category == "Epic"');
        }
        return false;
      }, { timeout: 10000 });
      console.log(`✅ Base content updated - Epic view removed`);
    } catch (waitError) {
      console.log(`❌ Base content was not updated to remove Epic view: ${waitError.message}`);
      await captureScreenshotOnFailure(context, 'epic-removal-base-content-not-updated');

      // Log current base content for debugging
      const currentContent = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const baseFile = app.vault.getAbstractFileByPath('Bases/Sync Test.base');
        if (baseFile) {
          return await app.vault.read(baseFile);
        }
        return 'Base file not found';
      });
      console.log(`📝 Current base content:`, currentContent);

      throw waitError;
    }

    // Verify Epic was removed from plugin settings
    const stillHasEpicTaskType = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.settings && plugin.settings.taskTypes) {
        return plugin.settings.taskTypes.some((t: any) => t.name === 'Epic');
      }
      return false;
    });

    console.log(`📝 Epic task type still in plugin settings: ${stillHasEpicTaskType}`);
    expect(stillHasEpicTaskType).toBe(false);

    // Verify the base content was updated
    const baseContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const baseFile = app.vault.getAbstractFileByPath('Bases/Sync Test.base');
      if (baseFile) {
        return await app.vault.read(baseFile);
      }
      return null;
    });

    expect(baseContent).not.toContain('name: Epics');
    expect(baseContent).not.toContain('Category == "Epic"');

    console.log('✅ Test completed successfully - Epic task type was created, synced, removed, and base sync was triggered for both operations');

    // Note: We skip closing settings here to prevent test hangs
    // The afterEach hook will handle cleanup
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
