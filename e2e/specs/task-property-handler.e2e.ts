/**
 * E2E Tests for TaskPropertyHandler
 * Tests that verify default property values are set when tasks are created
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  waitForTaskSyncPlugin,
  getFileContent
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('TaskPropertyHandler', () => {
  const context = setupE2ETestHooks();

  test('should set Title to filename when task created with null Title', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task file with null Title property
    const taskName = 'Test Task with Null Title';
    const taskPath = `Tasks/${taskName}.md`;

    const taskContent = `---
Title:
Type: Task
Priority: Low
Areas: []
Project:
Done: false
Status: Backlog
Parent task:
Sub-tasks: []
tags: []
---
Task description...`;

    // Create the file directly in the vault
    await context.page.evaluate(
      async ({ path, content }: { path: string; content: string }) => {
        const app = (window as any).app;
        await app.vault.create(path, content);
      },
      { path: taskPath, content: taskContent }
    );

    // Wait a moment for the TaskPropertyHandler to process the file
    await context.page.waitForTimeout(1000);

    // Verify the file was updated with Title set to filename
    const updatedContent = await getFileContent(context.page, taskPath);
    expect(updatedContent).toContain('Title: Test Task with Null Title'); // Should be set to filename
  });

  test('should set Type to first configured task type when task created with null Type', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task file with null Type property
    const taskName = 'Test Task with Null Type';
    const taskPath = `Tasks/${taskName}.md`;

    const taskContent = `---
Title: ${taskName}
Type:
Priority:
Areas: []
Project:
Done:
Status:
Parent task:
Sub-tasks: []
tags: []
---
Task description...`;

    // Create the file directly in the vault
    await context.page.evaluate(
      async ({ path, content }: { path: string; content: string }) => {
        const app = (window as any).app;
        await app.vault.create(path, content);
      },
      { path: taskPath, content: taskContent }
    );

    // Wait a moment for the TaskPropertyHandler to process the file
    await context.page.waitForTimeout(1000);

    // Verify the file was updated with default Type
    const updatedContent = await getFileContent(context.page, taskPath);
    expect(updatedContent).toContain('Type: Task'); // Should be set to first configured task type
  });

  test('should set Priority to Low when task created with null Priority', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task file with null Priority property
    const taskName = 'Test Task with Null Priority';
    const taskPath = `Tasks/${taskName}.md`;

    const taskContent = `---
Title: ${taskName}
Type: Task
Priority:
Areas: []
Project:
Done:
Status:
Parent task:
Sub-tasks: []
tags: []
---
Task description...`;

    // Create the file directly in the vault
    await context.page.evaluate(
      async ({ path, content }: { path: string; content: string }) => {
        const app = (window as any).app;
        await app.vault.create(path, content);
      },
      { path: taskPath, content: taskContent }
    );

    // Wait a moment for the TaskPropertyHandler to process the file
    await context.page.waitForTimeout(1000);

    // Verify the file was updated with default Priority
    const updatedContent = await getFileContent(context.page, taskPath);
    expect(updatedContent).toContain('Priority: Low'); // Should be set to default priority
  });

  test('should set Done to false when task created with null Done', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task file with null Done property
    const taskName = 'Test Task with Null Done';
    const taskPath = `Tasks/${taskName}.md`;

    const taskContent = `---
Title: ${taskName}
Type: Task
Priority: Low
Areas: []
Project:
Done:
Status:
Parent task:
Sub-tasks: []
tags: []
---
Task description...`;

    // Create the file directly in the vault
    await context.page.evaluate(
      async ({ path, content }: { path: string; content: string }) => {
        const app = (window as any).app;
        await app.vault.create(path, content);
      },
      { path: taskPath, content: taskContent }
    );

    // Wait a moment for the TaskPropertyHandler to process the file
    await context.page.waitForTimeout(1000);

    // Verify the file was updated with default Done
    const updatedContent = await getFileContent(context.page, taskPath);
    expect(updatedContent).toContain('Done: false'); // Should be set to default done value
  });

  test('should set Status to first configured status when task created with null Status', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task file with null Status property
    const taskName = 'Test Task with Null Status';
    const taskPath = `Tasks/${taskName}.md`;

    const taskContent = `---
Title: ${taskName}
Type: Task
Priority: Low
Areas: []
Project:
Done: false
Status:
Parent task:
Sub-tasks: []
tags: []
---
Task description...`;

    // Create the file directly in the vault
    await context.page.evaluate(
      async ({ path, content }: { path: string; content: string }) => {
        const app = (window as any).app;
        await app.vault.create(path, content);
      },
      { path: taskPath, content: taskContent }
    );

    // Wait a moment for the TaskPropertyHandler to process the file
    await context.page.waitForTimeout(1000);

    // Verify the file was updated with default Status
    const updatedContent = await getFileContent(context.page, taskPath);
    expect(updatedContent).toContain('Status: Backlog'); // Should be set to first configured status
  });

  test('should preserve existing non-null property values', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task file with some properties already set
    const taskName = 'Test Task with Existing Values';
    const taskPath = `Tasks/${taskName}.md`;

    const taskContent = `---
Title: ${taskName}
Type: Bug
Priority: High
Areas: []
Project:
Done: false
Status: In Progress
Parent task:
Sub-tasks: []
tags: []
---
Task description...`;

    // Create the file directly in the vault
    await context.page.evaluate(
      async ({ path, content }: { path: string; content: string }) => {
        const app = (window as any).app;
        await app.vault.create(path, content);
      },
      { path: taskPath, content: taskContent }
    );

    // Wait a moment for the TaskPropertyHandler to process the file
    await context.page.waitForTimeout(1000);

    // Verify the file preserved existing values
    const updatedContent = await getFileContent(context.page, taskPath);
    expect(updatedContent).toContain('Type: Bug'); // Should preserve existing Type
    expect(updatedContent).toContain('Priority: High'); // Should preserve existing Priority
    expect(updatedContent).toContain('Status: In Progress'); // Should preserve existing Status
  });
});
