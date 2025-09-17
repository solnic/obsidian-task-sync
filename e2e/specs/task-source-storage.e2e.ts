/**
 * End-to-End Tests for Task Source Storage
 * Tests that source information is properly stored when importing tasks from external services
 */

import { test, expect, describe, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import {
  stubGitHubAPIs,
  stubAppleCalendarAPIs,
  restoreGitHubAPIs,
  restoreAPI,
} from "../helpers/api-stubbing";
import { enableIntegration } from "../helpers/global";

describe("Task Source Storage", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    // Reset API stubs to ensure clean state between tests
    await restoreGitHubAPIs(context.page);
    await restoreAPI(context.page, "apple-calendar");

    // Clear any existing task files from previous tests
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // First, clear the task store completely
      if (plugin && plugin.stores && plugin.stores.taskStore) {
        plugin.stores.taskStore.clear();
        console.log("Cleared task store");
      }

      // Use the vault adapter to get a fresh list of files and delete them
      try {
        const tasksPath = "Tasks";
        const exists = await app.vault.adapter.exists(tasksPath);
        if (exists) {
          const files = await app.vault.adapter.list(tasksPath);
          console.log(
            `Found ${files.files.length} files in Tasks folder:`,
            files.files
          );

          for (const filePath of files.files) {
            if (filePath.endsWith(".md")) {
              try {
                await app.vault.adapter.remove(filePath);
                console.log(`Successfully deleted task file: ${filePath}`);
              } catch (error) {
                console.log(`Failed to delete file ${filePath}:`, error);
              }
            }
          }
        } else {
          console.log("Tasks folder does not exist");
        }
      } catch (error) {
        console.log("Error during file cleanup:", error);
      }

      // Force refresh the vault's file cache
      try {
        await app.vault.adapter.list(""); // This forces a refresh of the file system cache
        console.log("Refreshed vault file cache");
      } catch (error) {
        console.log("Error refreshing vault cache:", error);
      }

      // Force the task store to completely rebuild by clearing and re-initializing
      if (plugin && plugin.stores && plugin.stores.taskStore) {
        // Clear the store completely
        plugin.stores.taskStore.clear();
        console.log("Cleared task store");

        // Force a complete rebuild by manually scanning the vault
        const allFiles = app.vault.getMarkdownFiles();
        const taskFiles = allFiles.filter((file: any) =>
          file.path.startsWith("Tasks/")
        );
        console.log(
          `Found ${taskFiles.length} task files in vault after cleanup`
        );

        if (taskFiles.length > 0) {
          console.log(
            "Task files found:",
            taskFiles.map((f: any) => f.path)
          );

          // Force delete any remaining task files that shouldn't exist
          for (const file of taskFiles) {
            try {
              await app.vault.delete(file);
              console.log(`Force deleted remaining task file: ${file.path}`);
            } catch (error) {
              console.log(`Failed to force delete ${file.path}:`, error);
            }
          }
        }

        // Now refresh the task store to ensure it's properly synced with the file system
        await plugin.stores.taskStore.refreshTasks();
        console.log("Refreshed task store");

        // Check if any tasks remain in the store
        const remainingTasks = plugin.stores.taskStore.getEntities();
        console.log(
          `Tasks remaining in store after cleanup: ${remainingTasks.length}`
        );
        if (remainingTasks.length > 0) {
          console.log(
            "Remaining tasks:",
            remainingTasks.map((t: any) => ({
              title: t.title,
              filePath: t.filePath,
            }))
          );
        }
      }
    });

    // Add a small delay to ensure file operations complete
    await context.page.waitForTimeout(100);
  });

  test("should store source information when importing GitHub issue", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "test/repo",
    });

    await stubGitHubAPIs(context.page, {
      issues: "issues-basic",
      repositories: "repositories-basic",
      currentUser: "current-user-basic",
    });

    const result = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const githubService = plugin.integrationManager.getGitHubService();

      const issues = await githubService.fetchIssues();
      const issue = issues[0]; // Use first issue from fixture

      const config = plugin.getDefaultImportConfig();

      const importResult = await githubService.importIssueAsTask(
        issue,
        config,
        "test/repo"
      );

      await plugin.stores.taskStore.refreshTasks();

      const task = plugin.stores.taskStore.findEntityByPath(
        importResult.taskPath
      );
      const allTasks = plugin.stores.taskStore.getEntities();
      const tasksWithSource = allTasks.filter((t: any) => t.source);

      return {
        success: true,
        taskPath: importResult.taskPath,
        source: task.source,
        taskTitle: task.title,
        debug: {
          totalTasks: allTasks.length,
          tasksWithSource: tasksWithSource.length,
          taskId: task.id,
          allTaskTitles: allTasks.map((t: any) => t.title),
        },
      };
    });

    // Verify the import was successful
    expect(result.success).toBe(true);
    expect(result.taskPath).toBeTruthy();
    expect(result.taskTitle).toBe("Test import persistence issue");

    expect(result.source.name).toBe("github");
    expect(result.source.key).toBe("github-999888");
    expect(result.source.url).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/999"
    );
  });

  test("should store source information when importing Apple Calendar event", async () => {
    await enableIntegration(context.page, "appleCalendarIntegration", {
      enabled: true,
    });

    await stubAppleCalendarAPIs(context.page, {
      events: "events-basic",
      calendars: "calendars-basic",
      permissions: "permissions-granted",
    });

    const result = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const events = await plugin.appleCalendarService.getEvents();
      const event = events[0]; // Use first event from fixture
      const config = plugin.getDefaultImportConfig();

      const importResult = await plugin.appleCalendarService.importEventAsTask(
        event,
        config
      );
      await plugin.stores.taskStore.refreshTasks();

      const task = plugin.stores.taskStore.findEntityByPath(
        importResult.taskPath
      );

      return {
        taskPath: importResult.taskPath,
        source: task.source,
        taskTitle: task.title,
      };
    });

    expect(result.taskPath).toBeTruthy();
    expect(result.taskTitle).toBe("Team Meeting");

    expect(result.source).toBeDefined();
    expect(result.source.name).toBe("apple-calendar");
    expect(result.source.key).toBe("event-1");
  });

  test("should find imported tasks by source", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "test/repo",
    });

    await stubGitHubAPIs(context.page, {
      issues: "issues-basic",
      repositories: "repositories-basic",
      currentUser: "current-user-basic",
    });

    const importResult = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const githubService = plugin.integrationManager?.getGitHubService();
      const issues = await githubService.fetchIssues();
      const issue = issues[0]; // Use first issue from fixture
      const config = plugin.getDefaultImportConfig();

      return await githubService.importIssueAsTask(issue, config, "test/repo");
    });

    expect(importResult.success).toBe(true);

    const findResult = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      await plugin.stores.taskStore.refreshTasks();

      const foundTask = plugin.stores.taskStore.findTaskBySource(
        "github",
        "github-999888"
      );
      const isImported = plugin.stores.taskStore.isTaskImported(
        "github",
        "github-999888"
      );

      return {
        foundTaskTitle: foundTask.title,
        isImported,
      };
    });

    expect(findResult.foundTaskTitle).toBe("Test import persistence issue");
    expect(findResult.isImported).toBe(true);
  });

  test("should prevent duplicate imports using source tracking", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "test/repo",
    });

    await stubGitHubAPIs(context.page, {
      issues: "duplicate-test-issue",
      repositories: "repositories-basic",
      currentUser: "current-user-basic",
    });

    const results = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const githubService = plugin.integrationManager?.getGitHubService();

      const issues = await githubService.fetchIssues();

      const issue = issues[0]; // Use first issue from fixture
      const config = plugin.getDefaultImportConfig();

      const result1 = await githubService.importIssueAsTask(
        issue,
        config,
        "test/repo"
      );

      const result2 = await githubService.importIssueAsTask(
        issue,
        config,
        "test/repo"
      );

      return { result1, result2 };
    });

    expect(results.result1.success).toBe(true);
    expect(results.result1.skipped).toBeFalsy();

    expect(results.result2.success).toBe(true);
    expect(results.result2.skipped).toBe(true);
    expect(results.result2.reason).toBe("Task already imported");
  });
});
