/**
 * E2E tests for Template Management functionality
 * Tests template creation and management in a real Obsidian environment
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForTaskSyncPlugin
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Template Management', () => {
  const context = setupE2ETestHooks();

  test('should create Task.md template automatically during plugin initialization', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // The plugin should automatically create the default task template during initialization
    // Check if Task.md template was created
    const templateExists = await fileExists(context.page, 'Templates/Task.md');
    expect(templateExists).toBe(true);

    // Verify the template content
    const templateContent = await getFileContent(context.page, 'Templates/Task.md');

    // Should contain proper front-matter in correct order
    expect(templateContent).toContain('---');
    expect(templateContent).toContain('Title: ');
    expect(templateContent).toContain('Type: ');
    expect(templateContent).toContain('Priority: Low');
    expect(templateContent).toContain('Areas: []');
    expect(templateContent).toContain('Project: ');
    expect(templateContent).toContain('Done: false');
    expect(templateContent).toContain('Status:');
    expect(templateContent).toContain('Parent task: ');
    expect(templateContent).toContain('Sub-tasks: []');
    expect(templateContent).toContain('tags: []');

    // Should contain description placeholder
    expect(templateContent).toContain('{{description}}');

    // Verify the exact structure matches user requirements
    const expectedStructure = [
      '---',
      'Title: ',
      'Type: ',
      'Priority: Low',
      'Areas: []',
      'Project: ',
      'Done: false',
      'Status:',
      'Parent task: ',
      'Sub-tasks: []',
      'tags: []',
      '---',
      '',
      '{{description}}'
    ];

    // Check that the template follows the expected structure
    for (const line of expectedStructure) {
      expect(templateContent).toContain(line);
    }
  });

  test('should prompt user when Task.md template already exists', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create existing template file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create('Templates/Task.md', 'Existing template content');
    });

    // Try to create template again - should handle existing file
    const result = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin && plugin.templateManager) {
        try {
          await plugin.templateManager.createTaskTemplate();
          return { success: true, error: null };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: 'Plugin or templateManager not available' };
    });

    // Should handle the conflict appropriately
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  test('should create template with custom filename when specified', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create template with custom filename
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin && plugin.templateManager) {
        await plugin.templateManager.createTaskTemplate('Custom Task.md');
      }
    });

    // Check if custom template was created
    const templateExists = await fileExists(context.page, 'Templates/Custom Task.md');
    expect(templateExists).toBe(true);

    // Verify the content is still correct
    const templateContent = await getFileContent(context.page, 'Templates/Custom Task.md');
    expect(templateContent).toContain('Title: ');
    expect(templateContent).toContain('{{description}}');
  });

  test('should provide settings UI to create templates when custom template is configured', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Configure a custom template name in settings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultTaskTemplate = 'CustomTask.md';
        await plugin.saveSettings();
      }
    });

    // Open settings tab
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById('obsidian-task-sync');
    });

    // Look for a "Create Template" button in the Templates section
    const createTemplateButtonExists = await context.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(button => button.textContent?.includes('Create Template'));
    });
    expect(createTemplateButtonExists).toBe(true);

    // Click the button to create the template
    await context.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const createButton = buttons.find(button => button.textContent?.includes('Create Template'));
      if (createButton) {
        createButton.click();
      }
    });

    // Wait for template creation to complete
    await context.page.waitForTimeout(1000);

    // Verify the custom template was created
    const templateExists = await fileExists(context.page, 'Templates/CustomTask.md');
    expect(templateExists).toBe(true);
  });
});
