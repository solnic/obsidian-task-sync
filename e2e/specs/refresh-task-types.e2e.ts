/**
 * Test refresh functionality with different task types
 * This test verifies that refresh adds missing properties to task files
 * regardless of their Type property value (Bug, Feature, etc.)
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";

describe("Refresh with Different Task Types", () => {
  const context = setupE2ETestHooks();

  test("should refresh task files with different Type values", async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create task files with different Type values
    const taskFiles = [
      {
        name: "Bug Task.md",
        type: "Bug",
        content: `---
Title: Bug Task
Type: Bug
---

This is a bug task with minimal properties.`,
      },
      {
        name: "Feature Task.md",
        type: "Feature",
        content: `---
Title: Feature Task
Type: Feature
---

This is a feature task with minimal properties.`,
      },
      {
        name: "Improvement Task.md",
        type: "Improvement",
        content: `---
Title: Improvement Task
Type: Improvement
---

This is an improvement task with minimal properties.`,
      },
    ];

    // Create the task files
    for (const taskFile of taskFiles) {
      await context.page.evaluate(async (taskData) => {
        const app = (window as any).app;
        await app.vault.create(`Tasks/${taskData.name}`, taskData.content);
      }, taskFile);
    }

    // Wait for files to be created
    await context.page.waitForTimeout(1000);

    // Verify files have minimal properties before refresh
    for (const taskFile of taskFiles) {
      const beforeRefresh = await context.page.evaluate(async (fileName) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        return await plugin.taskFileManager.loadFrontMatter(
          `Tasks/${fileName}`
        );
      }, taskFile.name);

      expect(beforeRefresh.Title).toBe(taskFile.name.replace(".md", ""));
      expect(beforeRefresh.Type).toBe(taskFile.type);
      expect(beforeRefresh.Priority).toBeUndefined(); // Missing property
      expect(beforeRefresh.Status).toBeUndefined(); // Missing property
      expect(beforeRefresh.Done).toBeUndefined(); // Missing property
    }

    // Execute refresh command
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Verify ALL task files now have complete properties
    for (const taskFile of taskFiles) {
      const afterRefresh = await context.page.evaluate(async (fileName) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        return await plugin.taskFileManager.loadFrontMatter(
          `Tasks/${fileName}`
        );
      }, taskFile.name);

      // Verify the Type property is preserved
      expect(afterRefresh.Type).toBe(taskFile.type);

      // Verify missing properties were added
      expect(afterRefresh.Priority).toBeDefined();
      expect(afterRefresh.Status).toBeDefined();
      expect(afterRefresh.Done).toBeDefined();
      expect(afterRefresh.Areas).toBeDefined();
      expect(afterRefresh.Project).toBeDefined();
      expect(afterRefresh["Parent task"]).toBeDefined();
      expect(afterRefresh["Do Date"]).toBeDefined();
      expect(afterRefresh["Due Date"]).toBeDefined();
      expect(afterRefresh.tags).toBeDefined();
      expect(afterRefresh.Reminders).toBeDefined();
    }
  });
});
