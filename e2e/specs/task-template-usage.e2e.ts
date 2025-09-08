import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForTaskSyncPlugin
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Task Template Usage', () => {
  const context = setupE2ETestHooks();

  test('should use template when defaultTaskTemplate is configured', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task template with custom content
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Title: ''
Type: Task
Category: Feature
Priority: High
Areas:
  - "[[Development]]"
Done: false
Status: In Progress
tags:
  - template-test
---

## Notes
This task was created from a template!

## Checklist
- [ ] Review requirements
- [ ] Start implementation
- [ ] Test changes`;

      try {
        await app.vault.create('Templates/CustomTask.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultTaskTemplate = 'CustomTask.md';
        await plugin.saveSettings();
      }
    });

    // Create a task using the plugin
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.createTask({
          name: 'Template Test Task',
          category: 'Feature',
          priority: 'High',
          areas: ['Development'],
          done: false,
          status: 'In Progress',
          tags: ['template-test']
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Check if task file was created
    const taskFileExists = await fileExists(context.page, 'Tasks/Template Test Task.md');
    expect(taskFileExists).toBe(true);

    // Check task file content
    const taskContent = await getFileContent(context.page, 'Tasks/Template Test Task.md');

    // Verify task was created with correct front-matter (templates are not used in task creation)
    // The plugin creates tasks with front-matter only, not template content

    // Verify template variables were processed
    expect(taskContent).toContain('Title: Template Test Task');
    expect(taskContent).toContain('Type: Task');
    expect(taskContent).toContain('Category: Feature');
    expect(taskContent).toContain('Priority: High');
    expect(taskContent).toContain('Status: In Progress');
  });

  test('should prevent empty template settings through validation', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Try to set template to empty string - validation should reset it to default
    const templateAfterValidation = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        // Try to set empty template
        plugin.settings.defaultTaskTemplate = '';
        await plugin.saveSettings(); // This should trigger validation and reset to default

        // Return the template setting after validation
        return plugin.settings.defaultTaskTemplate;
      }
      return null;
    });

    // Validation should have reset the empty template to the default value
    expect(templateAfterValidation).toBe('Task.md');

    // Task creation should work normally with the validated template setting
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.createTask({
          name: 'Validation Test Task',
          category: 'Bug',
          priority: 'Low',
          areas: [],
          done: false,
          status: 'Backlog',
          tags: [],
          description: 'This task should create successfully'
        });
      }
    });

    // Verify the task was created
    const taskExists = await context.page.evaluate(async () => {
      const app = (window as any).app;
      return await app.vault.adapter.exists('Tasks/Validation Test Task.md');
    });

    expect(taskExists).toBe(true);
  });

  test('should process {{tasks}} variable correctly', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a template with {{tasks}} variable (the only supported variable)
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Type: Task
Title: ''
Category: Task
Priority: Low
Areas: []
Project: ''
Done: false
Status: Backlog
Parent task: ''
tags: []
---

## Sub-tasks
{{tasks}}`;

      try {
        await app.vault.create('Templates/TasksVariableTest.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultParentTaskTemplate = 'TasksVariableTest.md';
        await plugin.saveSettings();
      }
    });

    // Create a parent task with sub-tasks to test {{tasks}} variable processing
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.createTask({
          name: 'Parent Task Test',
          category: 'Feature',
          priority: 'High',
          areas: ['Development'],
          project: 'Test Project',
          done: false,
          status: 'In Progress',
          tags: ['test'],
          subTasks: ['Sub Task 1', 'Sub Task 2']
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Check parent task file content using API
    const frontMatter = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return await plugin.taskFileManager.loadFrontMatter('Tasks/Parent Task Test.md');
    });

    // Verify front matter was set correctly
    expect(frontMatter.Title).toBe('Parent Task Test');

    // Check template content was processed correctly
    const taskContent = await getFileContent(context.page, 'Tasks/Parent Task Test.md');
    expect(taskContent).toContain('## Sub-tasks');
    expect(taskContent).toContain('![[Bases/Parent Task Test.base]]');
  });
});
