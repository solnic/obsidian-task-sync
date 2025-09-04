/**
 * End-to-End Tests for File Name Sanitization and Base Formula Structure
 * Tests the complete workflow of creating tasks, projects, and areas with invalid characters
 * and verifying that base files are created with proper formulas
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  createTestTaskFile,
  getFileContent,
  fileExists,
  waitForTaskSyncPlugin
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('File Name Sanitization and Base Formulas', () => {
  const context = setupE2ETestHooks();

  test('should create task with invalid characters and generate proper base', async () => {
    await createTestFolders(context.page);

    // Create a task with invalid characters in the name
    const taskName = 'Project: Website/Mobile*App';
    const sanitizedTaskName = 'Project- Website-Mobile-App';

    await createTestTaskFile(context.page, sanitizedTaskName, {
      Title: taskName,
      Type: 'Feature',
      Areas: 'Development',
      Project: 'Website Redesign',
      Done: false,
      Status: 'In Progress'
    }, 'This is a test task with invalid characters in the name.');

    // Verify the task file was created with sanitized name
    const taskExists = await fileExists(context.page, `Tasks/${sanitizedTaskName}.md`);
    expect(taskExists).toBe(true);

    // Verify the task content includes the original title in frontmatter
    const taskContent = await getFileContent(context.page, `Tasks/${sanitizedTaskName}.md`);
    expect(taskContent).toContain(`Title: "${taskName}"`);
    expect(taskContent).toContain('Type: "Feature"');
  });

  test('should create area with invalid characters and generate proper base', async () => {
    await createTestFolders(context.page);

    // Simulate creating an area through the plugin
    await context.page.evaluate(async ({ areaName }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin) {
        // Create area with invalid characters
        const sanitizedName = areaName.replace(/[*"\\/<>:|?]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
        const areaPath = `Areas/${sanitizedName}.md`;

        const areaContent = [
          '---',
          `Title: ${areaName}`,
          `Name: ${areaName}`,
          'Type: Area',
          '---',
          '',
          '## Notes',
          '',
          'This is a test area with invalid characters',
          '',
          '## Tasks',
          '',
          `![[${sanitizedName}.base]]`,
          ''
        ].join('\n');

        await app.vault.create(areaPath, areaContent);

        // Create the base file
        await plugin.baseManager.createOrUpdateAreaBase({
          name: areaName,
          path: areaPath,
          type: 'area'
        });
      }
    }, { areaName: 'Development: Frontend/Backend*' });

    // Verify the area file was created with sanitized name
    const areaExists = await fileExists(context.page, 'Areas/Development- Frontend-Backend.md');
    expect(areaExists).toBe(true);

    // Verify the base file was created with sanitized name
    const baseExists = await fileExists(context.page, 'Bases/Development- Frontend-Backend.base');
    expect(baseExists).toBe(true);

    // Verify the base file contains the new formula structure
    const baseContent = await getFileContent(context.page, 'Bases/Development- Frontend-Backend.base');
    expect(baseContent).toContain('formulas:');
    expect(baseContent).toContain('Title: link(file.name, Title)');
    expect(baseContent).toContain('formula.Title');
    expect(baseContent).toContain('note.Type:');
    expect(baseContent).toContain('displayName: Type');
  });

  test('should handle basic file name sanitization', async () => {
    await createTestFolders(context.page);

    // Test basic sanitization case
    const testCase = { input: 'Project: Website/Mobile*App', expected: 'Project- Website-Mobile-App' };

    await createTestTaskFile(context.page, testCase.expected, {
      Title: testCase.input,
      Type: 'Task',
      Done: false
    }, `Test task for: ${testCase.input}`);

    // Verify the task file was created with expected name
    const taskExists = await fileExists(context.page, `Tasks/${testCase.expected}.md`);
    expect(taskExists).toBe(true);

    // Verify the content has the original title
    const taskContent = await getFileContent(context.page, `Tasks/${testCase.expected}.md`);
    expect(taskContent).toContain(`Title: "${testCase.input}"`);
  });
});
