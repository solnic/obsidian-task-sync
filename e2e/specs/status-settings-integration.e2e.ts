/**
 * E2E tests for Status Settings Integration with Event System
 * Tests that changes to status configurations properly affect the synchronization behavior
 */

import { test, expect, describe } from 'vitest';
import { setupE2ETestHooks } from '../helpers/shared-context';
import {
  createTestFolders,
  waitForTaskSyncPlugin,
  waitForTaskPropertySync,
  openTaskStatusSettings,
  addTaskStatus,
  toggleTaskStatusDone
} from '../helpers/task-sync-setup';

describe('Status Settings Integration with Event System', () => {
  const context = setupE2ETestHooks();

  test('should respect isDone configuration for status synchronization', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Open Task Status settings and add custom statuses through UI
    await openTaskStatusSettings(context);

    // Add a custom status marked as done
    await addTaskStatus(context.page, 'Shipped', 'purple', true);

    // Add a custom status not marked as done
    await addTaskStatus(context.page, 'Blocked', 'red', false);

    // Close settings by pressing Escape
    await context.page.keyboard.press('Escape');

    // Create a task
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Custom Status Task.md', `---
Title: Custom Status Task
Type: Task
Priority: Medium
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This task tests custom status configurations.`);
    });

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Test changing to custom done status
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Custom Status Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Backlog', 'Status: Shipped');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(context.page, 'Tasks/Custom Status Task.md', 'Done', 'true');

    // Verify the changes
    let fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Custom Status Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Shipped');
    expect(fileContent).toContain('Done: true');

    // Test changing to custom non-done status
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Custom Status Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Shipped', 'Status: Blocked');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(context.page, 'Tasks/Custom Status Task.md', 'Done', 'false');

    // Verify the changes
    fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Custom Status Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Blocked');
    expect(fileContent).toContain('Done: false');
  });

  test('should update synchronization when status isDone property changes', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task with a specific status
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Dynamic Config Task.md', `---
Title: Dynamic Config Task
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

This task tests dynamic configuration changes.`);
    });

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Initially, "In Progress" should not be marked as done
    let fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Dynamic Config Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: In Progress');
    expect(fileContent).toContain('Done: false');

    // Change the "In Progress" status to be marked as done through UI
    await openTaskStatusSettings(context);
    await toggleTaskStatusDone(context.page, 'In Progress', true);
    await context.page.keyboard.press('Escape');

    // Trigger a status change to the same status to test the new configuration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Dynamic Config Task.md');

      if (file) {
        const content = await app.vault.read(file);
        // Change to a different status and back to trigger the event
        let updatedContent = content.replace('Status: In Progress', 'Status: Backlog');
        await app.vault.modify(file, updatedContent);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 200));

        // Change back to In Progress
        const content2 = await app.vault.read(file);
        updatedContent = content2.replace('Status: Backlog', 'Status: In Progress');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for synchronization with new configuration using smart wait
    await waitForTaskPropertySync(context.page, 'Tasks/Dynamic Config Task.md', 'Done', 'true');

    // Verify the changes
    fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Dynamic Config Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: In Progress');
    expect(fileContent).toContain('Done: true');
  });

  test('should handle multiple done statuses correctly', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Configure multiple statuses as done through UI
    await openTaskStatusSettings(context);
    await addTaskStatus(context.page, 'Completed', 'green', true);
    await addTaskStatus(context.page, 'Delivered', 'blue', true);
    await addTaskStatus(context.page, 'Archived', 'gray', true);
    await context.page.keyboard.press('Escape');

    // Create a task
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Multiple Done Task.md', `---
Title: Multiple Done Task
Type: Task
Priority: Low
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This task tests multiple done statuses.`);
    });

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Test each done status
    const doneStatuses = ['Completed', 'Delivered', 'Archived'];

    for (const status of doneStatuses) {
      // Change to the done status
      await context.page.evaluate(async (statusName: string) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath('Tasks/Multiple Done Task.md');

        if (file) {
          const content = await app.vault.read(file);
          const updatedContent = content.replace(/Status: \w+/, `Status: ${statusName}`);
          await app.vault.modify(file, updatedContent);
        }
      }, status);

      // Wait for synchronization using smart wait
      await waitForTaskPropertySync(context.page, 'Tasks/Multiple Done Task.md', 'Done', 'true');

      // Verify the changes
      const fileContent = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath('Tasks/Multiple Done Task.md');
        return file ? await app.vault.read(file) : null;
      });

      expect(fileContent).toContain(`Status: ${status}`);
      expect(fileContent).toContain('Done: true');
    }
  });

  test('should prefer appropriate status when Done changes', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Configure multiple statuses with different done states through UI
    await openTaskStatusSettings(context);

    // Add additional done statuses
    await addTaskStatus(context.page, 'Completed', 'green', true);
    await addTaskStatus(context.page, 'Finished', 'purple', true);

    // Add additional non-done statuses
    await addTaskStatus(context.page, 'Todo', 'blue', false);

    await context.page.keyboard.press('Escape');

    // Create a task with a non-done status
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Status Preference Task.md', `---
Title: Status Preference Task
Type: Task
Priority: Medium
Areas: Development
Project: Test Project
Done: false
Status: In Progress
Parent task:
Sub-tasks:
tags: test
---

This task tests status preference logic.`);
    });

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Change Done to true
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Status Preference Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Done: false', 'Done: true');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(context.page, 'Tasks/Status Preference Task.md', 'Done', 'true');

    // Verify Status was changed to a done status (should prefer "Done")
    let fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Status Preference Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Done: true');
    expect(fileContent).toContain('Status: Done'); // Should prefer "Done" over other done statuses

    // Wait a bit to ensure the first synchronization is fully complete
    await context.page.waitForTimeout(200);

    // Change Done back to false
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Status Preference Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Done: true', 'Done: false');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(context.page, 'Tasks/Status Preference Task.md', 'Done', 'false');

    // Verify Status was changed to a non-done status (should prefer "Backlog")
    fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Status Preference Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Done: false');
    expect(fileContent).toContain('Status: Backlog'); // Should prefer "Backlog" over other non-done statuses
  });

  test('should handle settings changes without breaking existing synchronization', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create('Tasks/Settings Change Task.md', `---
Title: Settings Change Task
Type: Task
Priority: High
Areas: Development
Project: Test Project
Done: false
Status: Backlog
Parent task:
Sub-tasks:
tags: test
---

This task tests settings changes.`);
    });

    // Wait for file to be created and processed
    await context.page.waitForTimeout(500);

    // Test initial synchronization
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Settings Change Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Backlog', 'Status: Done');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(context.page, 'Tasks/Settings Change Task.md', 'Done', 'true');

    let fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Settings Change Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Done');
    expect(fileContent).toContain('Done: true');

    // Change settings (add new status) through UI
    await openTaskStatusSettings(context);
    await addTaskStatus(context.page, 'Review', 'orange', false);
    await context.page.keyboard.press('Escape');

    // Test synchronization still works after settings change
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Settings Change Task.md');

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace('Status: Done', 'Status: Review');
        await app.vault.modify(file, updatedContent);
      }
    });

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(context.page, 'Tasks/Settings Change Task.md', 'Done', 'false');

    fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Settings Change Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Review');
    expect(fileContent).toContain('Done: false'); // Review is not marked as done
  });
});
