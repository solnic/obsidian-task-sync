import { test, expect, describe } from 'vitest';
import { createTestFolders, waitForTaskSyncPlugin } from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Refresh Status Property', () => {
  const context = setupE2ETestHooks();

  test('should add Status property to existing task files during refresh', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create task files without Status property
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Task 1: Minimal front-matter (missing Status)
      await app.vault.create('Tasks/Task Without Status.md', `---
Title: Task Without Status
Type: Task
Done: false
---

This task is missing the Status field.`);

      // Task 2: Has some properties but missing Status
      await app.vault.create('Tasks/Another Task.md', `---
Title: Another Task
Type: Feature
Priority: High
Done: false
Project: "[[Test Project]]"
---

Another task missing Status field.`);

      // Task 3: Has most properties but missing Status
      await app.vault.create('Tasks/Complex Task.md', `---
Title: Complex Task
Type: Bug
Areas: "[[Test Area]]"
Parent task:
Sub-tasks: []
tags: [urgent, bug]
Project: "[[Test Project]]"
Done: true
Priority: Urgent
---

Complex task missing Status field.`);
    });

    // Verify files don't have Status initially
    const filesBeforeRefresh = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const results: { filename: string; hasStatus: boolean; content: string }[] = [];

      const files = [
        'Tasks/Task Without Status.md',
        'Tasks/Another Task.md',
        'Tasks/Complex Task.md'
      ];

      for (const filePath of files) {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
          const content = await app.vault.read(file);
          const hasStatus = content.includes('Status:');

          results.push({
            filename: filePath,
            hasStatus,
            content
          });
        }
      }

      return results;
    });

    // Verify no files have Status initially
    for (const fileResult of filesBeforeRefresh) {
      expect(fileResult.hasStatus).toBe(false);
      console.log(`Before refresh - ${fileResult.filename}: Status present = ${fileResult.hasStatus}`);
    }

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(5000);

    // Check that Status field was added to all files
    const filesAfterRefresh = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const results: { filename: string; hasStatus: boolean; statusValue: string; content: string }[] = [];

      const files = [
        'Tasks/Task Without Status.md',
        'Tasks/Another Task.md',
        'Tasks/Complex Task.md'
      ];

      for (const filePath of files) {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
          const content = await app.vault.read(file);
          const hasStatus = content.includes('Status:');

          // Extract Status value if present
          const statusMatch = content.match(/Status:\s*(.+)/);
          const statusValue = statusMatch ? statusMatch[1].trim() : '';

          results.push({
            filename: filePath,
            hasStatus,
            statusValue,
            content
          });
        }
      }

      return results;
    });

    // Verify ALL files now have Status field with default value
    expect(filesAfterRefresh).toHaveLength(3);

    for (const fileResult of filesAfterRefresh) {
      console.log(`After refresh - ${fileResult.filename}:`);
      console.log(`  Status present: ${fileResult.hasStatus}`);
      console.log(`  Status value: "${fileResult.statusValue}"`);
      console.log(`  Content:\n${fileResult.content}\n`);

      expect(fileResult.hasStatus).toBe(true);
      expect(fileResult.statusValue).toBe('Backlog'); // Should use default value
    }
  });

  test('should add ALL missing schema properties during refresh', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task with minimal front-matter
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Minimal Task.md', `---
Title: Minimal Task
---

This task has only a title.`);
    });

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(5000);

    // Check that ALL schema properties were added
    const fileAfterRefresh = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Minimal Task.md');
      if (file) {
        const content = await app.vault.read(file);
        return content;
      }
      return '';
    });

    console.log('File content after refresh:', fileAfterRefresh);

    // Verify all expected properties are present
    const expectedProperties = [
      'Title:',
      'Type:',
      'Areas:',
      'Parent task:',
      'Sub-tasks:',
      'tags:',
      'Project:',
      'Done:',
      'Status:',
      'Priority:'
    ];

    for (const property of expectedProperties) {
      expect(fileAfterRefresh).toContain(property);
    }

    // Verify Status has default value
    expect(fileAfterRefresh).toMatch(/Status:\s*Backlog/);
  });
});
