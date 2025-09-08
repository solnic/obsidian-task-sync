import { test, expect, describe } from 'vitest';
import { createTestFolders, waitForTaskSyncPlugin } from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Refresh Property Order', () => {
  const context = setupE2ETestHooks();

  test('should reorder front-matter properties to match schema during refresh', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task file with all properties but in wrong order
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Create task with properties in wrong order (not matching schema)
      // Schema order should be: Title, Type, Category, Priority, Areas, Project, Done, Status, Parent task, Sub-tasks, tags
      await app.vault.create('Tasks/Wrong Order Task.md', `---
Done: false
tags: test
Areas: Development
Title: Wrong Order Task
Project: Test Project
Type: Task
Category: Task
Priority: High
Status: In Progress
Parent task:
Sub-tasks:
---

This task has all properties but in wrong order.`);
    });

    // Get the initial property order
    const initialContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Wrong Order Task.md');
      if (file) {
        return await app.vault.read(file);
      }
      return '';
    });

    console.log('Initial file content:', initialContent);

    // Extract property order from initial content
    const initialPropertyOrder = extractPropertyOrder(initialContent);
    console.log('Initial property order:', initialPropertyOrder);

    // Expected order based on default schema
    const expectedOrder = ['Title', 'Type', 'Category', 'Priority', 'Areas', 'Project', 'Done', 'Status', 'Parent task', 'Sub-tasks', 'tags'];

    // Verify initial order is wrong
    expect(initialPropertyOrder).not.toEqual(expectedOrder);

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(5000);

    // Get the updated content
    const updatedContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Wrong Order Task.md');
      if (file) {
        return await app.vault.read(file);
      }
      return '';
    });

    console.log('Updated file content:', updatedContent);

    // Extract property order from updated content
    const updatedPropertyOrder = extractPropertyOrder(updatedContent);
    console.log('Updated property order:', updatedPropertyOrder);

    // Verify the order now matches the schema
    expect(updatedPropertyOrder).toEqual(expectedOrder);

    // Verify all property values are preserved using API
    const frontMatter = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return await plugin.taskFileManager.loadFrontMatter('Tasks/Wrong Order Task.md');
    });

    expect(frontMatter.Title).toBe('Wrong Order Task');
    expect(frontMatter.Type).toBe('Task');
    expect(frontMatter.Priority).toBe('High');
    expect(frontMatter.Areas).toBe('Development');
    expect(frontMatter.Project).toBe('Test Project');
    expect(frontMatter.Done).toBe(false);
    expect(frontMatter.Status).toBe('In Progress');
    expect(frontMatter.tags).toBe('test');
    expect(updatedContent).toContain('This task has all properties but in wrong order.');
  });

  test('should respect custom property order from settings during refresh', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // FIRST: Create a task file with DEFAULT property order (simulating existing task)
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Existing Task.md', `---
Title: Existing Task
Type: Task
Category: Task
Priority: High
Areas: Development
Project: Test Project
Done: false
Status: In Progress
Parent task:
Sub-tasks:
tags: test
---

This task was created with default property order.`);
    });

    // Get the initial property order (should be default order)
    const initialContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Existing Task.md');
      if (file) {
        return await app.vault.read(file);
      }
      return '';
    });

    console.log('Initial file content (default order):', initialContent);

    // Extract property order from initial content
    const initialPropertyOrder = extractPropertyOrder(initialContent);
    console.log('Initial property order:', initialPropertyOrder);

    // Expected default order
    const expectedDefaultOrder = ['Title', 'Type', 'Category', 'Priority', 'Areas', 'Project', 'Done', 'Status', 'Parent task', 'Sub-tasks', 'tags'];

    // Verify initial order matches default
    expect(initialPropertyOrder).toEqual(expectedDefaultOrder);

    // THEN: Change property order in settings (Done first) - this simulates user changing settings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      // Update settings with custom property order (Done first)
      plugin.settings.taskPropertyOrder = ['DONE', 'TITLE', 'TYPE', 'CATEGORY', 'PRIORITY', 'AREAS', 'PROJECT', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS'];
      await plugin.saveSettings();
    });

    // Expected order based on NEW custom settings (Done first)
    const expectedCustomOrder = ['Done', 'Title', 'Type', 'Category', 'Priority', 'Areas', 'Project', 'Status', 'Parent task', 'Sub-tasks', 'tags'];

    // Execute refresh command to apply new property order to existing files
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(5000);

    // Get the updated content
    const updatedContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Existing Task.md');
      if (file) {
        return await app.vault.read(file);
      }
      return '';
    });

    console.log('Updated file content (after settings change):', updatedContent);

    // Extract property order from updated content
    const updatedPropertyOrder = extractPropertyOrder(updatedContent);
    console.log('Updated property order:', updatedPropertyOrder);

    // Verify the order now matches the NEW custom settings order
    expect(updatedPropertyOrder).toEqual(expectedCustomOrder);

    // Verify Done property comes first (the key test for our fix)
    expect(updatedPropertyOrder[0]).toBe('Done');
    expect(updatedPropertyOrder[1]).toBe('Title');

    // Verify all property values are preserved
    expect(updatedContent).toContain('Title: Existing Task');
    expect(updatedContent).toContain('Type: Task');
    expect(updatedContent).toContain('Priority: High');
    expect(updatedContent).toContain('Areas: Development');
    expect(updatedContent).toContain('Project: Test Project');
    expect(updatedContent).toContain('Done: false');
    expect(updatedContent).toContain('Status: In Progress');
    expect(updatedContent).toContain('tags: test');
    expect(updatedContent).toContain('This task was created with default property order.');
  });
});

/**
 * Helper function to extract property order from front-matter
 */
function extractPropertyOrder(content: string): string[] {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    return [];
  }

  const frontMatterText = frontMatterMatch[1];
  const properties: string[] = [];

  const lines = frontMatterText.split('\n');
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*/);
    if (match) {
      properties.push(match[1].trim());
    }
  }

  return properties;
}
