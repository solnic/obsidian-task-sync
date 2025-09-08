/**
 * E2E Tests for Clean Template Generation
 * Tests that verify templates are generated without pre-filled values
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  waitForTaskSyncPlugin,
  getFileContent,
  fileExists
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Clean Template Generation', () => {
  const context = setupE2ETestHooks();

  test('should generate task template with configured default values', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task template using the TemplateManager
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin && plugin.templateManager) {
        await plugin.templateManager.createTaskTemplate('Clean Task.md');
      }
    });

    // Verify the template file was created
    const templateExists = await fileExists(context.page, 'Templates/Clean Task.md');
    expect(templateExists).toBe(true);

    // Verify the template has proper front-matter structure with defaults
    const templateContent = await getFileContent(context.page, 'Templates/Clean Task.md');

    // Should have front-matter structure with configured default values
    expect(templateContent).toContain('---');
    expect(templateContent).toContain('Title:');
    expect(templateContent).toContain('Type:');
    expect(templateContent).toContain('Priority:');
    expect(templateContent).toContain('Areas:');
    expect(templateContent).toContain('Project:');
    expect(templateContent).toContain('Done:');
    expect(templateContent).toContain('Status:');
    expect(templateContent).toContain('Parent task:');

    expect(templateContent).toContain('tags:');

    // Should have configured default values
    expect(templateContent).toContain('Priority: Low');
    expect(templateContent).toContain('Done: false');
    expect(templateContent).toContain('Status: Backlog');

    // Arrays should be empty
    expect(templateContent).toContain('Areas: []');

    expect(templateContent).toContain('tags: []');

    // Only {{tasks}} variable is supported, no {{description}}
  });

  test('should create task from clean template and set default values via handler', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // First create a clean template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin && plugin.templateManager) {
        await plugin.templateManager.createTaskTemplate('Clean Task Template.md');
      }
    });

    // Get the template content
    const templateContent = await getFileContent(context.page, 'Templates/Clean Task Template.md');

    // Create a task using the template content (simulating user copying template)
    const taskName = 'Task from Clean Template';
    const taskPath = `Tasks/${taskName}.md`;

    // Use the template content but with a title filled in
    // Handle both empty quotes and no quotes in Title field
    const taskContent = templateContent?.replace(/Title:\s*['"]?['"]?\s*$/m, `Title: ${taskName}`);

    // Create the task file
    await context.page.evaluate(
      async ({ path, content }: { path: string; content: string }) => {
        const app = (window as any).app;
        await app.vault.create(path, content);
      },
      { path: taskPath, content: taskContent }
    );

    // Wait for the TaskPropertyHandler to process the file
    await context.page.waitForTimeout(1000);

    // Verify the file was updated with default values by the handler using API
    const frontMatter = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return await plugin.taskFileManager.loadFrontMatter(path);
    }, taskPath);

    expect(frontMatter.Type).toBe('Task'); // Should be set by handler
    expect(frontMatter.Done).toBe(false); // Should be set by handler
    expect(frontMatter.Status).toBe('Backlog'); // Should be set by handler
    expect(frontMatter.Title).toBe(taskName); // Should preserve user input
  });
});
