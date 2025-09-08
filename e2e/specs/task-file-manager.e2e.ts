/**
 * End-to-End Tests for TaskFileManager Service
 * Tests the complete TaskFileManager functionality in a real Obsidian environment
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForTaskSyncPlugin
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('TaskFileManager Service', () => {
  const context = setupE2ETestHooks();

  test('should create task file with sanitized name and proper front-matter', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Test creating a task file with invalid characters in the name
    const taskData = {
      title: 'Fix: Bug/Issue #123',
      priority: 'High',
      areas: ['Development'],
      project: 'Website Redesign',
      done: false,
      status: 'In Progress'
    };

    const taskPath = await context.page.evaluate(async (data) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      // Access the taskFileManager instance
      const taskFileManager = plugin.taskFileManager;

      return await taskFileManager.createTaskFile(data);
    }, taskData);

    // Verify the task file was created with sanitized name
    const sanitizedName = 'Fix- Bug-Issue -123';
    expect(taskPath).toBe(`Tasks/${sanitizedName}.md`);

    const taskExists = await fileExists(context.page, taskPath);
    expect(taskExists).toBe(true);

    // Verify the task content has proper front-matter structure
    const taskContent = await getFileContent(context.page, taskPath);
    expect(taskContent).toContain(`Title: '${taskData.title}'`);
    expect(taskContent).toContain(`Type: Task`);
    expect(taskContent).toContain(`Priority: ${taskData.priority}`);
    expect(taskContent).toContain(`- '[[Development]]'`);
    expect(taskContent).toContain(`Project: '[[Website Redesign]]'`);
    expect(taskContent).toContain(`Done: ${taskData.done}`);
    expect(taskContent).toContain(`Status: ${taskData.status}`);
  });

  test('should load front-matter from existing task file', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a test task file first
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const taskContent = `---
Title: Test Task
Type: Feature
Priority: Medium
Areas:
  - '[[Development]]'
  - '[[Testing]]'
Project: '[[Test Project]]'
Done: false
Status: Todo
---

This is the task description.`;
      await app.vault.create('Tasks/Test Task.md', taskContent);
    });

    // Test loading front-matter
    const frontMatter = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      const taskFileManager = plugin.taskFileManager;
      return await taskFileManager.loadFrontMatter('Tasks/Test Task.md');
    });

    expect(frontMatter.Title).toBe('Test Task');
    expect(frontMatter.Type).toBe('Feature');
    expect(frontMatter.Priority).toBe('Medium');
    expect(frontMatter.Areas).toEqual(['[[Development]]', '[[Testing]]']);
    expect(frontMatter.Project).toBe('[[Test Project]]');
    expect(frontMatter.Done).toBe(false);
    expect(frontMatter.Status).toBe('Todo');
  });

  test('should extract file content after front-matter', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a test task file with content
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const taskContent = `---
Title: Content Test Task
Type: Task
---

## Description

This is the main content of the task.

## Notes

- Note 1
- Note 2`;
      await app.vault.create('Tasks/Content Test Task.md', taskContent);
    });

    // Test extracting file content
    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      const taskFileManager = plugin.taskFileManager;
      return await taskFileManager.getFileContent('Tasks/Content Test Task.md');
    });

    expect(fileContent).toContain('## Description');
    expect(fileContent).toContain('This is the main content of the task.');
    expect(fileContent).toContain('## Notes');
    expect(fileContent).toContain('- Note 1');
    expect(fileContent).toContain('- Note 2');
    expect(fileContent).not.toContain('---');
    expect(fileContent).not.toContain('Title: Content Test Task');
  });

  test('should change task status using Done property', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a test task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const taskContent = `---
Title: Status Test Task
Type: Task
Done: false
Status: Todo
---

Task content here.`;
      await app.vault.create('Tasks/Status Test Task.md', taskContent);
    });

    // Test changing task status via Done property
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.changeTaskStatus('Tasks/Status Test Task.md', true);
    });

    // Verify the status was changed
    const updatedContent = await getFileContent(context.page, 'Tasks/Status Test Task.md');
    expect(updatedContent).toContain('Done: true');
  });

  test('should change task status using Status property', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a test task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const taskContent = `---
Title: Status String Test Task
Type: Task
Done: false
Status: Todo
---

Task content here.`;
      await app.vault.create('Tasks/Status String Test Task.md', taskContent);
    });

    // Test changing task status via Status property
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.changeTaskStatus('Tasks/Status String Test Task.md', 'Completed');
    });

    // Verify the status was changed
    const updatedContent = await getFileContent(context.page, 'Tasks/Status String Test Task.md');
    expect(updatedContent).toContain('Status: Completed');
  });

  test('should assign task to project', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a test task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const taskContent = `---
Title: Project Assignment Test
Type: Task
Project: Old Project
---

Task content here.`;
      await app.vault.create('Tasks/Project Assignment Test.md', taskContent);
    });

    // Test assigning to a new project
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.assignToProject('Tasks/Project Assignment Test.md', 'New Project');
    });

    // Verify the project was changed
    const updatedContent = await getFileContent(context.page, 'Tasks/Project Assignment Test.md');
    expect(updatedContent).toContain(`Project: '[[New Project]]'`);
    expect(updatedContent).not.toContain('Project: Old Project');
  });

  test('should assign task to areas', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a test task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const taskContent = `---
Title: Areas Assignment Test
Type: Task
Areas:
  - Development
---

Task content here.`;
      await app.vault.create('Tasks/Areas Assignment Test.md', taskContent);
    });

    // Test assigning to new areas
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.assignToAreas('Tasks/Areas Assignment Test.md', ['Testing', 'Documentation']);
    });

    // Verify the areas were changed
    const updatedContent = await getFileContent(context.page, 'Tasks/Areas Assignment Test.md');

    expect(updatedContent).toContain("- '[[Development]]'");
    expect(updatedContent).toContain("- '[[Testing]]'");
    expect(updatedContent).toContain("- '[[Documentation]]'");
  });

  test('should update specific front-matter property', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a test task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const taskContent = `---
Title: Property Update Test
Type: Task
Priority: Low
---

Task content here.`;
      await app.vault.create('Tasks/Property Update Test.md', taskContent);
    });

    // Test updating a specific property
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.updateProperty('Tasks/Property Update Test.md', 'Priority', 'Critical');
    });

    // Wait a moment for the update to be processed
    await context.page.waitForTimeout(100);

    // Verify the property was updated
    const updatedContent = await getFileContent(context.page, 'Tasks/Property Update Test.md');
    expect(updatedContent).toContain('Priority: Critical');
    expect(updatedContent).not.toContain('Priority: Low');
  });
});
