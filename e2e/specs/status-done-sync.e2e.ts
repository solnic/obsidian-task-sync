/**
 * E2E tests for Status and Done field synchronization
 * Tests the file change listener and event system in actual Obsidian environment
 */

import { test, expect, describe } from 'vitest';
import { setupE2ETestHooks } from '../helpers/shared-context';
import { createTestFolders, waitForTaskSyncPlugin } from '../helpers/task-sync-setup';
import { createTask } from '../helpers/entity-helpers';

const context = setupE2ETestHooks();

describe('Status and Done Field Synchronization', () => {

  test('should update Done field when Status changes to a done status', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task with initial status using entity helper
    await createTask(context, {
      title: 'Test Task',
      priority: 'Medium',
      areas: ['Development'],
      project: 'Test Project',
      done: false,
      status: 'Backlog',
      tags: ['test']
    }, 'This is a test task for status/done synchronization.');

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Update the status to a "done" status
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Test Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Backlog', 'Status: Done');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for the event system to process the change
    await context.page.waitForTimeout(1000);

    // Verify that Done field was automatically updated
    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Test Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Done');
    expect(fileContent).toContain('Done: true');
  });

  test('should update Done field when Status changes to a non-done status', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task with done status using entity helper
    await createTask(context, {
      title: 'Completed Task',
      priority: 'High',
      areas: ['Development'],
      project: 'Test Project',
      done: true,
      status: 'Done',
      tags: ['test']
    }, 'This task was completed but needs to be reopened.');

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Update the status to a non-done status
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Completed Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Done', 'Status: In Progress');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for the event system to process the change
    await context.page.waitForTimeout(1000);

    // Verify that Done field was automatically updated
    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Completed Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: In Progress');
    expect(fileContent).toContain('Done: false');
  });

  test('should update Status field when Done changes to true', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task with non-done status using entity helper
    await createTask(context, {
      title: 'Active Task',
      priority: 'Low',
      areas: ['Development'],
      project: 'Test Project',
      done: false,
      status: 'In Progress',
      tags: ['test']
    }, 'This task is in progress but will be marked as done.');

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Update the Done field to true
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Active Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Done: false', 'Done: true');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for the event system to process the change
    await context.page.waitForTimeout(1000);

    // Verify that Status field was automatically updated to a done status
    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Active Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Done: true');
    // Should update to a done status (Done is the default done status)
    expect(fileContent).toContain('Status: Done');
  });

  test('should update Status field when Done changes to false', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task with done status using entity helper
    await createTask(context, {
      title: 'Finished Task',
      priority: 'Medium',
      areas: ['Development'],
      project: 'Test Project',
      done: true,
      status: 'Done',
      tags: ['test']
    }, 'This task was finished but needs to be reopened.');

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Update the Done field to false
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Finished Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Done: true', 'Done: false');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for the event system to process the change
    await context.page.waitForTimeout(1000);

    // Verify that Status field was automatically updated to a non-done status
    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Finished Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Done: false');
    // Should update to a non-done status (Backlog is the default non-done status)
    expect(fileContent).toContain('Status: Backlog');
  });

  test('should not create infinite loops when both fields change', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task using entity helper
    await createTask(context, {
      title: 'Loop Test Task',
      priority: 'High',
      areas: ['Development'],
      project: 'Test Project',
      done: false,
      status: 'Backlog',
      tags: ['test']
    }, 'This task tests that we don\'t create infinite loops.');

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Get initial modification time
    const initialMtime = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Loop Test Task.md');
      return file ? file.stat.mtime : 0;
    });

    // Update the status
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Loop Test Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Backlog', 'Status: Done');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for processing
    await context.page.waitForTimeout(1000);

    // Get final modification time
    const finalMtime = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Loop Test Task.md');
      return file ? file.stat.mtime : 0;
    });

    // Verify the file was updated but not in an infinite loop
    expect(finalMtime).toBeGreaterThan(initialMtime);

    // Wait a bit more to ensure no additional modifications
    await context.page.waitForTimeout(1000);

    const finalMtime2 = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Loop Test Task.md');
      return file ? file.stat.mtime : 0;
    });

    // Should not have been modified again
    expect(finalMtime2).toBe(finalMtime);
  });

  test('should handle files without frontmatter gracefully', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task without frontmatter
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/No Frontmatter Task.md', `This is a task without frontmatter.

It should not cause errors in the event system.`);
    });

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Add frontmatter with status
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/No Frontmatter Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = `---
Title: No Frontmatter Task
Status: Done
---

${content}`;
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for the event system to process the change
    await context.page.waitForTimeout(1000);

    // Verify that Done field was automatically added
    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/No Frontmatter Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Done');
    expect(fileContent).toContain('Done: true');
  });

  test('should only process files in configured folders', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a file outside the configured folders
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Notes/Random Note.md', `---
Title: Random Note
Status: Done
Done: false
---

This is a note outside the task folders.`);
    });

    // Wait for file to be created
    await context.page.waitForTimeout(500);

    // Update the status
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Notes/Random Note.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Done', 'Status: Backlog');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for potential processing
    await context.page.waitForTimeout(1000);

    // Verify that Done field was NOT automatically updated (since it's not in a tracked folder)
    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Notes/Random Note.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Backlog');
    expect(fileContent).toContain('Done: false'); // Should remain unchanged
  });

  test('should handle custom status configurations', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Configure custom statuses with isDone properties
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin) {
        // Add a custom done status
        plugin.settings.taskStatuses.push({
          name: 'Completed',
          color: 'green',
          isDone: true
        });

        await plugin.saveSettings();
      }
    });

    // Create a task
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Custom Status Task.md', `---
Title: Custom Status Task
Type: Task
Priority: Medium
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
tags: test
---

This task tests custom status configurations.`);
    });

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Update to custom done status
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Custom Status Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Backlog', 'Status: Completed');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for the event system to process the change
    await context.page.waitForTimeout(1000);

    // Verify that Done field was automatically updated
    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Custom Status Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Completed');
    expect(fileContent).toContain('Done: true');
  });
});
