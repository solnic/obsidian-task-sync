/**
 * E2E tests for Status Settings Integration with Event System
 * Tests that changes to status configurations properly affect the synchronization behavior
 */

import { test, expect, describe } from 'vitest';
import { setupE2ETestHooks } from '../helpers/shared-context';
import { createTestFolders, waitForTaskSyncPlugin } from '../helpers/task-sync-setup';

const context = setupE2ETestHooks();

describe('Status Settings Integration with Event System', () => {

  test('should respect isDone configuration for status synchronization', async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Configure a custom status as done
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['task-sync'];

      if (plugin) {
        // Add a custom status marked as done
        plugin.settings.taskStatuses.push({
          name: 'Shipped',
          color: 'purple',
          isDone: true
        });

        // Add a custom status not marked as done
        plugin.settings.taskStatuses.push({
          name: 'Blocked',
          color: 'red',
          isDone: false
        });

        await plugin.saveSettings();
      }
    });

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

    // Wait for synchronization
    await context.page.waitForTimeout(1000);

    // Verify Done was set to true
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

    // Wait for synchronization
    await context.page.waitForTimeout(1000);

    // Verify Done was set to false
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

    // Change the "In Progress" status to be marked as done
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['task-sync'];

      if (plugin) {
        const inProgressStatus = plugin.settings.taskStatuses.find((s: any) => s.name === 'In Progress');
        if (inProgressStatus) {
          inProgressStatus.isDone = true;
          await plugin.saveSettings();
        }
      }
    });

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

    // Wait for synchronization with new configuration
    await context.page.waitForTimeout(1000);

    // Verify Done was set to true based on new configuration
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

    // Configure multiple statuses as done
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['task-sync'];

      if (plugin) {
        // Add multiple done statuses
        plugin.settings.taskStatuses.push(
          { name: 'Completed', color: 'green', isDone: true },
          { name: 'Delivered', color: 'blue', isDone: true },
          { name: 'Archived', color: 'gray', isDone: true }
        );

        await plugin.saveSettings();
      }
    });

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

      // Wait for synchronization
      await context.page.waitForTimeout(1000);

      // Verify Done was set to true
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

    // Configure multiple statuses with different done states
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['task-sync'];

      if (plugin) {
        // Ensure we have a good mix of done and not-done statuses
        plugin.settings.taskStatuses = [
          { name: 'Backlog', color: 'gray', isDone: false },
          { name: 'Todo', color: 'blue', isDone: false },
          { name: 'In Progress', color: 'yellow', isDone: false },
          { name: 'Done', color: 'green', isDone: true },
          { name: 'Completed', color: 'green', isDone: true },
          { name: 'Finished', color: 'purple', isDone: true }
        ];

        await plugin.saveSettings();
      }
    });

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

    // Wait for synchronization
    await context.page.waitForTimeout(1000);

    // Verify Status was changed to a done status (should prefer "Done")
    let fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Status Preference Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Done: true');
    expect(fileContent).toContain('Status: Done'); // Should prefer "Done" over other done statuses

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

    // Wait for synchronization
    await context.page.waitForTimeout(1000);

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

    await context.page.waitForTimeout(1000);

    let fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Settings Change Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Done');
    expect(fileContent).toContain('Done: true');

    // Change settings (add new status)
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['task-sync'];

      if (plugin) {
        plugin.settings.taskStatuses.push({
          name: 'Review',
          color: 'orange',
          isDone: false
        });

        await plugin.saveSettings();
      }
    });

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

    await context.page.waitForTimeout(1000);

    fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Tasks/Settings Change Task.md');
      return file ? await app.vault.read(file) : null;
    });

    expect(fileContent).toContain('Status: Review');
    expect(fileContent).toContain('Done: false'); // Review is not marked as done
  });
});
