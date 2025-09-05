import { test, expect, describe } from 'vitest';
import { createTestFolders, waitForTaskSyncPlugin } from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Refresh Status Property', () => {
  const context = setupE2ETestHooks();

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
