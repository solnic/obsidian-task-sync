/**
 * E2E tests for Task Type Configuration UI
 * Tests the task type management interface in plugin settings
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  waitForAsyncOperation
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Task Type Configuration', () => {
  const context = setupE2ETestHooks();

  async function openTaskSyncSettings() {
    // Open settings
    await context.page.keyboard.press('Control+,');
    await waitForAsyncOperation(1000);

    // Navigate to Community Plugins
    await context.page.locator('.vertical-tab-nav-item').filter({ hasText: 'Community plugins' }).click();
    await waitForAsyncOperation(500);

    // Find and click Task Sync plugin settings
    const taskSyncSettings = context.page.locator('.setting-item').filter({ hasText: 'Task Sync' }).locator('button').filter({ hasText: 'Options' });
    await taskSyncSettings.click();
    await waitForAsyncOperation(1000);
  }

  async function scrollToTaskTypesSection() {
    // Scroll to Task Types section (no tabs anymore, just sections)
    const taskTypesSection = context.page.locator('.task-sync-section-header').filter({ hasText: 'Task Types' });
    await taskTypesSection.scrollIntoViewIfNeeded();
    await waitForAsyncOperation(500);
  }

  test('should display task types settings section', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();

    // Check if Task Types section exists
    const taskTypesSection = context.page.locator('.task-sync-section-header').filter({ hasText: 'Task Types' });
    expect(await taskTypesSection.isVisible()).toBe(true);

    await scrollToTaskTypesSection();

    // Check if current task types section exists (with pluralization)
    const currentTypesSection = context.page.locator('h4').filter({ hasText: /\d+ Types?|Task Types/ });
    expect(await currentTypesSection.isVisible()).toBe(true);

    // Check if add new task type input exists
    const addTypeInput = context.page.locator('input[placeholder*="Epic, Story, Research"]');
    expect(await addTypeInput.isVisible()).toBe(true);
  });

  test('should display default task types', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Check if default task types are displayed
    const taskTypesList = context.page.locator('.task-sync-task-types-list');
    expect(await taskTypesList.isVisible()).toBe(true);

    // Check for default task types
    const taskTypeItems = context.page.locator('.task-sync-task-type-item');
    const taskTypeTexts = await taskTypeItems.allTextContents();

    expect(taskTypeTexts.some(text => text.includes('Task'))).toBe(true);
    expect(taskTypeTexts.some(text => text.includes('Bug'))).toBe(true);
    expect(taskTypeTexts.some(text => text.includes('Feature'))).toBe(true);
    expect(taskTypeTexts.some(text => text.includes('Improvement'))).toBe(true);
    expect(taskTypeTexts.some(text => text.includes('Chore'))).toBe(true);
  });

  test('should add new task type', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Find the new task type input
    const newTypeInput = context.page.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Epic');

    // Check that add button becomes enabled
    const addButton = context.page.locator('button').filter({ hasText: 'Add Task Type' });
    expect(await addButton.isEnabled()).toBe(true);

    // Click add button
    await addButton.click();
    await waitForAsyncOperation(1000);

    // Check that new task type appears in the list
    const taskTypeItems = context.page.locator('.task-sync-task-type-item');
    const taskTypeTexts = await taskTypeItems.allTextContents();
    expect(taskTypeTexts.some(text => text.includes('Epic'))).toBe(true);

    // Check that input is cleared
    expect(await newTypeInput.inputValue()).toBe('');

    // Check that add button is disabled again
    expect(await addButton.isEnabled()).toBe(false);
  });

  test('should prevent adding duplicate task types', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Try to add existing task type
    const newTypeInput = context.page.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Bug'); // Bug already exists

    // Check that add button remains disabled
    const addButton = context.page.locator('button').filter({ hasText: 'Add Task Type' });
    expect(await addButton.isEnabled()).toBe(false);
  });

  test('should prevent adding empty task type', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Try to add empty task type
    const newTypeInput = context.page.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('   '); // Only spaces

    // Check that add button remains disabled
    const addButton = context.page.locator('button').filter({ hasText: 'Add Task Type' });
    expect(await addButton.isEnabled()).toBe(false);
  });

  test('should remove task type', async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // First add a new task type to remove
    const newTypeInput = context.page.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Story');

    const addButton = context.page.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();
    await waitForAsyncOperation(1000);

    // Find the Story task type item and its delete button
    const storyItem = context.page.locator('.task-sync-task-type-item').filter({ hasText: 'Story' });
    expect(await storyItem.isVisible()).toBe(true);

    const deleteButton = storyItem.locator('.task-sync-delete-button');
    await deleteButton.click();
    await waitForAsyncOperation(1000);

    // Check that Story task type is no longer in the list
    const taskTypeItems = context.page.locator('.task-sync-task-type-item');
    const taskTypeTexts = await taskTypeItems.allTextContents();
    expect(taskTypeTexts.some(text => text.includes('Story'))).toBe(false);
  });

  test('should not show delete button for last task type', async () => {
    await createTestFolders(context.page);

    // Set up plugin with only one task type
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.taskTypes = ['Task']; // Only one task type
        await plugin.saveSettings();
      }
    });

    await openTaskSyncSettings();
    await scrollToTaskTypesSection();

    // Check that the single task type doesn't have a delete button
    const taskItem = context.page.locator('.task-sync-task-type-item').filter({ hasText: 'Task' });
    expect(await taskItem.isVisible()).toBe(true);

    const deleteButton = taskItem.locator('.task-sync-delete-button');
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
    const newTypeInput = context.page.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('Research');

    const addButton = context.page.locator('button').filter({ hasText: 'Add Task Type' });
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
    const choreItem = context.page.locator('.task-sync-task-type-item').filter({ hasText: 'Chore' });
    const deleteButton = choreItem.locator('.task-sync-delete-button');
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
    const newTypeInput = context.page.locator('input[placeholder*="Epic, Story, Research"]');
    await newTypeInput.fill('User Story (UI/UX)');

    const addButton = context.page.locator('button').filter({ hasText: 'Add Task Type' });
    await addButton.click();
    await waitForAsyncOperation(1000);

    // Check that task type appears in the list
    const taskTypeItems = context.page.locator('.task-sync-task-type-item');
    const taskTypeTexts = await taskTypeItems.allTextContents();
    expect(taskTypeTexts.some(text => text.includes('User Story (UI/UX)'))).toBe(true);
  });
});
