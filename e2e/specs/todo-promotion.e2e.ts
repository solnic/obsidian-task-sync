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

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press('Control+Home'); // Go to beginning of document
    await context.page.waitForTimeout(200);

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

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press('Control+Home'); // Go to beginning of document
    await context.page.waitForTimeout(200);

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

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press('Control+Home'); // Go to beginning of document
    await context.page.waitForTimeout(200);

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

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press('Control+Home'); // Go to beginning of document
    await context.page.waitForTimeout(200);

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

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press('Control+Home'); // Go to beginning of document
    await context.page.waitForTimeout(200);

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

  test('should set context properties correctly when promoting todo in area', async () => {
    await createTestFolders(context.page);

    // Create a test file in Areas folder
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Task with area context`;
      await app.vault.create('Areas/Work.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('Work.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor and position cursor
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.press('Control+Home');
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(context.page, 'Tasks/Task with area context.md');
    expect(taskExists).toBe(true);

    // Verify the task has the correct area context in front-matter
    const taskContent = await getFileContent(context.page, 'Tasks/Task with area context.md');
    expect(taskContent).toContain('Areas:');
    expect(taskContent).toContain(`- "[[Work]]"`);
  });

  test('should set context properties correctly when promoting todo in project', async () => {
    await createTestFolders(context.page);

    // Create a test file in Projects folder
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Task with project context`;
      await app.vault.create('Projects/Website Redesign.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('Website Redesign.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor and position cursor
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.press('Control+Home');
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(context.page, 'Tasks/Task with project context.md');
    expect(taskExists).toBe(true);

    // Verify the task has the correct project context in front-matter
    const taskContent = await getFileContent(context.page, 'Tasks/Task with project context.md');
    expect(taskContent).toContain(`Project: "[[Website Redesign]]"`);
  });

  test('should promote nested todos and create sub-tasks', async () => {
    await createTestFolders(context.page);

    // Create a test file with nested todos
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Parent task with children
  - [ ] First child task
  - [ ] Second child task
  - [x] Completed child task`;
      await app.vault.create('Areas/Nested.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('Nested.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor and position cursor on parent todo
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.press('Control+Home');
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(4000);

    // Verify all tasks were created
    const parentExists = await fileExists(context.page, 'Tasks/Parent task with children.md');
    const child1Exists = await fileExists(context.page, 'Tasks/First child task.md');
    const child2Exists = await fileExists(context.page, 'Tasks/Second child task.md');
    const child3Exists = await fileExists(context.page, 'Tasks/Completed child task.md');

    expect(parentExists).toBe(true);
    expect(child1Exists).toBe(true);
    expect(child2Exists).toBe(true);
    expect(child3Exists).toBe(true);

    // Verify parent task has sub-tasks in front-matter
    const parentContent = await getFileContent(context.page, 'Tasks/Parent task with children.md');
    expect(parentContent).toContain('Sub-tasks:');
    expect(parentContent).toContain(`"[[First child task]]"`);
    expect(parentContent).toContain(`"[[Second child task]]"`);
    expect(parentContent).toContain(`"[[Completed child task]]"`);

    // Verify child tasks have parent task set
    const child1Content = await getFileContent(context.page, 'Tasks/First child task.md');
    expect(child1Content).toContain(`Parent task: "[[Parent task with children]]"`);

    // Verify completed child task has correct status
    const child3Content = await getFileContent(context.page, 'Tasks/Completed child task.md');
    expect(child3Content).toContain('Done: true');
    expect(child3Content).toContain('Status: Done');

    // Verify all todo lines were replaced with links
    const updatedContent = await getFileContent(context.page, 'Areas/Nested.md');
    expect(updatedContent).toContain('[[Parent task with children]]');
    expect(updatedContent).toContain('[[First child task]]');
    expect(updatedContent).toContain('[[Second child task]]');
    expect(updatedContent).toContain('[[Completed child task]]');
  });

  test('should not double-linkify already promoted parent todos', async () => {
    await createTestFolders(context.page);

    // Create a test file with nested todos
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Already promoted parent
  - [ ] Child to promote later`;
      await app.vault.create('Areas/DoubleLink.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('DoubleLink.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor and position cursor on parent todo
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.press('Control+Home');
    await context.page.waitForTimeout(200);

    // First, promote the parent todo
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify parent was promoted and line was linkified
    let updatedContent = await getFileContent(context.page, 'Areas/DoubleLink.md');
    expect(updatedContent).toContain('[[Already promoted parent]]');

    // Now position cursor on child todo and promote it
    await context.page.keyboard.press('ArrowDown'); // Move to child line
    await context.page.waitForTimeout(200);

    // Promote the child todo
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify child was promoted
    const childExists = await fileExists(context.page, 'Tasks/Child to promote later.md');
    expect(childExists).toBe(true);

    // Verify parent line was NOT double-linkified
    updatedContent = await getFileContent(context.page, 'Areas/DoubleLink.md');
    expect(updatedContent).toContain('[[Already promoted parent]]');
    expect(updatedContent).not.toContain('[[[[Already promoted parent]]]]');
    expect(updatedContent).toContain('[[Child to promote later]]');
  });

  test('should set parent task property when promoting sub-todo', async () => {
    await createTestFolders(context.page);

    // Create a test file with nested todos
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Main parent task
  - [ ] Sub-task to promote`;
      await app.vault.create('Areas/SubTask.md', testContent);
    });

    // Open the file
    await context.page.keyboard.press('Control+O');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.type('SubTask.md');
    await context.page.keyboard.press('Enter');
    await context.page.waitForTimeout(1000);

    // Click on the editor and position cursor on sub-todo
    await context.page.click('.cm-editor');
    await context.page.waitForTimeout(500);
    await context.page.keyboard.press('Control+Home');
    await context.page.keyboard.press('ArrowDown'); // Move to sub-task line
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, 'Task Sync: Promote Todo to Task');
    await context.page.waitForTimeout(3000);

    // Verify both tasks were created
    const parentExists = await fileExists(context.page, 'Tasks/Main parent task.md');
    const childExists = await fileExists(context.page, 'Tasks/Sub-task to promote.md');
    expect(parentExists).toBe(true);
    expect(childExists).toBe(true);

    // Verify child task has parent task property set
    const childContent = await getFileContent(context.page, 'Tasks/Sub-task to promote.md');
    expect(childContent).toContain(`Parent task: "[[Main parent task]]"`);

    // Verify parent task has child in sub-tasks
    const parentContent = await getFileContent(context.page, 'Tasks/Main parent task.md');
    expect(parentContent).toContain('Sub-tasks:');
    expect(parentContent).toContain("'[[Sub-task to promote]]'");
  });
});
