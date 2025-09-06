import { test, expect, describe } from 'vitest';
import { createTestFolders, waitForTaskSyncPlugin } from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Refresh Type Validation', () => {
  const context = setupE2ETestHooks();

  test('should only process files with correct Type property during refresh', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create files with mixed Type properties in Projects folder
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Valid project file
      await app.vault.create('Projects/Valid Project.md', `---
Name: Valid Project
Type: Project
Areas: Development
---

This is a valid project file.`);

      // Invalid project file (wrong Type)
      await app.vault.create('Projects/Invalid Project.md', `---
Name: Invalid Project
Type: Area
---

This file has wrong Type property.`);

      // Files without Type property will get Type added by property handlers
      // This is the expected behavior - property handlers ensure files have correct Type
      await app.vault.create('Projects/Auto Type File.md', `---
Name: Auto Type File
Description: File that will get Type added automatically
---

This file will get Type: Project added by property handlers.`);
    });

    // Create files with mixed Type properties in Areas folder
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Valid area file
      await app.vault.create('Areas/Valid Area.md', `---
Name: Valid Area
Type: Area
---

This is a valid area file.`);

      // Invalid area file (wrong Type)
      await app.vault.create('Areas/Invalid Area.md', `---
Name: Invalid Area
Type: Project
---

This file has wrong Type property.`);

      // Files without Type property will get Type added by property handlers
      await app.vault.create('Areas/Auto Type Area.md', `---
Name: Auto Type Area
Description: Area that will get Type added automatically
---

This file will get Type: Area added by property handlers.`);
    });

    // Wait for property handlers to process the files
    await context.page.waitForTimeout(2000);

    // Capture console logs to verify which files are processed/skipped
    const consoleLogs: string[] = [];
    context.page.on('console', (msg: any) => {
      if (msg.type() === 'log' && msg.text().includes('Task Sync:')) {
        consoleLogs.push(msg.text());
      }
    });

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Verify that only files with incorrect Type properties were skipped
    const skippedLogs = consoleLogs.filter(log =>
      log.includes('Skipping file with incorrect Type property')
    );

    console.log('Console logs captured:', consoleLogs);
    console.log('Processed logs:', consoleLogs.filter(log => log.includes('Updated') && log.includes('properties')));
    console.log('Skipped logs:', skippedLogs);

    // Should have skipped files with incorrect Type properties
    expect(skippedLogs.some(log => log.includes('Invalid Project.md'))).toBe(true);
    expect(skippedLogs.some(log => log.includes('Invalid Area.md'))).toBe(true);

    // Should NOT have skipped files that got correct Type properties from property handlers
    expect(skippedLogs.some(log => log.includes('Auto Type File.md'))).toBe(false);
    expect(skippedLogs.some(log => log.includes('Auto Type Area.md'))).toBe(false);
    expect(skippedLogs.some(log => log.includes('Valid Project.md'))).toBe(false);
    expect(skippedLogs.some(log => log.includes('Valid Area.md'))).toBe(false);
  });

  test('should not create bases for files without correct Type property', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Enable individual bases
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
      }
    });

    // Create files with mixed Type properties
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Valid files that should get bases
      await app.vault.create('Projects/Valid Project.md', `---
Name: Valid Project
Type: Project
---

Valid project file.`);

      await app.vault.create('Areas/Valid Area.md', `---
Name: Valid Area
Type: Area
---

Valid area file.`);

      // Invalid files that should NOT get bases (wrong Type)
      await app.vault.create('Projects/Invalid Project.md', `---
Name: Invalid Project
Type: Area
---

Invalid project file.`);

      await app.vault.create('Areas/Invalid Area.md', `---
Name: Invalid Area
Type: Project
---

Invalid area file.`);
    });

    // Wait for property handlers to process files
    await context.page.waitForTimeout(2000);

    // Trigger base regeneration
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for bases to be generated
    await context.page.waitForTimeout(3000);

    // Check which base files exist
    const baseFiles = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const basesFolder = app.vault.getAbstractFileByPath('Bases');
      if (!basesFolder) return [];

      const files: string[] = [];
      const collectFiles = (folder: any) => {
        for (const child of folder.children) {
          if (child.extension === 'base') {
            files.push(child.name);
          }
        }
      };
      collectFiles(basesFolder);
      return files;
    });

    console.log('Base files found:', baseFiles);

    // Should have bases for valid files
    expect(baseFiles).toContain('Valid Project.base');
    expect(baseFiles).toContain('Valid Area.base');

    // Should NOT have bases for invalid files (wrong Type)
    expect(baseFiles).not.toContain('Invalid Project.base');
    expect(baseFiles).not.toContain('Invalid Area.base');
  });

  test('should handle task files correctly (Type property is optional)', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create task files with different Type scenarios
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Valid task with Type property
      await app.vault.create('Tasks/Valid Task.md', `---
Title: Valid Task
Type: Task
Status: Backlog
---

Valid task file.`);

      // Valid task without Type property (should be allowed)
      await app.vault.create('Tasks/No Type Task.md', `---
Title: No Type Task
Status: Backlog
---

Task without Type property.`);

      // Invalid task with wrong Type property
      await app.vault.create('Tasks/Wrong Type Task.md', `---
Title: Wrong Type Task
Type: Project
Status: Backlog
---

Task with wrong Type property.`);
    });

    // Capture console logs
    const consoleLogs: string[] = [];
    context.page.on('console', (msg: any) => {
      if (msg.type() === 'log' && msg.text().includes('Task Sync:')) {
        consoleLogs.push(msg.text());
      }
    });

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    console.log('Task refresh logs:', consoleLogs);

    // Should process valid task files (both with and without Type property)
    const shouldProcess = ['Valid Task.md', 'No Type Task.md'];
    for (const filename of shouldProcess) {
      const wasSkipped = consoleLogs.some(log =>
        log.includes('Skipping file with incorrect Type property') && log.includes(filename)
      );
      expect(wasSkipped).toBe(false);
    }

    // Should skip task with wrong Type property
    expect(consoleLogs.some(log =>
      log.includes('Skipping file with incorrect Type property') && log.includes('Wrong Type Task.md')
    )).toBe(true);
  });

  test('should add Status field to task files during refresh', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create task files without Status field
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Task with minimal front-matter (missing Status)
      await app.vault.create('Tasks/Task Without Status.md', `---
Title: Task Without Status
Type: Task
Done: false
---

This task is missing the Status field.`);

      // Task with some fields but missing Status
      await app.vault.create('Tasks/Another Task.md', `---
Title: Another Task
Type: Task
Priority: High
Done: false
---

Another task missing Status field.`);
    });

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Check that Status field was added to both files
    const filesWithStatus = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const results: { filename: string; hasStatus: boolean; statusValue: string }[] = [];

      const files = ['Tasks/Task Without Status.md', 'Tasks/Another Task.md'];

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
            statusValue
          });
        }
      }

      return results;
    });

    // Verify both files now have Status field
    expect(filesWithStatus).toHaveLength(2);

    for (const fileResult of filesWithStatus) {
      expect(fileResult.hasStatus).toBe(true);
      expect(fileResult.statusValue).toBe('Backlog'); // Should use default value
    }

    console.log('Files with Status after refresh:', filesWithStatus);
  });
});
