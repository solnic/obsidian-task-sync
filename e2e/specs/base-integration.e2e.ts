/**
 * E2E tests for Bases integration functionality
 * Tests the BaseManager service in a real Obsidian environment
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

describe('Bases Integration', () => {
  const context = setupE2ETestHooks();

  test('should have base management functionality available', async () => {
    await createTestFolders(context.page);

    // Check if the plugin is loaded and has base management commands
    const hasRegenerateCommand = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      return 'obsidian-task-sync:regenerate-bases' in commands;
    });

    expect(hasRegenerateCommand).toBe(true);

    const hasRefreshCommand = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      return 'obsidian-task-sync:refresh-base-views' in commands;
    });

    expect(hasRefreshCommand).toBe(true);
  });

  test('should regenerate bases when command is executed', { timeout: 15000 }, async () => {
    await createTestFolders(context.page);

    // Wait for plugin to be ready
    await waitForTaskSyncPlugin(context.page);

    // Create test project and area files first
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Create a test project file
      await app.vault.create('Projects/Test Project.md', `---
Name: Test Project
Type: Project
---

# Test Project

This is a test project for bases integration.
`);

      // Create a test area file
      await app.vault.create('Areas/Test Area.md', `---
Name: Test Area
Type: Area
---

# Test Area

This is a test area for bases integration.
`);
    });

    // Wait for metadata cache to update
    await context.page.waitForTimeout(2000);

    // Execute regenerate bases command
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.regenerateBases) {
        await plugin.regenerateBases();
      }
    });

    // Wait for the command to execute
    await context.page.waitForTimeout(3000);

    // Check if Tasks.base file was created
    const baseFileExists = await fileExists(context.page, 'Bases/Tasks.base');
    expect(baseFileExists).toBe(true);

    // Check if the file contains expected base structure
    const content = await getFileContent(context.page, 'Bases/Tasks.base');
    expect(content).toContain('properties:');
    expect(content).toContain('file.name:');
    expect(content).toContain('displayName: Title');
    expect(content).toContain('views:');
    expect(content).toContain('type: table');
    expect(content).toContain('name: All');
    expect(content).toContain('name: Test Project');

    // Debug: Check what's actually in the content
    console.log('Tasks.base content:', content);

    // Note: Area views might not appear in main Tasks.base if metadata cache hasn't updated
    // Individual area bases are created separately
  });

  test('should add base embedding to project files', async () => {
    await createTestFolders(context.page);

    // Create a project file without base embedding
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create('Projects/Sample Project.md', `---
Name: Sample Project
Type: Project
---

# Sample Project

Some project content.
`);
    });

    // Execute regenerate bases command
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.regenerateBases) {
        await plugin.regenerateBases();
      }
    });

    // Wait for command to execute
    await waitForAsyncOperation(2000);

    // Check if base embedding was added to the project file
    const content = await getFileContent(context.page, 'Projects/Sample Project.md');
    expect(content).toContain('![[Bases/Sample Project.base]]');
  });

  test('should create Bases folder automatically', async () => {
    await createTestFolders(context.page);

    // Check if Bases folder was created during plugin initialization
    const basesExists = await fileExists(context.page, 'Bases');
    expect(basesExists).toBe(true);
  });
});
