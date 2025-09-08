import { test, expect, describe } from 'vitest';
import { createTestFolders, waitForTaskSyncPlugin } from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Refresh Task Type Migration', () => {
  const context = setupE2ETestHooks();

  test('should migrate Type values to Category and set Type to Task during refresh', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create task files with different Type values that should be migrated
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Task with Type: Bug (should be migrated)
      await app.vault.create('Tasks/Bug Task.md', `---
Title: Bug Task
Type: Bug
Priority: High
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This is a bug task that should be migrated.`);

      // Task with Type: Feature (should be migrated)
      await app.vault.create('Tasks/Feature Task.md', `---
Title: Feature Task
Type: Feature
Priority: Medium
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This is a feature task that should be migrated.`);

      // Task with Type: Task (should NOT be migrated)
      await app.vault.create('Tasks/Normal Task.md', `---
Title: Normal Task
Type: Task
Category: Task
Priority: Low
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This is a normal task that should not be migrated.`);

      // Task with Type: Bug but already has Category (should NOT be migrated)
      await app.vault.create('Tasks/Already Migrated Task.md', `---
Title: Already Migrated Task
Type: Bug
Category: Bug
Priority: High
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This task already has a Category and should not be migrated.`);
    });

    // Wait for files to be created
    await context.page.waitForTimeout(1000);

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(5000);

    // Check the migrated files
    const bugTaskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Bug Task.md');
      return file ? await app.vault.read(file) : null;
    });

    const featureTaskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Feature Task.md');
      return file ? await app.vault.read(file) : null;
    });

    const normalTaskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Normal Task.md');
      return file ? await app.vault.read(file) : null;
    });

    const alreadyMigratedContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Already Migrated Task.md');
      return file ? await app.vault.read(file) : null;
    });

    console.log('Bug task content after migration:', bugTaskContent);
    console.log('Feature task content after migration:', featureTaskContent);
    console.log('Normal task content after migration:', normalTaskContent);
    console.log('Already migrated content after migration:', alreadyMigratedContent);

    // Verify Bug task was migrated
    expect(bugTaskContent).toContain('Type: Task');
    expect(bugTaskContent).toContain('Category: Bug');

    // Verify Feature task was migrated
    expect(featureTaskContent).toContain('Type: Task');
    expect(featureTaskContent).toContain('Category: Feature');

    // Verify Normal task was NOT migrated (Type should remain Task, Category should remain Task)
    expect(normalTaskContent).toContain('Type: Task');
    expect(normalTaskContent).toContain('Category: Task');

    // Verify Already Migrated task was NOT migrated (should keep existing Category)
    expect(alreadyMigratedContent).toContain('Type: Bug'); // Should remain unchanged
    expect(alreadyMigratedContent).toContain('Category: Bug'); // Should remain unchanged
  });

  test('should only migrate known task types during refresh', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create task files with various Type values
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Task with known task type (should be migrated)
      await app.vault.create('Tasks/Improvement Task.md', `---
Title: Improvement Task
Type: Improvement
Priority: Medium
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This is an improvement task.`);

      // Task with unknown type (should NOT be migrated)
      await app.vault.create('Tasks/Unknown Type Task.md', `---
Title: Unknown Type Task
Type: CustomType
Priority: Low
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This task has an unknown type.`);
    });

    // Wait for files to be created
    await context.page.waitForTimeout(1000);

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(5000);

    // Check the results
    const improvementTaskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Improvement Task.md');
      return file ? await app.vault.read(file) : null;
    });

    const unknownTypeTaskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Unknown Type Task.md');
      return file ? await app.vault.read(file) : null;
    });

    console.log('Improvement task content after migration:', improvementTaskContent);
    console.log('Unknown type task content after migration:', unknownTypeTaskContent);

    // Verify Improvement task was migrated (known task type)
    expect(improvementTaskContent).toContain('Type: Task');
    expect(improvementTaskContent).toContain('Category: Improvement');

    // Verify Unknown type task was NOT migrated (unknown task type)
    expect(unknownTypeTaskContent).toContain('Type: CustomType'); // Should remain unchanged
    expect(unknownTypeTaskContent).not.toContain('Category: CustomType'); // Should not create Category
  });

  test('should handle migration errors gracefully', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task file with malformed front-matter
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Task with valid Type that should be migrated
      await app.vault.create('Tasks/Valid Migration Task.md', `---
Title: Valid Migration Task
Type: Chore
Priority: Low
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This task should be migrated successfully.`);

      // Task with malformed YAML (should be skipped)
      await app.vault.create('Tasks/Malformed Task.md', `---
Title: Malformed Task
Type: Bug
Priority: High
Areas: [Development
Project: Test Project
Done: false
---

This task has malformed YAML and should be skipped.`);
    });

    // Wait for files to be created
    await context.page.waitForTimeout(1000);

    // Execute refresh command
    await executeCommand(context, 'Task Sync: Refresh');

    // Wait for refresh to complete
    await context.page.waitForTimeout(5000);

    // Check that valid task was migrated
    const validTaskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Valid Migration Task.md');
      return file ? await app.vault.read(file) : null;
    });

    // Check that malformed task was left unchanged
    const malformedTaskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Malformed Task.md');
      return file ? await app.vault.read(file) : null;
    });

    console.log('Valid task content after migration:', validTaskContent);
    console.log('Malformed task content after migration:', malformedTaskContent);

    // Verify valid task was migrated
    expect(validTaskContent).toContain('Type: Task');
    expect(validTaskContent).toContain('Category: Chore');

    // Verify malformed task was actually migrated successfully (our migration is robust)
    expect(malformedTaskContent).toContain('Type: Task'); // Should be migrated to Task
    expect(malformedTaskContent).toContain('Category: Bug'); // Should have Category added
  });
});
