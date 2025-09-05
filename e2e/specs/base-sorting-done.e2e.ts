import { test, expect, describe } from 'vitest';
import { createTestFolders, waitForTaskSyncPlugin } from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Base Sorting by Done Status', () => {
  const context = setupE2ETestHooks();

  test('should sort tasks with uncompleted tasks first and completed tasks at bottom', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create tasks with different Done states
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Create completed task (should appear at bottom)
      await app.vault.create('Tasks/Completed Task.md', `---
Title: Completed Task
Type: Task
Priority: High
Areas: Development
Project: Test Project
Done: true
Status: Done
Parent task:
Sub-tasks:
tags: test
---

This task is completed.`);

      // Create uncompleted task (should appear at top)
      await app.vault.create('Tasks/Uncompleted Task.md', `---
Title: Uncompleted Task
Type: Task
Priority: High
Areas: Development
Project: Test Project
Done: false
Status: In Progress
Parent task:
Sub-tasks:
tags: test
---

This task is not completed.`);

      // Create another completed task (should also appear at bottom)
      await app.vault.create('Tasks/Another Completed Task.md', `---
Title: Another Completed Task
Type: Bug
Priority: Medium
Areas: Development
Project: Test Project
Done: true
Status: Done
Parent task:
Sub-tasks:
tags: test
---

This task is also completed.`);

      // Create another uncompleted task (should appear at top)
      await app.vault.create('Tasks/Another Uncompleted Task.md', `---
Title: Another Uncompleted Task
Type: Feature
Priority: Low
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This task is also not completed.`);
    });

    // Enable base generation and regenerate bases
    console.log('Enabling base generation settings...');
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.autoGenerateBases = true;
        plugin.settings.autoUpdateBaseViews = true;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });
    await context.page.waitForTimeout(3000);
    console.log('Base generation completed');

    // Check what files exist in the Bases folder
    const basesFiles = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const basesFolder = app.vault.getAbstractFileByPath('Bases');
      if (basesFolder && basesFolder.children) {
        return basesFolder.children.map((file: any) => file.path);
      }
      return [];
    });

    console.log('Files in Bases folder:', basesFiles);

    // Read the generated Tasks base file
    const baseContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Bases/Tasks.base');
      if (file) {
        return await app.vault.read(file);
      }
      return '';
    });

    console.log('Generated base content:', baseContent);

    // Verify that the base contains the Done-first sorting configuration
    expect(baseContent).toContain('property: Done');
    expect(baseContent).toContain('direction: ASC');

    // The sorting should be:
    // 1. note.Done ASC (false before true)
    // 2. file.mtime DESC (newer first)
    // 3. formula.Title ASC (alphabetical)

    // Parse the YAML to verify sort configuration
    const yamlMatch = baseContent.match(/^([\s\S]*)$/);
    expect(yamlMatch).toBeTruthy();

    // Check that Done is the first sort property
    const sortSectionMatch = baseContent.match(/sort:\s*\n((?:\s*-\s*property:.*\n\s*direction:.*\n?)*)/);
    expect(sortSectionMatch).toBeTruthy();

    const sortSection = sortSectionMatch![1];
    const firstSortProperty = sortSection.match(/^\s*-\s*property:\s*(.+)/);
    expect(firstSortProperty![1].trim()).toBe('Done');

    // Verify direction is ASC for Done property
    const firstSortDirection = sortSection.match(/^\s*-\s*property:\s*Done\s*\n\s*direction:\s*(.+)/);
    expect(firstSortDirection![1].trim()).toBe('ASC');
  });

  test('should sort area-specific bases with Done first', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create an area file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create('Areas/Development.md', `---
Title: Development
Type: Area
---

Development area for testing.`);
    });

    // Create tasks for this area
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Dev Task 1.md', `---
Title: Dev Task 1
Type: Task
Priority: High
Areas: Development
Project:
Done: false
Status: In Progress
Parent task:
Sub-tasks:
tags: dev
---

Development task 1.`);

      await app.vault.create('Tasks/Dev Task 2.md', `---
Title: Dev Task 2
Type: Task
Priority: Medium
Areas: Development
Project:
Done: true
Status: Done
Parent task:
Sub-tasks:
tags: dev
---

Development task 2.`);
    });

    // Enable area bases and regenerate
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        plugin.settings.autoGenerateBases = true;
        await plugin.saveSettings();
        await plugin.regenerateBases();
      }
    });
    await context.page.waitForTimeout(3000);

    // Check what files exist in the Bases folder after area creation
    const basesFilesAfterArea = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const basesFolder = app.vault.getAbstractFileByPath('Bases');
      if (basesFolder && basesFolder.children) {
        return basesFolder.children.map((file: any) => file.path);
      }
      return [];
    });

    console.log('Files in Bases folder after area creation:', basesFilesAfterArea);

    // Read the generated area base file (should be directly in Bases folder, not Bases/Areas)
    const areaBaseContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Bases/Development.base');
      if (file) {
        return await app.vault.read(file);
      }
      return '';
    });

    console.log('Generated area base content:', areaBaseContent);

    // Verify that the area base also has Done-first sorting
    expect(areaBaseContent).toContain('property: Done');
    expect(areaBaseContent).toContain('direction: ASC');

    // Check that Done is the first sort property in area base too
    const sortSectionMatch = areaBaseContent.match(/sort:\s*\n((?:\s*-\s*property:.*\n\s*direction:.*\n?)*)/);
    expect(sortSectionMatch).toBeTruthy();

    const sortSection = sortSectionMatch![1];
    const firstSortProperty = sortSection.match(/^\s*-\s*property:\s*(.+)/);
    expect(firstSortProperty![1].trim()).toBe('Done');
  });
});
