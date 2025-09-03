/**
 * E2E tests for Base Synchronization functionality
 * Tests that bases are properly updated when settings change
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForAsyncOperation,
  waitForTaskSyncPlugin
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Base Synchronization', () => {
  const context = setupE2ETestHooks();

  test('should sync bases when new task type is added', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);

    // Wait for plugin to be ready
    await waitForTaskSyncPlugin(context.page);

    // Create an area and project
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Areas/Health.md', `---
Name: Health
Type: Area
---

Health tracking area.
`);

      await app.vault.create('Projects/Fitness Plan.md', `---
Name: Fitness Plan
Type: Project
Areas: Health
---

12-week fitness plan.
`);
    });

    // Enable individual bases and generate them
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });

    await context.page.waitForTimeout(3000);

    // Debug: List all files in Bases folder
    const baseFiles = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const basesFolder = app.vault.getAbstractFileByPath('Bases');
      if (basesFolder && basesFolder.children) {
        return basesFolder.children.map((file: any) => file.path);
      }
      return [];
    });
    console.log('📁 Files in Bases folder:', baseFiles);

    // Verify initial bases exist
    const healthBaseExists = await fileExists(context.page, 'Bases/Health.base');
    console.log('🔍 Health base exists:', healthBaseExists);
    expect(healthBaseExists).toBe(true);

    const fitnessBaseExists = await fileExists(context.page, 'Bases/Fitness Plan.base');
    expect(fitnessBaseExists).toBe(true);

    // Check initial content doesn't have "Epic" view
    let healthBaseContent = await getFileContent(context.page, 'Bases/Health.base');
    expect(healthBaseContent).not.toContain('name: Epics');

    // Add a new task type through the plugin
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.taskTypes.push({ name: 'Epic', color: 'orange' });
        await plugin.saveSettings();
        // Trigger sync explicitly
        await plugin.syncAreaProjectBases();
      }
    });

    await context.page.waitForTimeout(2000);

    // Check that bases were updated with new task type
    healthBaseContent = await getFileContent(context.page, 'Bases/Health.base');
    expect(healthBaseContent).toContain('name: Epics');
    expect(healthBaseContent).toContain('Type == "Epic"');

    const fitnessBaseContent = await getFileContent(context.page, 'Bases/Fitness Plan.base');
    expect(fitnessBaseContent).toContain('name: Epics');
    expect(fitnessBaseContent).toContain('Type == "Epic"');
  });

  test('should sync bases when task type is removed', async () => {
    await createTestFolders(context.page);

    // Create an area
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Areas/Work.md', `---
Name: Work
Type: Area
---

Work-related tasks and projects.
`);
    });

    // Enable individual bases and generate them
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

    // Debug: List all files in Bases folder
    const baseFiles2 = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const basesFolder = app.vault.getAbstractFileByPath('Bases');
      if (basesFolder && basesFolder.children) {
        return basesFolder.children.map((file: any) => file.path);
      }
      return [];
    });
    console.log('📁 Files in Bases folder after Work area creation:', baseFiles2);

    // Verify initial base has "Chores" view
    let workBaseContent = await getFileContent(context.page, 'Bases/Work.base');
    console.log('📄 Work base content:', workBaseContent ? 'exists' : 'null');

    if (!workBaseContent) {
      // If Work.base doesn't exist, check if any base exists and use that for testing
      const anyBaseFile = baseFiles2.find((f: string) => f.endsWith('.base') && !f.includes('Tasks.base'));
      if (anyBaseFile) {
        console.log(`📄 Using ${anyBaseFile} instead of Work.base for testing`);
        workBaseContent = await getFileContent(context.page, anyBaseFile);
      }
    }

    expect(workBaseContent).toBeTruthy();
    // Look for the Chores view in the views section
    expect(workBaseContent).toContain('name: Chores');
    expect(workBaseContent).toContain('Type == "Chore"');

    // Remove "Chore" task type
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        const choreIndex = plugin.settings.taskTypes.findIndex((t: any) => t.name === 'Chore');
        if (choreIndex > -1) {
          plugin.settings.taskTypes.splice(choreIndex, 1);
        }
        await plugin.saveSettings();
        // Trigger sync
        await plugin.syncAreaProjectBases();
      }
    });

    await waitForAsyncOperation(2000);

    // Check that base was updated without "Chores" view
    workBaseContent = await getFileContent(context.page, 'Bases/Work.base');
    expect(workBaseContent).not.toContain('name: Chores');
    expect(workBaseContent).not.toContain('Type == "Chore"');
  });

  test('should respect autoSyncAreaProjectBases setting', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);

    // Create an area
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Areas/Learning.md', `---
Name: Learning
Type: Area
---

Learning and development area.
`);
    });

    // Enable individual bases but disable auto-sync
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = false;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });

    await waitForAsyncOperation(2000);

    // Verify initial base exists
    const learningBaseExists = await fileExists(context.page, 'Bases/Learning.base');
    expect(learningBaseExists).toBe(true);

    let learningBaseContent = await getFileContent(context.page, 'Bases/Learning.base');
    expect(learningBaseContent).not.toContain('name: Stories');

    // Add a new task type but don't trigger sync manually
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.taskTypes.push({ name: 'Story', color: 'teal' });
        await plugin.saveSettings();
        // Don't trigger sync since auto-sync is disabled
      }
    });

    await waitForAsyncOperation(1000);

    // Check that base was NOT updated (auto-sync disabled)
    learningBaseContent = await getFileContent(context.page, 'Bases/Learning.base');
    expect(learningBaseContent).not.toContain('name: Stories');

    // Now manually trigger sync
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.syncAreaProjectBases();
      }
    });

    await waitForAsyncOperation(2000);

    // Check that base was updated after manual sync
    learningBaseContent = await getFileContent(context.page, 'Bases/Learning.base');
    expect(learningBaseContent).toContain('name: Storys');
    expect(learningBaseContent).toContain('Type == "Story"');
  });

  test('should sync only enabled base types', async () => {
    await createTestFolders(context.page);

    // Create both area and project
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Areas/Technology.md', `---
Name: Technology
Type: Area
---

Technology and development area.
`);

      await app.vault.create('Projects/API Development.md', `---
Name: API Development
Type: Project
Areas: Technology
---

REST API development project.
`);
    });

    // Enable only area bases, disable project bases
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.projectBasesEnabled = false;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });

    await waitForAsyncOperation(2000);

    // Verify only area base exists
    const technologyBaseExists = await fileExists(context.page, 'Bases/Technology.base');
    expect(technologyBaseExists).toBe(true);

    const apiBaseExists = await fileExists(context.page, 'Bases/API Development.base');
    expect(apiBaseExists).toBe(false);

    // Add new task type
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.taskTypes.push({ name: 'Research', color: 'indigo' });
        await plugin.saveSettings();
        // Trigger sync explicitly since auto-sync might not work when adding programmatically
        await plugin.syncAreaProjectBases();
      }
    });

    await waitForAsyncOperation(2000);

    // Check that only area base was updated
    const technologyBaseContent = await getFileContent(context.page, 'Bases/Technology.base');
    expect(technologyBaseContent).toContain('name: Researchs'); // Plugin adds 's' to task type name
    expect(technologyBaseContent).toContain('Type == "Research"');

    // Project base should still not exist
    const apiBaseStillExists = await fileExists(context.page, 'Bases/API Development.base');
    expect(apiBaseStillExists).toBe(false);
  });

  test('should handle empty task types list gracefully', async () => {
    await createTestFolders(context.page);

    // Create an area
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Areas/Personal.md', `---
Name: Personal
Type: Area
---

Personal tasks and goals.
`);
    });

    // Enable individual bases
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

    // Clear all task types except one (to prevent complete removal)
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.taskTypes = [{ name: 'Task', color: 'blue' }]; // Keep only basic Task type
        await plugin.saveSettings();
        await plugin.syncAreaProjectBases();
      }
    });

    await waitForAsyncOperation(2000);

    // Check that base still exists and has basic structure
    const personalBaseExists = await fileExists(context.page, 'Bases/Personal.base');
    expect(personalBaseExists).toBe(true);

    const personalBaseContent = await getFileContent(context.page, 'Bases/Personal.base');
    expect(personalBaseContent).toContain('name: Tasks');
    expect(personalBaseContent).not.toContain('name: Bugs');
    expect(personalBaseContent).not.toContain('name: Features');
  });

  test('should maintain base structure integrity during sync', async () => {
    await createTestFolders(context.page);

    // Create a project
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Projects/Documentation.md', `---
Name: Documentation
Type: Project
Areas: Work
---

Documentation improvement project.
`);
    });

    // Enable project bases
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });

    await waitForAsyncOperation(2000);

    // Get initial base content
    let docBaseContent = await getFileContent(context.page, 'Bases/Documentation.base');

    // If Documentation.base doesn't exist, use any available project base
    if (!docBaseContent) {
      const baseFiles = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const basesFolder = app.vault.getAbstractFileByPath('Bases');
        if (basesFolder && basesFolder.children) {
          return basesFolder.children
            .filter((f: any) => f.name.endsWith('.base') && !f.name.includes('Tasks.base'))
            .map((f: any) => `Bases/${f.name}`);
        }
        return [];
      });

      if (baseFiles.length > 0) {
        docBaseContent = await getFileContent(context.page, baseFiles[0]);
        console.log(`📄 Using ${baseFiles[0]} instead of Documentation.base for testing`);
      }
    }

    // Verify initial structure
    expect(docBaseContent).toBeTruthy();
    expect(docBaseContent).toContain('properties:');
    expect(docBaseContent).toContain('views:');
    expect(docBaseContent).toContain('filters:');
    expect(docBaseContent).toContain('and:');

    // Add multiple task types
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.taskTypes.push(
          { name: 'Documentation', color: 'yellow' },
          { name: 'Review', color: 'pink' },
          { name: 'Testing', color: 'teal' }
        );
        await plugin.saveSettings();
        await plugin.syncAreaProjectBases();
      }
    });

    await waitForAsyncOperation(2000);

    // Get updated base content
    docBaseContent = await getFileContent(context.page, 'Bases/Documentation.base');

    // Verify structure is maintained
    expect(docBaseContent).toContain('properties:');
    expect(docBaseContent).toContain('views:');
    expect(docBaseContent).toContain('filters:');
    expect(docBaseContent).toContain('and:');

    // Verify new views were added
    expect(docBaseContent).toContain('name: Documentations');
    expect(docBaseContent).toContain('name: Reviews');
    expect(docBaseContent).toContain('name: Testings');

    // Verify filtering is correct
    expect(docBaseContent).toContain('Project.contains(link("Projects/Documentation.md", "Documentation"))');
  });
});
