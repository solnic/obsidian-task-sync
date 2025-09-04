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

      // File without Type property
      await app.vault.create('Projects/Random Note.md', `---
Title: Random Note
Description: Just a random note
---

This file has no Type property.`);

      // File with no front-matter
      await app.vault.create('Projects/Plain File.md', `# Plain File

This file has no front-matter at all.`);
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

      // File without Type property
      await app.vault.create('Areas/Some Document.md', `---
Title: Some Document
Description: Just a document
---

This file has no Type property.`);
    });

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

    // Verify that only files with correct Type properties were processed
    const processedLogs = consoleLogs.filter(log => log.includes('Processing file with correct Type') || log.includes('Updated') && log.includes('properties'));
    const skippedLogs = consoleLogs.filter(log => log.includes('Skipping file with incorrect Type property') || log.includes('Skipping file without front-matter'));

    console.log('Console logs captured:', consoleLogs);
    console.log('Processed logs:', processedLogs);
    console.log('Skipped logs:', skippedLogs);

    // Should have skipped files with incorrect/missing Type properties
    expect(skippedLogs.some(log => log.includes('Invalid Project.md'))).toBe(true);
    expect(skippedLogs.some(log => log.includes('Random Note.md'))).toBe(true);
    expect(skippedLogs.some(log => log.includes('Plain File.md'))).toBe(true);
    expect(skippedLogs.some(log => log.includes('Invalid Area.md'))).toBe(true);
    expect(skippedLogs.some(log => log.includes('Some Document.md'))).toBe(true);

    // Should NOT have processed invalid files
    expect(consoleLogs.some(log => log.includes('Processing') && log.includes('Invalid Project.md'))).toBe(false);
    expect(consoleLogs.some(log => log.includes('Processing') && log.includes('Random Note.md'))).toBe(false);
    expect(consoleLogs.some(log => log.includes('Processing') && log.includes('Plain File.md'))).toBe(false);
    expect(consoleLogs.some(log => log.includes('Processing') && log.includes('Invalid Area.md'))).toBe(false);
    expect(consoleLogs.some(log => log.includes('Processing') && log.includes('Some Document.md'))).toBe(false);
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

      // Invalid files that should NOT get bases
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

      await app.vault.create('Projects/Random Note.md', `---
Title: Random Note
---

Random note without Type.`);

      await app.vault.create('Areas/Some Document.md', `---
Title: Some Document
---

Document without Type.`);
    });

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

    // Should NOT have bases for invalid files
    expect(baseFiles).not.toContain('Invalid Project.base');
    expect(baseFiles).not.toContain('Invalid Area.base');
    expect(baseFiles).not.toContain('Random Note.base');
    expect(baseFiles).not.toContain('Some Document.base');
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
});
