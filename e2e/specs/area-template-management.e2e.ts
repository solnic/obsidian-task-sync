import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForTaskSyncPlugin
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Area Template Management', () => {
  const context = setupE2ETestHooks();

  test('should create area template with proper front-matter structure', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create area template using TemplateManager
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin && plugin.templateManager) {
        await plugin.templateManager.createAreaTemplate('TestArea.md');
      }
    });

    await context.page.waitForTimeout(1000);

    // Check if template file was created
    const templateExists = await fileExists(context.page, 'Templates/TestArea.md');
    expect(templateExists).toBe(true);

    // Check template content structure
    const templateContent = await getFileContent(context.page, 'Templates/TestArea.md');

    // Should have proper front-matter structure for areas
    expect(templateContent).toContain('---');
    expect(templateContent).toContain('Name:');
    expect(templateContent).toContain('Type:');
    expect(templateContent).toContain('Project:');
    expect(templateContent).toContain('{{description}}');

    // Should have clean empty values (empty strings render with quotes in YAML)
    expect(templateContent).toMatch(/Name:\s*['"]?['"]?\s*$/m);
    expect(templateContent).toMatch(/Type:\s*['"]?['"]?\s*$/m);
    expect(templateContent).toMatch(/Project:\s*['"]?['"]?\s*$/m);
  });

  test('should handle existing template file conflict', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create existing template file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create('Templates/ExistingArea.md', 'Existing template content');
    });

    // Try to create template with same name - should handle conflict
    const result = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin && plugin.templateManager) {
        try {
          await plugin.templateManager.createAreaTemplate('ExistingArea.md');
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
        await plugin.templateManager.createAreaTemplate('CustomArea.md');
      }
    });

    await context.page.waitForTimeout(1000);

    // Check if custom template was created
    const templateExists = await fileExists(context.page, 'Templates/CustomArea.md');
    expect(templateExists).toBe(true);

    // Verify it has proper structure
    const templateContent = await getFileContent(context.page, 'Templates/CustomArea.md');
    expect(templateContent).toContain('Name:');
    expect(templateContent).toContain('Type:');
    expect(templateContent).toContain('Project:');
  });

  test('should use default template filename from settings when none specified', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Configure default area template in settings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultAreaTemplate = 'DefaultArea.md';
        await plugin.saveSettings();
      }
    });

    // Create template without specifying filename (should use default)
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin && plugin.templateManager) {
        await plugin.templateManager.createAreaTemplate();
      }
    });

    await context.page.waitForTimeout(1000);

    // Check if default template was created
    const templateExists = await fileExists(context.page, 'Templates/DefaultArea.md');
    expect(templateExists).toBe(true);
  });

  test('should generate clean template without pre-filled values', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create area template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin && plugin.templateManager) {
        await plugin.templateManager.createAreaTemplate('CleanArea.md');
      }
    });

    await context.page.waitForTimeout(1000);

    // Check template content is clean
    const templateContent = await getFileContent(context.page, 'Templates/CleanArea.md');

    // Should not have any pre-filled values
    expect(templateContent).not.toContain('Health');
    expect(templateContent).not.toContain('Finance');
    expect(templateContent).not.toContain('Learning');

    // Should have placeholder for description
    expect(templateContent).toContain('{{description}}');

    // Should have empty field values
    const lines = templateContent.split('\n');
    const nameLineIndex = lines.findIndex(line => line.startsWith('Name:'));
    const typeLineIndex = lines.findIndex(line => line.startsWith('Type:'));
    const projectLineIndex = lines.findIndex(line => line.startsWith('Project:'));

    expect(nameLineIndex).toBeGreaterThan(-1);
    expect(typeLineIndex).toBeGreaterThan(-1);
    expect(projectLineIndex).toBeGreaterThan(-1);

    // Check that values are empty (empty strings render with quotes in YAML)
    expect(lines[nameLineIndex]).toMatch(/^Name:\s*['"]?['"]?\s*$/);
    expect(lines[typeLineIndex]).toMatch(/^Type:\s*['"]?['"]?\s*$/);
    expect(lines[projectLineIndex]).toMatch(/^Project:\s*['"]?['"]?\s*$/);
  });
});
