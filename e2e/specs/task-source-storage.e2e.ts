/**
 * End-to-End Tests for Task Source Storage
 * Tests that source information is properly stored when importing tasks from external services
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Task Source Storage", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);
  });

  test("should store source information when importing GitHub issue", async () => {
    // Mock GitHub issue data
    const mockIssue = {
      id: 123456,
      number: 123,
      title: "Test GitHub Issue",
      body: "This is a test issue from GitHub",
      state: "open",
      html_url: "https://github.com/test/repo/issues/123",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      assignee: null,
      labels: [{ name: "bug" }],
    };

    // Import the issue as a task
    const result = await context.page.evaluate(async (issue) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin || !plugin.githubService) {
        return { error: "GitHub service not available" };
      }

      try {
        // Get default import config
        const config = plugin.getDefaultImportConfig();

        // Import the issue
        const importResult = await plugin.githubService.importIssueAsTask(
          issue,
          config,
          "test/repo"
        );

        if (!importResult.success || !importResult.taskPath) {
          return { error: "Import failed", result: importResult };
        }

        // Wait for task store to refresh
        await plugin.stores.taskStore.refreshTasks();

        // Check if the task has source information
        const task = plugin.stores.taskStore.findEntityByPath(
          importResult.taskPath
        );

        // Debug: Check all tasks in store
        const allTasks = plugin.stores.taskStore.getEntities();
        const tasksWithSource = allTasks.filter((t) => t.source);

        return {
          success: true,
          taskPath: importResult.taskPath,
          hasSource: !!task?.source,
          source: task?.source,
          taskTitle: task?.title,
          debug: {
            totalTasks: allTasks.length,
            tasksWithSource: tasksWithSource.length,
            taskFound: !!task,
            taskId: task?.id,
            allTaskTitles: allTasks.map((t) => t.title),
          },
        };
      } catch (error) {
        return { error: error.message };
      }
    }, mockIssue);

    // Verify the import was successful
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.taskPath).toBeTruthy();
    expect(result.taskTitle).toBe("Test GitHub Issue");

    // Debug output
    console.log("Debug info:", result.debug);
    console.log("Task source:", result.source);

    // BUG: This should pass but currently fails because source is not stored
    expect(result.hasSource).toBe(true);
    expect(result.source).toBeDefined();
    expect(result.source?.name).toBe("github");
    expect(result.source?.key).toBe("github-123456");
    expect(result.source?.url).toBe("https://github.com/test/repo/issues/123");
  });

  test("should store source information when importing Apple Calendar event", async () => {
    // Mock Apple Calendar event data
    const mockEvent = {
      id: "cal-event-123",
      title: "Test Calendar Event",
      startDate: new Date("2024-01-15T10:00:00Z"),
      endDate: new Date("2024-01-15T11:00:00Z"),
      isAllDay: false,
      calendar: {
        title: "Work Calendar",
        color: "#FF0000",
      },
      notes: "This is a test calendar event",
    };

    // Import the event as a task
    const result = await context.page.evaluate(async (event) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin || !plugin.appleCalendarService) {
        return { error: "Apple Calendar service not available" };
      }

      try {
        // Get default import config
        const config = plugin.getDefaultImportConfig();

        // Import the event
        const importResult =
          await plugin.appleCalendarService.importEventAsTask(event, config);

        if (!importResult.success || !importResult.taskPath) {
          return { error: "Import failed", result: importResult };
        }

        // Wait for task store to refresh
        await plugin.stores.taskStore.refreshTasks();

        // Check if the task has source information
        const task = plugin.stores.taskStore.findEntityByPath(
          importResult.taskPath
        );

        return {
          success: true,
          taskPath: importResult.taskPath,
          hasSource: !!task?.source,
          source: task?.source,
          taskTitle: task?.title,
        };
      } catch (error) {
        return { error: error.message };
      }
    }, mockEvent);

    // Verify the import was successful
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.taskPath).toBeTruthy();
    expect(result.taskTitle).toBe("Test Calendar Event");

    // BUG: This should pass but currently fails because source is not stored
    expect(result.hasSource).toBe(true);
    expect(result.source).toBeDefined();
    expect(result.source?.name).toBe("apple-calendar");
    expect(result.source?.key).toBe("cal-event-123");
  });

  test("should find imported tasks by source", async () => {
    // Mock GitHub issue data
    const mockIssue = {
      id: 789012,
      number: 456,
      title: "Findable GitHub Issue",
      body: "This issue should be findable by source",
      state: "open",
      html_url: "https://github.com/test/repo/issues/456",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      assignee: null,
      labels: [],
    };

    // Import the issue
    const importResult = await context.page.evaluate(async (issue) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const config = plugin.getDefaultImportConfig();
      return await plugin.githubService.importIssueAsTask(
        issue,
        config,
        "test/repo"
      );
    }, mockIssue);

    expect(importResult.success).toBe(true);

    // Try to find the task by source
    const findResult = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Wait for task store to refresh
      await plugin.stores.taskStore.refreshTasks();

      // Try to find the task by source
      const foundTask = plugin.stores.taskStore.findTaskBySource(
        "github",
        "github-789012"
      );
      const isImported = plugin.stores.taskStore.isTaskImported(
        "github",
        "github-789012"
      );

      return {
        foundTask: !!foundTask,
        foundTaskTitle: foundTask?.title,
        isImported,
      };
    });

    // BUG: These should pass but currently fail because source is not stored
    expect(findResult.foundTask).toBe(true);
    expect(findResult.foundTaskTitle).toBe("Findable GitHub Issue");
    expect(findResult.isImported).toBe(true);
  });

  test("should prevent duplicate imports using source tracking", async () => {
    // Mock GitHub issue data
    const mockIssue = {
      id: 345678,
      number: 789,
      title: "Duplicate Prevention Test",
      body: "This issue should not be imported twice",
      state: "open",
      html_url: "https://github.com/test/repo/issues/789",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      assignee: null,
      labels: [],
    };

    // Import the issue twice
    const results = await context.page.evaluate(async (issue) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const config = plugin.getDefaultImportConfig();

      // First import
      const result1 = await plugin.githubService.importIssueAsTask(
        issue,
        config,
        "test/repo"
      );

      // Second import (should be skipped)
      const result2 = await plugin.githubService.importIssueAsTask(
        issue,
        config,
        "test/repo"
      );

      return { result1, result2 };
    }, mockIssue);

    // First import should succeed
    expect(results.result1.success).toBe(true);
    expect(results.result1.skipped).toBeFalsy();

    // Second import should be skipped due to duplicate detection
    // BUG: This currently fails because source tracking doesn't work
    expect(results.result2.success).toBe(true);
    expect(results.result2.skipped).toBe(true);
    expect(results.result2.reason).toBe("Task already imported");
  });
});
