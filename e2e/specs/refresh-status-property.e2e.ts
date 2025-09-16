import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";

describe("Refresh Status Property", () => {
  const context = setupE2ETestHooks();

  test("should add ALL missing schema properties during refresh", async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Create a task with minimal front-matter
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create(
        "Tasks/Minimal Task.md",
        `---
Title: Minimal Task
---

This task has only a title.`
      );
    });

    // Execute refresh command
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for refresh to complete
    await context.page.waitForTimeout(5000);

    // Check that ALL schema properties were added using API
    const frontMatter = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.taskFileManager.loadFrontMatter(
        "Tasks/Minimal Task.md"
      );
    });

    console.log("Front matter after refresh:", frontMatter);

    // Verify all expected properties are present with proper values
    expect(frontMatter.Title).toBeDefined();
    expect(frontMatter.Type).toBeDefined();
    expect(frontMatter.Areas).toBeDefined();
    expect(frontMatter["Parent task"]).toBeDefined();

    expect(frontMatter.tags).toBeDefined();
    expect(frontMatter.Project).toBeDefined();
    expect(frontMatter.Done).toBeDefined();
    expect(frontMatter.Status).toBeDefined();
    expect(frontMatter.Priority).toBeDefined();

    // Verify Status has default value
    expect(frontMatter.Status).toBe("Backlog");
  });
});
