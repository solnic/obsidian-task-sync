import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";

describe("Refresh Property Cleanup", () => {
  const context = setupE2ETestHooks();

  test("should remove obsolete properties and add missing ones during refresh", async () => {
    // Create a task file with obsolete properties and missing required ones
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const vault = app.vault;

      // Create task with obsolete properties and missing required ones
      const taskContent = `---
Title: Test Task with Obsolete Properties
Type: Task
Sub-tasks: "This is an obsolete Task Sync field"
ParentTask: "This is another obsolete Task Sync field"
CustomUserField: "This should be kept"
tags: ["test"]
---

This is a test task with obsolete properties.`;

      await vault.create(
        "Tasks/Test Task with Obsolete Properties.md",
        taskContent
      );
    });

    // Wait for file to be created
    await context.page.waitForTimeout(1000);

    // Verify the file has obsolete properties
    const beforeRefresh = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.taskFileManager.loadFrontMatter(
        "Tasks/Test Task with Obsolete Properties.md"
      );
    });

    expect(beforeRefresh["Sub-tasks"]).toBe(
      "This is an obsolete Task Sync field"
    );
    expect(beforeRefresh.ParentTask).toBe(
      "This is another obsolete Task Sync field"
    );
    expect(beforeRefresh.CustomUserField).toBe("This should be kept");
    expect(beforeRefresh.Priority).toBeUndefined(); // Missing required property

    // Execute refresh command
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Verify obsolete properties are removed and missing ones are added
    const afterRefresh = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.taskFileManager.loadFrontMatter(
        "Tasks/Test Task with Obsolete Properties.md"
      );
    });

    // Obsolete Task Sync properties should be removed
    expect(afterRefresh["Sub-tasks"]).toBeUndefined();
    expect(afterRefresh.ParentTask).toBeUndefined();

    // Custom user fields and common fields should be preserved
    expect(afterRefresh.CustomUserField).toBe("This should be kept");
    expect(afterRefresh.tags).toEqual(["test"]);

    // Missing required properties should be added
    expect(afterRefresh.Priority).toBeDefined();
    expect(afterRefresh.Areas).toBeDefined();
    expect(afterRefresh.Project).toBeDefined();

    // Core properties should remain
    expect(afterRefresh.Title).toBe("Test Task with Obsolete Properties");
    expect(afterRefresh.Type).toBe("Task");
  });

  test("should preserve common Obsidian properties during refresh", async () => {
    // Create a task file with common Obsidian properties
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const vault = app.vault;

      const taskContent = `---
Title: Task with Common Properties
Type: Task
tags: ["important", "work"]
aliases: ["Alternative Name"]
cssclass: "custom-style"
publish: true
---

This task has common Obsidian properties that should be preserved.`;

      await vault.create("Tasks/Task with Common Properties.md", taskContent);
    });

    // Wait for file to be created
    await context.page.waitForTimeout(1000);

    // Execute refresh command
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Verify common properties are preserved
    const afterRefresh = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.taskFileManager.loadFrontMatter(
        "Tasks/Task with Common Properties.md"
      );
    });

    // Common Obsidian properties should be preserved
    expect(afterRefresh.tags).toEqual(["important", "work"]);
    expect(afterRefresh.aliases).toEqual(["Alternative Name"]);
    expect(afterRefresh.cssclass).toBe("custom-style");
    expect(afterRefresh.publish).toBe(true);

    // Task Sync properties should be present
    expect(afterRefresh.Title).toBe("Task with Common Properties");
    expect(afterRefresh.Type).toBe("Task");
  });
});
