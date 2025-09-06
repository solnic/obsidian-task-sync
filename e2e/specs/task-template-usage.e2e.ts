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
Title: {{name}}
Type: {{type}}
Priority: {{priority}}
Areas: {{areas}}
Done: {{done}}
Status: {{status}}
tags: {{tags}}
---

## Description
{{description}}

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
          type: 'Feature',
          priority: 'High',
          areas: ['Development'],
          done: false,
          status: 'In Progress',
          tags: ['template-test'],
          description: 'This task tests template usage'
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Check if task file was created
    const taskFileExists = await fileExists(context.page, 'Tasks/Template Test Task.md');
    expect(taskFileExists).toBe(true);

    // Check task file content
    const taskContent = await getFileContent(context.page, 'Tasks/Template Test Task.md');

    // Verify template was used
    expect(taskContent).toContain('This task was created from a template!');
    expect(taskContent).toContain('## Checklist');
    expect(taskContent).toContain('- [ ] Review requirements');
    expect(taskContent).toContain('This task tests template usage');

    // Verify template variables were processed
    expect(taskContent).toContain('Title: Template Test Task');
    expect(taskContent).toContain('Type: Feature');
    expect(taskContent).toContain('Priority: High');
    expect(taskContent).toContain('Status: In Progress');
  });

  test('should require template configuration for task creation', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Ensure no template is configured
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultTaskTemplate = '';
        await plugin.saveSettings();
      }
    });

    // Try to create a task - this should fail without a template
    let errorOccurred = false;
    try {
      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins['obsidian-task-sync'];
        if (plugin) {
          await plugin.createTask({
            name: 'Should Fail Task',
            type: 'Bug',
            priority: 'Low',
            areas: [],
            done: false,
            status: 'Backlog',
            tags: [],
            description: 'This task should fail to create'
          });
        }
      });
    } catch (error) {
      errorOccurred = true;
      expect(error.message).toContain('No default task template configured');
    }

    expect(errorOccurred).toBe(true);
  });

  test('should process template variables correctly', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a template with various template variables
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Title: {{name}}
Type: {{type}}
Priority: {{priority}}
Areas: {{areas}}
Project: {{project}}
Done: {{done}}
Status: {{status}}
Parent task: {{parentTask}}
tags: {{tags}}
---

Task: {{name}}
Description: {{description}}
Created for project: {{project}}`;

      try {
        await app.vault.create('Templates/VariableTest.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultTaskTemplate = 'VariableTest.md';
        await plugin.saveSettings();
      }
    });

    // Create a task with various properties (no subTasks to avoid parent task creation)
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.createTask({
          name: 'Variable Test Task',
          type: 'Feature',
          priority: 'High',
          areas: ['Development', 'Testing'],
          project: 'Test Project',
          done: false,
          status: 'In Progress',
          parentTask: 'Parent Task',
          tags: ['test', 'variables'],
          description: 'Testing variable processing'
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Check task file content
    const taskContent = await getFileContent(context.page, 'Tasks/Variable Test Task.md');

    // Verify all variables were processed correctly
    expect(taskContent).toContain('Title: Variable Test Task');
    expect(taskContent).toContain('Type: Feature');
    expect(taskContent).toContain('Priority: High');
    expect(taskContent).toContain('Project: Test Project');
    expect(taskContent).toContain('Status: In Progress');
    expect(taskContent).toContain('Task: Variable Test Task');
    expect(taskContent).toContain('Description: Testing variable processing');
    expect(taskContent).toContain('Created for project: Test Project');
  });
});
