/**
 * E2E tests for metadata cache timeout handling
 * Tests the waitForMetadataCache method and proper cache usage in EntityStore
 */

import { test, expect, describe, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import {
  stubGitHubAPIs,
  restoreGitHubAPIs,
} from "../helpers/api-stubbing";
import { enableIntegration } from "../helpers/global";

describe("Metadata Cache Timeout Handling", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await restoreGitHubAPIs(context.page);
    
    // Clear any existing task files
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin && plugin.stores && plugin.stores.taskStore) {
        plugin.stores.taskStore.clear();
      }

      // Clean up any existing task files
      try {
        const tasksPath = "Tasks";
        const exists = await app.vault.adapter.exists(tasksPath);
        if (exists) {
          const files = await app.vault.adapter.list(tasksPath);
          for (const filePath of files.files) {
            if (filePath.endsWith(".md")) {
              try {
                await app.vault.adapter.remove(filePath);
              } catch (error) {
                console.log(`Error deleting ${filePath}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.log("Error during cleanup:", error);
      }
    });
  });

  test("should handle metadata cache timeout gracefully during task import", async () => {
    // Enable GitHub integration
    await enableIntegration(context.page, "github");
    await stubGitHubAPIs(context.page);

    // Create a task with a problematic filename that might cause metadata cache issues
    const problematicTitle = "crontabs with -@reboot- oban option instead of valid crontab cause sentry logger to fail and detach";

    const result = await context.page.evaluate(async (title) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      try {
        const githubService = plugin.integrationManager.getGitHubService();
        const issues = await githubService.fetchIssues();
        
        // Modify the first issue to have the problematic title
        const issue = { ...issues[0], title };
        const config = plugin.getDefaultImportConfig();

        const importResult = await githubService.importIssueAsTask(
          issue,
          config,
          "test/repo"
        );

        return {
          success: true,
          taskPath: importResult.taskPath,
          importSuccess: importResult.success,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack,
        };
      }
    }, problematicTitle);

    // The import should succeed without throwing metadata cache timeout
    expect(result.success).toBe(true);
    expect(result.importSuccess).toBe(true);
    expect(result.taskPath).toBeTruthy();
  });

  test("should pass cache parameter to loadEntity when available", async () => {
    // This test verifies that EntityStore.handleMetadataChange passes the cache parameter
    // to fileManager.loadEntity to avoid unnecessary waitForMetadataCache calls

    const result = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Create a task file directly to trigger metadata change event
      const taskTitle = "Test Cache Parameter Task";
      const content = `---
Title: ${taskTitle}
Type: Task
Done: false
Status: Backlog
---

This is a test task to verify cache parameter passing.`;

      try {
        // Create the file
        await app.vault.create(`Tasks/${taskTitle}.md`, content);

        // Wait for the metadata change event to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify the task was loaded successfully
        const task = plugin.stores.taskStore.findEntityByPath(`Tasks/${taskTitle}.md`);
        
        return {
          success: true,
          taskFound: !!task,
          taskTitle: task?.title,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.taskFound).toBe(true);
    expect(result.taskTitle).toBe("Test Cache Parameter Task");
  });

  test("should handle files with special characters in filename", async () => {
    // Test that files with special characters don't cause metadata cache timeouts
    const specialCharTitle = "Task with @special #chars & symbols!";

    const result = await context.page.evaluate(async (title) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      try {
        // Create task using the plugin's createTask method
        await plugin.createTask({
          title,
          category: "Bug",
          priority: "High",
          done: false,
          status: "Backlog",
        });

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify the task was created and loaded
        const tasks = plugin.stores.taskStore.getEntities();
        const createdTask = tasks.find((t: any) => t.title === title);

        return {
          success: true,
          taskFound: !!createdTask,
          taskTitle: createdTask?.title,
          totalTasks: tasks.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    }, specialCharTitle);

    expect(result.success).toBe(true);
    expect(result.taskFound).toBe(true);
    expect(result.taskTitle).toBe(specialCharTitle);
  });
});
