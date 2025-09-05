/**
 * E2E tests for Base Regeneration functionality
 * Tests that bases are regenerated with correct filter syntax and type badges
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForTaskSyncPlugin,
  waitForBaseFile,
  waitForBasesRegeneration
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Base Regeneration', () => {
  const context = setupE2ETestHooks();

  test('should generate correct link syntax in area bases after regeneration', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create the numbered folder structure first
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Create the numbered folder if it doesn't exist
      try {
        await app.vault.createFolder('2. Areas');
      } catch (error) {
        // Folder might already exist
      }

      await app.vault.create('2. Areas/Task Sync.md', `---
Name: Task Sync
Type: Area
---

This is the Task Sync area for managing plugin development.

## Tasks

![[Tasks.base]]
`);
    });

    // Enable area bases and regenerate
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areasFolder = '2. Areas';
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });

    // Wait for the area base to be created
    await waitForBaseFile(context.page, 'Bases/Task Sync.base');

    // Check that the area base was created
    const baseExists = await fileExists(context.page, 'Bases/Task Sync.base');
    expect(baseExists).toBe(true);

    // Check that the filter syntax is correct
    const baseContent = await getFileContent(context.page, 'Bases/Task Sync.base');
    expect(baseContent).toContain('Areas.contains(link("Task Sync"))');
    expect(baseContent).not.toContain('Areas.contains(link("Task Sync.md"))');
  });

  test('should generate correct link syntax in project bases after regeneration', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a project using the default folder structure
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Projects/Website Redesign.md', `---
Name: Website Redesign
Type: Project
Areas: Work
---

Website redesign project for the company.

## Tasks

![[Tasks.base]]
`);
    });

    // Enable project bases and regenerate
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

    // Wait for bases regeneration to complete
    await waitForBasesRegeneration(context.page);

    // Debug: Check what files exist in the Bases folder
    const basesFiles = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const basesFolder = app.vault.getAbstractFileByPath('Bases');
      if (basesFolder && basesFolder.children) {
        return basesFolder.children.map((file: any) => file.name);
      }
      return [];
    });
    console.log('Files in Bases folder:', basesFiles);

    // Debug: Check what projects were detected
    const projectsDetected = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.baseManager) {
        const projectsAndAreas = await plugin.baseManager.getProjectsAndAreas();
        return projectsAndAreas;
      }
      return [];
    });
    console.log('Projects and areas detected:', projectsDetected);

    // Debug: Check plugin settings
    const pluginSettings = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        return {
          projectBasesEnabled: plugin.settings.projectBasesEnabled,
          autoSyncAreaProjectBases: plugin.settings.autoSyncAreaProjectBases,
          basesFolder: plugin.settings.basesFolder
        };
      }
      return null;
    });
    console.log('Plugin settings:', pluginSettings);

    // Check that the project base was created
    const baseExists = await fileExists(context.page, 'Bases/Website Redesign.base');
    expect(baseExists).toBe(true);

    // Check that the filter syntax is correct
    const baseContent = await getFileContent(context.page, 'Bases/Website Redesign.base');
    expect(baseContent).toContain('Project.contains(link("Website Redesign"))');
    expect(baseContent).not.toContain('Project.contains(link("Website Redesign.md"))');
  });

  test('should generate clean type display in base formulas', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Configure custom task types with colors and regenerate main base
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.taskTypes = [
          { name: 'Bug', color: 'red' },
          { name: 'Feature', color: 'blue' },
          { name: 'Task', color: 'green' }
        ];
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });

    // Wait for bases regeneration to complete
    await waitForBasesRegeneration(context.page);

    // Check that the main Tasks base has correct type badge formula
    const baseExists = await fileExists(context.page, 'Bases/Tasks.base');
    expect(baseExists).toBe(true);

    // Check that type formula is correct (using formulas section)
    const baseContent = await getFileContent(context.page, 'Bases/Tasks.base');
    expect(baseContent).toContain('formulas:');
    expect(baseContent).toContain('Title: link(file.name, Title)');
    expect(baseContent).toContain('name: Type');
    expect(baseContent).toContain('type: string');

    // Should use simple Type display without complex formatting
    expect(baseContent).not.toContain('if(Type ==');
    expect(baseContent).not.toContain('RED:');
    expect(baseContent).not.toContain('BLUE:');

    // Should use Type in views (simplified property names)
    expect(baseContent).toContain('Type == "');

    // Should NOT contain HTML spans or old Type Badge property
    expect(baseContent).not.toContain('<span');
    expect(baseContent).not.toContain('task-type-badge');
    expect(baseContent).not.toContain('note.Type Badge');
  });

  test('should regenerate bases with correct syntax using command', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create both area and project
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Create the numbered folder if it doesn't exist
      try {
        await app.vault.createFolder('2. Areas');
      } catch (error) {
        // Folder might already exist
      }

      await app.vault.create('2. Areas/Health & Fitness.md', `---
Name: Health & Fitness
Type: Area
---

Health and fitness tracking area.
`);

      await app.vault.create('Projects/Marathon Training.md', `---
Name: Marathon Training
Type: Project
Areas: Health & Fitness
---

Marathon training project.
`);
    });

    // Enable both types of bases
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
      }
    });

    // Use the refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for bases regeneration to complete
    await waitForBasesRegeneration(context.page);

    // Check that both bases were created with correct syntax
    const areaBaseExists = await fileExists(context.page, 'Bases/Health & Fitness.base');
    expect(areaBaseExists).toBe(true);

    const projectBaseExists = await fileExists(context.page, 'Bases/Marathon Training.base');
    expect(projectBaseExists).toBe(true);

    // Check area base syntax
    const areaBaseContent = await getFileContent(context.page, 'Bases/Health & Fitness.base');
    expect(areaBaseContent).toContain('Areas.contains(link("Health & Fitness"))');

    // Check project base syntax
    const projectBaseContent = await getFileContent(context.page, 'Bases/Marathon Training.base');
    expect(projectBaseContent).toContain('Project.contains(link("Marathon Training"))');
  });

  test('should handle special characters in file names correctly', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create files with special characters
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Create the numbered folder if it doesn't exist
      try {
        await app.vault.createFolder('2. Areas');
      } catch (error) {
        // Folder might already exist
      }

      await app.vault.create('2. Areas/R&D (Research).md', `---
Name: R&D (Research)
Type: Area
---

Research and development area.
`);

      await app.vault.create('Projects/API v2.0 Development.md', `---
Name: API v2.0 Development
Type: Project
Areas: R&D (Research)
---

API version 2.0 development project.
`);
    });

    // Enable bases and regenerate
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

    // Wait for bases regeneration to complete
    await waitForBasesRegeneration(context.page);

    // Check that bases were created
    const areaBaseExists = await fileExists(context.page, 'Bases/R&D (Research).base');
    expect(areaBaseExists).toBe(true);

    const projectBaseExists = await fileExists(context.page, 'Bases/API v2.0 Development.base');
    expect(projectBaseExists).toBe(true);

    // Check that special characters are handled correctly in filters
    const areaBaseContent = await getFileContent(context.page, 'Bases/R&D (Research).base');
    expect(areaBaseContent).toContain('Areas.contains(link("R&D (Research)"))');

    const projectBaseContent = await getFileContent(context.page, 'Bases/API v2.0 Development.base');
    expect(projectBaseContent).toContain('Project.contains(link("API v2.0 Development"))');
  });
});
