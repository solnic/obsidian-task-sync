/**
 * E2E tests for context-aware GitHub importing
 * Tests that import commands detect current file context and configure imports accordingly
 */

import { test, expect, describe } from 'vitest';
import { createTestFolders } from '../helpers/task-sync-setup';
import {
  setupE2ETestHooks,
  executeCommand
} from '../helpers/shared-context';
import {
  configureGitHubIntegration,
  openGitHubIssuesView,
  waitForGitHubViewContent
} from '../helpers/github-integration-helpers';

describe('Context-Aware GitHub Import', () => {
  const context = setupE2ETestHooks();

  test('should import to project when opened from project file', async () => {
    console.log('🧪 Starting context-aware project import test');

    await createTestFolders(context.page);

    // Create a test project file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const projectContent = `---
Type: Project
---

# Test Project

This is a test project for context-aware importing.
`;
      await app.vault.create('Projects/Test Project.md', projectContent);
    });

    // Open the project file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Projects/Test Project.md');
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Wait for file to be active
    await context.page.waitForTimeout(500);

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: 'solnic/obsidian-task-sync'
    });

    // Test the import command with context
    await executeCommand(context, 'Task Sync: Import GitHub Issue');

    // For this test, we'll simulate the import process
    // In a real scenario, this would prompt for issue URL and import it

    // Verify that the context detection works by checking the plugin state
    const contextDetected = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (!plugin) return null;

      // Call the detectCurrentFileContext method
      const context = plugin.detectCurrentFileContext();
      return context;
    });

    expect(contextDetected).toBeTruthy();
    expect(contextDetected.type).toBe('project');
    expect(contextDetected.name).toBe('Test Project');

    console.log('✅ Context-aware project import test completed successfully');
  });

  test('should import to area when opened from area file', async () => {
    console.log('🧪 Starting context-aware area import test');

    await createTestFolders(context.page);

    // Create a test area file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const areaContent = `---
Type: Area
---

# Development

This is a test area for context-aware importing.
`;
      await app.vault.create('Areas/Development.md', areaContent);
    });

    // Open the area file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Areas/Development.md');
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Wait for file to be active
    await context.page.waitForTimeout(500);

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: 'solnic/obsidian-task-sync'
    });

    // Verify that the context detection works
    const contextDetected = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (!plugin) return null;

      // Call the detectCurrentFileContext method
      const context = plugin.detectCurrentFileContext();
      return context;
    });

    expect(contextDetected).toBeTruthy();
    expect(contextDetected.type).toBe('area');
    expect(contextDetected.name).toBe('Development');

    console.log('✅ Context-aware area import test completed successfully');
  });

  test('should handle no context when not in project/area folder', async () => {
    console.log('🧪 Starting no context import test');

    await createTestFolders(context.page);

    // Create a regular note file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const noteContent = `# Regular Note

This is just a regular note, not in a project or area folder.
`;
      await app.vault.create('Notes/Regular Note.md', noteContent);
    });

    // Open the regular note file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Notes/Regular Note.md');
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Wait for file to be active
    await context.page.waitForTimeout(500);

    // Verify that no context is detected
    const contextDetected = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (!plugin) return null;

      // Call the detectCurrentFileContext method
      const context = plugin.detectCurrentFileContext();
      return context;
    });

    expect(contextDetected).toBeTruthy();
    expect(contextDetected.type).toBe('none');
    expect(contextDetected.name).toBeUndefined();

    console.log('✅ No context import test completed successfully');
  });
});
