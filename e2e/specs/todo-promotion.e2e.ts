/**
 * End-to-end tests for todo promotion functionality
 */

import { test, expect, describe } from 'vitest';
import {
  getFileContent,
  fileExists,
  createTestFolders
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Todo Promotion E2E', () => {
  const context = setupE2ETestHooks();

  test('should promote incomplete todo to task', async () => {
    await createTestFolders(context.page);

    // Create a simple test file with just a todo item
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Buy groceries for the week`;
      await app.vault.create('Areas/Personal.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForSelector('.prompt-input', { timeout: 5000 });

    // Type the filename to search for it
    await context.page.keyboard.type('Personal.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor to focus it and position cursor on the todo line
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(context.page, 'Tasks/Buy groceries for the week.md');
    expect(taskExists).toBe(true);

    // Verify the original file was updated
    const updatedContent = await getFileContent(context.page, 'Areas/Personal.md');
    expect(updatedContent).toContain('[[Buy groceries for the week]]');
    expect(updatedContent).not.toContain('- [ ] Buy groceries for the week');
  });

  test('should promote completed todo to task', async () => {
    await createTestFolders(context.page);

    // Create a simple test file with a completed todo item
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [x] Finish the documentation`;
      await app.vault.create('Projects/Documentation.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('Documentation.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor to focus it
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(context.page, 'Tasks/Finish the documentation.md');
    expect(taskExists).toBe(true);

    // Verify the original file preserves completion state
    const updatedContent = await getFileContent(context.page, 'Projects/Documentation.md');
    expect(updatedContent).toContain('[x] [[Finish the documentation]]');
    expect(updatedContent).not.toContain('- [x] Finish the documentation');
  });

  test('should handle indented todo items', async () => {
    await createTestFolders(context.page);

    // Create a simple test file with an indented todo item
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `  - [ ] Nested todo item`;
      await app.vault.create('Areas/Work.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('Work.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor to focus it
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(context.page, 'Tasks/Nested todo item.md');
    expect(taskExists).toBe(true);

    // Verify the original file preserves indentation and checkbox format
    const updatedContent = await getFileContent(context.page, 'Areas/Work.md');
    expect(updatedContent).toContain('  - [ ] [[Nested todo item]]');
    expect(updatedContent).not.toContain('  - [ ] Nested todo item');
  });

  test('should show notice when no todo found', async () => {
    await createTestFolders(context.page);

    // Create a test file without todo items
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `This is just regular text.`;
      await app.vault.create('Areas/Test.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('Test.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor to focus it
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(2000);

    // Verify no task was created for regular text
    const taskExists = await fileExists(context.page, 'Tasks/This is just regular text.md');
    expect(taskExists).toBe(false);
  });

  test('should work with different list markers', async () => {
    await createTestFolders(context.page);

    // Create a simple test file with asterisk todo item
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `* [ ] Asterisk todo item`;
      await app.vault.create('Areas/Mixed.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('Mixed.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor to focus it
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify the task was created and original line updated
    const taskExists = await fileExists(context.page, 'Tasks/Asterisk todo item.md');
    expect(taskExists).toBe(true);

    const updatedContent = await getFileContent(context.page, 'Areas/Mixed.md');
    expect(updatedContent).toContain('* [ ] [[Asterisk todo item]]');
    expect(updatedContent).not.toContain('* [ ] Asterisk todo item');
  });
});
