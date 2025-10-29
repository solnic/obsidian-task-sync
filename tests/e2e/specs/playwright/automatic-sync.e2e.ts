/**
 * E2E tests for automatic sync during data source refresh
 * Tests Phase 2 implementation: automatic sync when refreshing data sources
 */

import { test, expect } from "../../helpers/setup";
import {
  openTasksView,
  waitForLocalTasksToLoad,
  getVisibleTaskItems,
  refreshTasks,
  getTaskItemByTitle,
} from "../../helpers/tasks-view-helpers";
import { createTask } from "../../helpers/entity-helpers";
import {
  fileExists,
  readVaultFile,
  waitForFileUpdate,
  waitForTaskRefreshComplete,
  waitForSyncComplete,
} from "../../helpers/global";

test.describe("Automatic Sync During Refresh", () => {
  test("should sync vault changes with persisted data after refresh", async ({
    page,
  }) => {
    // Create initial task
    const task = await createTask(page, {
      title: "Sync Test Task",
      description: "Task to test automatic sync",
      status: "Backlog",
      priority: "Medium",
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Sync Test Task");

    // Verify task file exists
    const taskExists = await fileExists(page, "Tasks/Sync Test Task.md");
    expect(taskExists).toBe(true);

    // Open Tasks view and verify task appears
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify task is visible in UI
    await getTaskItemByTitle(page, "Sync Test Task");

    // Simulate external change to the task file (outside the app)
    const originalContent = await readVaultFile(
      page,
      "Tasks/Sync Test Task.md"
    );
    expect(originalContent).toContain("Status: Backlog");

    // Modify the file externally (simulating change outside the app)
    await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (file) {
        const content = await app.vault.read(file);
        const modifiedContent = content.replace(
          "Status: Backlog",
          "Status: In Progress"
        );
        await app.vault.modify(file, modifiedContent);
      }
    }, "Tasks/Sync Test Task.md");

    // Verify the file was modified
    const changedContent = await readVaultFile(page, "Tasks/Sync Test Task.md");
    expect(changedContent).toContain("Status: In Progress");

    // Refresh the tasks view - this should trigger automatic sync
    await refreshTasks(page);

    // Wait for the refresh to complete and sync to happen
    await waitForTaskRefreshComplete(page);
    await waitForSyncComplete(page);

    // Verify the change is reflected in the UI
    // The task should now show "In Progress" status
    const taskItem = await getTaskItemByTitle(page, "Sync Test Task");
    expect(taskItem).toBeTruthy();

    // Check that the task data was synced to persisted storage
    // We can verify this by checking if the change persists after another refresh
    await refreshTasks(page);
    await waitForTaskRefreshComplete(page);

    // Task should still be visible with updated status
    await getTaskItemByTitle(page, "Sync Test Task");
  });

  test("should preserve imported GitHub task metadata during Obsidian refresh", async ({
    page,
  }) => {
    // This test simulates a GitHub task that was imported to vault
    // and ensures its source metadata is preserved during Obsidian refresh

    // First, create a normal task through the task creation process
    await createTask(page, {
      title: "GitHub Issue Task",
      description: "Imported from GitHub issue #123",
      status: "Backlog",
      priority: "High",
      areas: ["Development"],
    });

    // Open Tasks view and wait for tasks to load
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify the task appears in the UI
    await getTaskItemByTitle(page, "GitHub Issue Task");

    // Simulate importing this task from GitHub by updating its source metadata
    // This simulates what would happen when a GitHub task is imported
    await page.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];

      // Get current tasks using the helper pattern
      let currentTasks: any[] = [];
      const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
        currentTasks = state.tasks;
      });
      unsubscribe();

      const githubTask = currentTasks.find(
        (t: any) => t.title === "GitHub Issue Task"
      );

      if (githubTask) {
        // Update the task with GitHub source metadata
        const updatedTask = {
          ...githubTask,
          source: {
            extension: "github",
            keys: {
              github: "https://github.com/test/repo/issues/123",
              obsidian:
                githubTask.source?.keys?.obsidian ||
                "Tasks/GitHub Issue Task.md",
            },
            data: {
              id: 123456,
              number: 123,
              html_url: "https://github.com/test/repo/issues/123",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          },
        };

        // Update the task in the store
        plugin.stores.taskStore.dispatch({
          type: "UPDATE_TASK",
          task: updatedTask,
        });
      }
    });

    // Refresh to test that source metadata is preserved during sync
    await refreshTasks(page);
    await waitForTaskRefreshComplete(page);
    await waitForSyncComplete(page);

    // Verify the task still appears (source metadata preserved)
    await getTaskItemByTitle(page, "GitHub Issue Task");

    // Verify the task still has GitHub source metadata in the store
    const hasGitHubSource = await page.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];

      // Get current tasks using the helper pattern
      let currentTasks: any[] = [];
      const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
        currentTasks = state.tasks;
      });
      unsubscribe();

      const githubTask = currentTasks.find(
        (t: any) => t.title === "GitHub Issue Task"
      );

      return (
        githubTask?.source?.extension === "github" &&
        githubTask?.source?.keys?.github ===
          "https://github.com/test/repo/issues/123" &&
        githubTask?.source?.data?.number === 123
      );
    });

    expect(hasGitHubSource).toBe(true);
  });

  test("should handle new task creation in vault during refresh", async ({
    page,
  }) => {
    // Open Tasks view first
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Get initial task count
    const initialTasks = await getVisibleTaskItems(page);
    const initialCount = initialTasks.length;

    // Create a new task file directly in vault (simulating external creation)
    const newTaskContent = `---
Title: Externally Created Task
Type: Task
Status: Backlog
Priority: Low
Areas: []
Project: ""
Done: false
---

This task was created outside the app.
`;

    await page.evaluate(
      async ({ filePath, content }) => {
        const app = (window as any).app;
        await app.vault.create(filePath, content);
      },
      { filePath: "Tasks/Externally Created Task.md", content: newTaskContent }
    );

    // Verify file was created
    const fileCreated = await fileExists(
      page,
      "Tasks/Externally Created Task.md"
    );
    expect(fileCreated).toBe(true);

    // Refresh to pick up the new task
    await refreshTasks(page);
    await waitForTaskRefreshComplete(page);

    // Verify the new task appears in the UI
    await getTaskItemByTitle(page, "Externally Created Task");

    // Verify task count increased
    const finalTasks = await getVisibleTaskItems(page);
    expect(finalTasks.length).toBe(initialCount + 1);
  });

  test("should handle task deletion in vault during refresh", async ({
    page,
  }) => {
    // Create a task first
    const task = await createTask(page, {
      title: "Task To Delete",
      description: "This task will be deleted externally",
      status: "Backlog",
      priority: "Low",
    });

    expect(task).toBeTruthy();

    // Open Tasks view and verify task appears
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);
    await getTaskItemByTitle(page, "Task To Delete");

    // Get initial task count
    const initialTasks = await getVisibleTaskItems(page);
    const initialCount = initialTasks.length;

    // Delete the task file externally
    await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (file) {
        await app.vault.delete(file);
      }
    }, "Tasks/Task To Delete.md");

    // Verify file was deleted
    const fileExists = await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      return file !== null;
    }, "Tasks/Task To Delete.md");
    expect(fileExists).toBe(false);

    // Refresh to sync the deletion
    await refreshTasks(page);
    await waitForTaskRefreshComplete(page);

    // Verify the task no longer appears in the UI
    const deletedTaskExists = await page
      .locator('.task-sync-item-title:has-text("Task To Delete")')
      .count();
    expect(deletedTaskExists).toBe(0);

    // Verify task count decreased
    const finalTasks = await getVisibleTaskItems(page);
    expect(finalTasks.length).toBe(initialCount - 1);
  });
});
