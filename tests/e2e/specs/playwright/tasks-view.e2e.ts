/**
 * E2E tests for TasksView component
 * Tests the new Tasks tab view functionality with Local Tasks service
 */

import { test, expect } from "../../helpers/setup";
import {
  openTasksView,
  waitForLocalTasksToLoad,
  getVisibleTaskItems,
  refreshTasks,
  getTaskItemByTitle,
  hoverTaskItem,
  openTaskItem,
  verifyTaskBadges,
  verifyEmptyState,
  verifyTaskCount,
} from "../../helpers/tasks-view-helpers";
import { createTask } from "../../helpers/entity-helpers";

test.describe("TasksView Component", () => {
  test("should open Tasks view and display local tasks", async ({ page }) => {
    // Create some test tasks first
    await createTask(page, {
      title: "Display Test Task 1",
      category: "Feature",
      priority: "High",
      status: "In Progress",
    });

    await createTask(page, {
      title: "Display Test Task 2",
      category: "Bug",
      priority: "Medium",
      status: "Backlog",
    });

    // Open the Tasks view
    await openTasksView(page);

    // Wait for local tasks to load
    await waitForLocalTasksToLoad(page);

    // Verify tasks are displayed
    const taskItems = await getVisibleTaskItems(page);
    expect(taskItems.length).toBeGreaterThanOrEqual(2);

    // Verify our test tasks are present
    await getTaskItemByTitle(page, "Display Test Task 1");
    await getTaskItemByTitle(page, "Display Test Task 2");
  });

  test("should refresh tasks when refresh button is clicked", async ({
    page,
  }) => {
    // Create initial task
    await createTask(page, {
      title: "Refresh Test Task",
      category: "Feature",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify initial task is present
    await getTaskItemByTitle(page, "Refresh Test Task");

    // Create another task using the helper function instead of direct vault creation
    await createTask(page, {
      title: "External Task",
      category: "Bug",
      priority: "Low",
      status: "Backlog",
    });

    // Click refresh button
    await refreshTasks(page);

    // Wait for refresh to complete and verify new task appears
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        const taskTexts = Array.from(taskItems).map(
          (item) => item.textContent || ""
        );
        return taskTexts.some((text) => text.includes("External Task"));
      },
      { timeout: 5000 }
    );

    // Verify both tasks are now present
    await getTaskItemByTitle(page, "Refresh Test Task");
    await getTaskItemByTitle(page, "External Task");
  });

  test("should display task badges correctly", async ({ page }) => {
    // Create task with specific properties
    await createTask(page, {
      title: "Badge Test Task",
      category: "Feature",
      priority: "High",
      status: "In Progress",
      areas: ["Development", "Testing"],
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify task badges are displayed
    await verifyTaskBadges(page, "Badge Test Task", [
      "Feature",
      "High",
      "In Progress",
      "Development", // Only first area is shown in footer
    ]);
  });

  test("should handle empty state when no tasks exist", async ({ page }) => {
    // Delete all existing tasks
    await page.evaluate(async () => {
      const app = (window as any).app;
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (tasksFolder) {
        await app.vault.delete(tasksFolder, true);
      }
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify empty state is shown
    await verifyEmptyState(page, "No tasks found");

    // Verify no task items are displayed
    await verifyTaskCount(page, 0);
  });

  test("should open task file when Open button is clicked", async ({
    page,
  }) => {
    // Create a test task
    await createTask(page, {
      title: "Open Test Task",
      description: "This task should open when clicked",
      category: "Feature",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Click the Open button on the task
    await openTaskItem(page, "Open Test Task");

    // Verify the task file is opened in the editor
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        const activeFile = app.workspace.getActiveFile();
        return activeFile && activeFile.name === "Open Test Task.md";
      },
      { timeout: 5000 }
    );

    // Verify the file content is displayed (simplified check)
    const hasActiveFile = await page.evaluate(() => {
      const app = (window as any).app;
      const activeFile = app.workspace.getActiveFile();
      return activeFile && activeFile.name === "Open Test Task.md";
    });

    expect(hasActiveFile).toBe(true);
  });

  test("should show hover effects on task items", async ({ page }) => {
    // Create a test task
    await createTask(page, {
      title: "Hover Test Task",
      category: "Feature",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Hover over the task item
    await hoverTaskItem(page, "Hover Test Task");

    // Verify action buttons appear on hover
    const taskItem = await getTaskItemByTitle(page, "Hover Test Task");
    const openButton = taskItem.locator('[data-testid="open-task-button"]');
    await expect(openButton).toBeVisible();
  });

  test("should maintain task order and display properties correctly", async ({
    page,
  }) => {
    // Create tasks with different properties
    const tasks = [
      {
        title: "Alpha Task",
        category: "Feature",
        priority: "High",
        status: "In Progress",
      },
      {
        title: "Beta Task",
        category: "Bug",
        priority: "Low",
        status: "Backlog",
      },
      {
        title: "Gamma Task",
        category: "Enhancement",
        priority: "Medium",
        status: "Done",
      },
    ];

    for (const task of tasks) {
      await createTask(page, task);
    }

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify all tasks are displayed with correct properties
    for (const task of tasks) {
      const taskItem = await getTaskItemByTitle(page, task.title);
      const taskText = await taskItem.textContent();

      expect(taskText).toContain(task.category);
      expect(taskText).toContain(task.priority);
      expect(taskText).toContain(task.status);
    }

    // Verify task count
    await verifyTaskCount(page, tasks.length);
  });

  test("should reflect front-matter changes in real-time", async ({ page }) => {
    // Create a test task
    await createTask(page, {
      title: "Reactivity Test Task",
      priority: "Low",
      status: "Backlog",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify initial state
    const taskItem = await getTaskItemByTitle(page, "Reactivity Test Task");
    let taskText = await taskItem.textContent();
    expect(taskText).toContain("Low");
    expect(taskText).toContain("Backlog");

    // Update the task's front-matter directly using processFrontMatter
    await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/reactivity-test-task.md"
      );
      if (file) {
        await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
          frontmatter.Priority = "High";
          frontmatter.Status = "In Progress";
        });
      }
    });

    // Wait for the change to be reflected in the UI automatically
    // The system should detect the front-matter change and update the store
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        for (const item of taskItems) {
          if (
            item.textContent?.includes("Reactivity Test Task") &&
            item.textContent?.includes("High") &&
            item.textContent?.includes("In Progress")
          ) {
            return true;
          }
        }
        return false;
      },
      { timeout: 5000 }
    );

    // Verify the changes are reflected
    const updatedTaskItem = await getTaskItemByTitle(
      page,
      "Reactivity Test Task"
    );
    const updatedTaskText = await updatedTaskItem.textContent();
    expect(updatedTaskText).toContain("High");
    expect(updatedTaskText).toContain("In Progress");
  });

  test("should handle task creation and deletion gracefully", async ({
    page,
  }) => {
    // Open Tasks view first
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Get initial task count
    const initialTasks = await getVisibleTaskItems(page);
    const initialCount = initialTasks.length;

    // Create a new task
    await createTask(page, {
      title: "Dynamic Creation Test",
      category: "Feature",
    });

    // Wait for the new task to appear
    await page.waitForFunction(
      (expectedCount) => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length === expectedCount;
      },
      initialCount + 1,
      { timeout: 5000 }
    );

    // Verify the new task is displayed
    await getTaskItemByTitle(page, "Dynamic Creation Test");

    // Delete the task
    await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/Dynamic Creation Test.md"
      );
      if (file) {
        await app.vault.delete(file);
      }
    });

    // Manually refresh to pick up the deletion (since real-time watching isn't implemented yet)
    await refreshTasks(page);

    // Wait for the task to disappear
    await page.waitForFunction(
      (expectedCount) => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length === expectedCount;
      },
      initialCount,
      { timeout: 5000 }
    );

    // Verify the task is no longer displayed
    const finalTasks = await getVisibleTaskItems(page);
    expect(finalTasks.length).toBe(initialCount);
  });
});
