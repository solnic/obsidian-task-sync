import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForTaskSyncPlugin
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Template Auto-Creation', () => {
  const context = setupE2ETestHooks();

  test('should create default Task.md template when missing during plugin initialization', async () => {
    await createTestFolders(context.page);

    // Check if template already exists from plugin initialization
    const templateExists = await fileExists(context.page, 'Templates/Task.md');

    if (!templateExists) {
      // Template doesn't exist, so plugin initialization should create it
      await waitForTaskSyncPlugin(context.page);
      await context.page.waitForTimeout(1000);

      const templateExistsAfterInit = await fileExists(context.page, 'Templates/Task.md');
      expect(templateExistsAfterInit).toBe(true);
    } else {
      // Template already exists, which means plugin initialization worked
      console.log('Template already exists from plugin initialization - this is the expected behavior');
    }

    // Verify template has proper structure
    const templateContent = await getFileContent(context.page, 'Templates/Task.md');
    expect(templateContent).toContain('---');
    expect(templateContent).toContain('Title:');
    expect(templateContent).toContain('Type:');
    expect(templateContent).toContain('Priority: Low');
    expect(templateContent).toContain('Areas: []');
    expect(templateContent).toContain('Project:');
    expect(templateContent).toContain('Done: false');
    expect(templateContent).toContain('Status:');
    expect(templateContent).toContain('Parent task:');
    expect(templateContent).toContain('Sub-tasks: []');
    expect(templateContent).toContain('tags: []');
    expect(templateContent).toContain('{{description}}');

    // Verify settings reflect the created template
    const settings = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return plugin ? plugin.settings : null;
    });

    expect(settings).toBeTruthy();
    expect(settings.defaultTaskTemplate).toBe('Task.md');
  });

  test('should create task successfully after template auto-creation', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Wait for template auto-creation
    await context.page.waitForTimeout(1000);

    // Create a task to verify the template works
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin) {
        await plugin.createTask({
          name: 'Test Task After Auto-Creation',
          description: 'This task should use the auto-created template',
          type: 'Task',
          priority: 'Medium',
          areas: ['Test Area'],
          project: 'Test Project'
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Verify task was created successfully
    const taskExists = await fileExists(context.page, 'Tasks/Test Task After Auto-Creation.md');
    expect(taskExists).toBe(true);

    // Verify task content uses template structure
    const taskContent = await getFileContent(context.page, 'Tasks/Test Task After Auto-Creation.md');
    expect(taskContent).toContain('Title: Test Task After Auto-Creation');
    expect(taskContent).toContain('Type: Task');
    expect(taskContent).toContain('Priority: Medium'); // Uses default value from property definition
    expect(taskContent).toContain(`- "[[Test Area]]"`); // YAML array format
    expect(taskContent).toContain("Project: '[[Test Project]]'"); // Project field uses empty string default
    expect(taskContent).toContain('This task should use the auto-created template');
  });

  test('should not recreate template if it already exists', async () => {
    await createTestFolders(context.page);

    // Create a custom Task.md template first
    const customTemplateContent = `---
Title:
Type:
Priority: Low
Areas: []
Project:
Done: false
Status:
Parent task:
Sub-tasks: []
tags: []
---

# Custom Template

{{description}}

This is a custom template that should not be overwritten.
`;

    await context.page.evaluate(async (content) => {
      const app = (window as any).app;
      await app.vault.create('Templates/Task.md', content);
    }, customTemplateContent);

    // Initialize plugin
    await waitForTaskSyncPlugin(context.page);
    await context.page.waitForTimeout(1000);

    // Verify the custom template was not overwritten
    const templateContent = await getFileContent(context.page, 'Templates/Task.md');
    expect(templateContent).toContain('# Custom Template');
    expect(templateContent).toContain('This is a custom template that should not be overwritten.');
  });

  test('should auto-create missing template during task creation', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Wait for initial template creation
    await context.page.waitForTimeout(1000);

    // Check if template exists first
    const templateExistsInitially = await fileExists(context.page, 'Templates/Task.md');

    if (templateExistsInitially) {
      // Delete the template after plugin initialization
      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const templateFile = app.vault.getAbstractFileByPath('Templates/Task.md');
        if (templateFile) {
          await app.vault.delete(templateFile);
        }
      });

      // Verify template was deleted
      const templateExistsAfterDeletion = await fileExists(context.page, 'Templates/Task.md');
      expect(templateExistsAfterDeletion).toBe(false);
    } else {
      // Template doesn't exist initially, which is fine for this test
      console.log('Template does not exist initially - proceeding with test');
    }

    // Try to create a task - this should auto-create the missing template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin) {
        await plugin.createTask({
          name: 'Auto Template Task',
          description: 'This should auto-create template',
          priority: 'High'
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Verify template was auto-created
    const templateNowExists = await fileExists(context.page, 'Templates/Task.md');
    expect(templateNowExists).toBe(true);

    // Verify task was created successfully
    const taskExists = await fileExists(context.page, 'Tasks/Auto Template Task.md');
    expect(taskExists).toBe(true);

    // Verify task content
    const taskContent = await getFileContent(context.page, 'Tasks/Auto Template Task.md');
    expect(taskContent).toContain('Title: Auto Template Task');
    expect(taskContent).toContain('Type: Task');
    expect(taskContent).toContain('Priority: High');
    expect(taskContent).toContain('This should auto-create template');
  });
});
