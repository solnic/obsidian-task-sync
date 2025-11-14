/**
 * E2E tests for sync property filtering
 * Tests that extensions can define which properties should be synced
 * and that other properties are not overridden during sync
 */

import { test, expect } from "../helpers/setup";
import { createTask, getTaskByTitle } from "../helpers/entity-helpers";
import {
  fileExists,
  readVaultFile,
  enableIntegration,
  openView,
  switchToTaskService,
  selectFromDropdown,
  reloadPlugin,
} from "../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../helpers/github-integration-helpers";

test.describe("Sync Property Filtering", () => {
  test("should only sync GitHub-defined properties and preserve Obsidian-specific properties", async ({
    page,
  }) => {
    // First, create an Obsidian task with properties
    const task = await createTask(page, {
      title: "Cross-Source Task",
      description: "Original description",
      status: "Backlog",
      priority: "High",
      areas: ["Development", "Testing"],
      project: "My Project",
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Cross-Source Task");

    // Verify task file exists
    const taskExists = await fileExists(page, "Tasks/Cross-Source Task.md");
    expect(taskExists).toBe(true);

    // Manually link the task to a GitHub issue by updating its source
    await page.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];

      let currentTasks: any[] = [];
      const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
        currentTasks = state.tasks;
      });
      unsubscribe();

      const task = currentTasks.find(
        (t: any) => t.title === "Cross-Source Task"
      );

      if (task) {
        const updatedTask = {
          ...task,
          source: {
            extension: "github",
            keys: {
              github: "https://github.com/test-owner/test-repo/issues/456",
              obsidian: task.source.keys.obsidian,
            },
            data: {
              owner: "test-owner",
              repo: "test-repo",
              id: 789,
              number: 456,
              html_url: "https://github.com/test-owner/test-repo/issues/456",
              state: "open",
              title: "Cross-Source Task",
              body: "Original description",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          },
        };

        plugin.stores.taskStore.dispatch({
          type: "UPDATE_TASK",
          task: updatedTask,
        });
      }
    });

    // Now enable GitHub and stub it to return updated data for this issue
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-test-repo",
      issues: "issue-updated-456",
      currentUser: "current-user-basic",
    });

    // Wait for GitHub to be ready
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      { state: "visible", timeout: 10000 }
    );

    // Switch to GitHub and trigger a refresh by selecting the repository
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "repository-filter", "test-repo");

    // Wait for the sync to complete
    await page.waitForTimeout(2000);

    // Now check the task - it will have the updated title from GitHub
    // Since title is a GitHub-syncable property, it will be updated
    const updatedTask = await getTaskByTitle(page, "Updated Title from GitHub");

    expect(updatedTask).toBeDefined();

    // GitHub-defined properties SHOULD be synced from GitHub data
    expect(updatedTask.title).toBe("Updated Title from GitHub");

    // Obsidian-specific properties should NOT be overridden
    // They should retain their original values
    expect(updatedTask.priority).toBe("High");
    expect(updatedTask.areas).toEqual(["Development", "Testing"]);
    expect(updatedTask.project).toBe("My Project");

    // Verify the file - it may still have the old name or the new name
    let fileContent = await readVaultFile(
      page,
      "Tasks/Updated Title from GitHub.md"
    );
    if (!fileContent) {
      // Try the original name
      fileContent = await readVaultFile(page, "Tasks/Cross-Source Task.md");
    }

    expect(fileContent).toBeTruthy();
    expect(fileContent).toContain("Priority: High");
    expect(fileContent).toContain("Development");
    expect(fileContent).toContain("Testing");
    expect(fileContent).toContain("Project: My Project");
  });

  test.skip("should allow Obsidian to update non-GitHub properties without conflict", async ({
    page,
  }) => {
    // Create a task
    const task = await createTask(page, {
      title: "GitHub Task",
      description: "Test description",
      status: "Backlog",
      priority: "Medium",
    });

    expect(task).toBeTruthy();

    // Convert to GitHub task
    await page.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];

      let currentTasks: any[] = [];
      const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
        currentTasks = state.tasks;
      });
      unsubscribe();

      const task = currentTasks.find((t: any) => t.title === "GitHub Task");

      if (task) {
        const updatedTask = {
          ...task,
          source: {
            extension: "github",
            keys: {
              github: "https://github.com/test/repo/issues/789",
              obsidian: task.source.keys.obsidian,
            },
            data: {
              id: 111,
              number: 789,
              html_url: "https://github.com/test/repo/issues/789",
            },
          },
        };

        plugin.stores.taskStore.dispatch({
          type: "UPDATE_TASK",
          task: updatedTask,
        });
      }
    });

    // Now update Obsidian-specific properties via the file
    await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (file) {
        const content = await app.vault.read(file);
        const modifiedContent = content
          .replace("Priority: Medium", "Priority: High")
          .replace("Areas: []", 'Areas: ["Important"]');
        await app.vault.modify(file, modifiedContent);
      }
    }, "Tasks/GitHub Task.md");

    // Refresh to trigger sync
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);
    await refreshTasks(page);
    await waitForTaskRefreshComplete(page);
    await waitForSyncComplete(page);

    // Verify the Obsidian-specific properties were updated and preserved
    const taskData = await page.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];

      let currentTasks: any[] = [];
      const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
        currentTasks = state.tasks;
      });
      unsubscribe();

      const task = currentTasks.find((t: any) => t.title === "GitHub Task");

      return {
        priority: task?.priority,
        areas: task?.areas,
      };
    });

    // Obsidian updates should be preserved
    expect(taskData.priority).toBe("High");
    expect(taskData.areas).toEqual(["Important"]);
  });
});
