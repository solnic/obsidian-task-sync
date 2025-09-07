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

    // Expected order based on schema
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

    // Verify all property values are preserved
    expect(updatedContent).toContain('Title: Wrong Order Task');
    expect(updatedContent).toContain('Type: Task');
    expect(updatedContent).toContain('Priority: High');
    expect(updatedContent).toContain('Areas: Development');
    expect(updatedContent).toContain('Project: Test Project');
    expect(updatedContent).toContain('Done: false');
    expect(updatedContent).toContain('Status: In Progress');
    expect(updatedContent).toContain('tags: test');
    expect(updatedContent).toContain('This task has all properties but in wrong order.');
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
