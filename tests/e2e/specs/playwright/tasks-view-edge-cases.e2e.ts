/**
 * E2E tests for TasksView edge cases and error handling
 * Tests error conditions, edge cases, and robustness
 */

import { test, expect } from "../../helpers/setup";
import {
  openTasksView,
  waitForLocalTasksToLoad,
  getVisibleTaskItems,
  searchTasks,
  refreshTasks,
  getTaskItemByTitle,
  verifyEmptyState,
  verifyTaskCount,
  createTestTask,
} from "../../helpers/tasks-view-helpers";
import {
  readVaultFile,
} from "../../helpers/global";

test.describe("TasksView Edge Cases and Error Handling", () => {
  test("should handle missing Tasks folder gracefully", async ({ page }) => {
    // Delete the Tasks folder to simulate the error condition
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

    // Should show empty state instead of crashing
    await verifyEmptyState(page, "No tasks found");

    // Verify no task items are shown
    await verifyTaskCount(page, 0);
  });

  test("should handle corrupted task files gracefully", async ({ page }) => {
    // Create a task with invalid front-matter
    await page.evaluate(async () => {
      const app = (window as any).app;
      
      // Ensure Tasks folder exists
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create a file with corrupted front-matter
      const corruptedContent = `---
Title: Corrupted Task
Type: Task
Priority: Invalid Priority Value
Status: 
Category: 
---

This task has corrupted front-matter.`;
      
      await app.vault.create("Tasks/Corrupted Task.md", corruptedContent);
    });

    // Create a valid task for comparison
    await createTestTask(page, {
      title: "Valid Task",
      category: "Feature",
      priority: "High",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Should still show the valid task
    await getTaskItemByTitle(page, "Valid Task");

    // The corrupted task might be shown with default values or filtered out
    // The important thing is that the view doesn't crash
    const taskItems = await getVisibleTaskItems(page);
    expect(taskItems.length).toBeGreaterThanOrEqual(1);
  });

  test("should handle tasks with missing required properties", async ({ page }) => {
    // Create a task file with minimal front-matter
    await page.evaluate(async () => {
      const app = (window as any).app;
      
      // Ensure Tasks folder exists
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      const minimalContent = `---
Title: Minimal Task
Type: Task
---

This task has minimal properties.`;
      
      await app.vault.create("Tasks/Minimal Task.md", minimalContent);
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Should display the task with default values
    await getTaskItemByTitle(page, "Minimal Task");

    // Verify the task is displayed even without all properties
    const taskItem = await getTaskItemByTitle(page, "Minimal Task");
    const taskText = await taskItem.textContent();
    expect(taskText).toContain("Minimal Task");
  });

  test("should handle very long task titles gracefully", async ({ page }) => {
    // Create a task with a very long title
    const longTitle = "This is a very long task title that should be handled gracefully by the UI without breaking the layout or causing display issues in the Tasks view component";
    
    await createTestTask(page, {
      title: longTitle,
      category: "Feature",
      priority: "Medium",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Should display the task without layout issues
    await getTaskItemByTitle(page, longTitle);

    // Verify the task item doesn't break the layout
    const taskItem = await getTaskItemByTitle(page, longTitle);
    const boundingBox = await taskItem.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);
  });

  test("should handle special characters in task titles", async ({ page }) => {
    // Create tasks with special characters
    const specialTasks = [
      "Task with émojis 🚀 and ñ characters",
      "Task/with\\slashes",
      "Task with \"quotes\" and 'apostrophes'",
      "Task with [brackets] and (parentheses)",
      "Task with #hashtags and @mentions",
    ];

    for (const title of specialTasks) {
      await createTestTask(page, {
        title,
        category: "Feature",
      });
    }

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify all special character tasks are displayed
    for (const title of specialTasks) {
      await getTaskItemByTitle(page, title);
    }

    // Verify task count
    const taskItems = await getVisibleTaskItems(page);
    expect(taskItems.length).toBeGreaterThanOrEqual(specialTasks.length);
  });

  test("should handle rapid task creation and deletion", async ({ page }) => {
    // Open Tasks view first
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Get initial count
    const initialTasks = await getVisibleTaskItems(page);
    const initialCount = initialTasks.length;

    // Rapidly create multiple tasks
    const rapidTasks = ["Rapid Task 1", "Rapid Task 2", "Rapid Task 3"];
    
    for (const title of rapidTasks) {
      await createTestTask(page, { title, category: "Feature" });
    }

    // Wait for all tasks to appear
    await page.waitForFunction(
      (expectedCount) => {
        const taskItems = document.querySelectorAll('[data-testid^="local-task-item-"]');
        return taskItems.length >= expectedCount;
      },
      initialCount + rapidTasks.length,
      { timeout: 5000 }
    );

    // Verify all rapid tasks are present
    for (const title of rapidTasks) {
      await getTaskItemByTitle(page, title);
    }

    // Rapidly delete the tasks
    for (const title of rapidTasks) {
      await page.evaluate(async (taskTitle) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(`Tasks/${taskTitle}.md`);
        if (file) {
          await app.vault.delete(file);
        }
      }, title);
    }

    // Wait for tasks to disappear
    await page.waitForFunction(
      (expectedCount) => {
        const taskItems = document.querySelectorAll('[data-testid^="local-task-item-"]');
        return taskItems.length <= expectedCount;
      },
      initialCount,
      { timeout: 5000 }
    );

    // Verify we're back to initial count
    const finalTasks = await getVisibleTaskItems(page);
    expect(finalTasks.length).toBe(initialCount);
  });

  test("should handle search with no results", async ({ page }) => {
    // Create some test tasks
    await createTestTask(page, {
      title: "Searchable Task",
      category: "Feature",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Search for something that doesn't exist
    await searchTasks(page, "NonexistentSearchTerm");

    // Wait for search to apply
    await page.waitForTimeout(500);

    // Should show empty state or no results
    const taskItems = await getVisibleTaskItems(page);
    expect(taskItems.length).toBe(0);

    // Clear search and verify tasks reappear
    await page.locator('[data-testid="local-search-input"]').clear();
    await page.waitForTimeout(300);

    const restoredTasks = await getVisibleTaskItems(page);
    expect(restoredTasks.length).toBeGreaterThanOrEqual(1);
  });

  test("should handle plugin disable/enable cycle", async ({ page }) => {
    // Create a test task
    await createTestTask(page, {
      title: "Plugin Cycle Test",
      category: "Feature",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify task is displayed
    await getTaskItemByTitle(page, "Plugin Cycle Test");

    // Disable and re-enable the plugin
    await page.evaluate(async () => {
      const app = (window as any).app;
      const pluginManager = app.plugins;

      // Disable plugin
      await pluginManager.disablePlugin("obsidian-task-sync");

      // Re-enable plugin
      await pluginManager.enablePlugin("obsidian-task-sync");
    });

    // Wait for plugin to reinitialize
    await page.waitForTimeout(2000);

    // Open Tasks view again
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify task is still displayed after plugin restart
    await getTaskItemByTitle(page, "Plugin Cycle Test");
  });

  test("should handle concurrent file modifications", async ({ page }) => {
    // Create a test task
    await createTestTask(page, {
      title: "Concurrent Mod Test",
      category: "Feature",
      priority: "Low",
    });

    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Verify initial state
    const taskItem = await getTaskItemByTitle(page, "Concurrent Mod Test");
    let taskText = await taskItem.textContent();
    expect(taskText).toContain("Low");

    // Simulate concurrent modifications to the same file
    await Promise.all([
      // Modification 1: Change priority
      page.evaluate(async () => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath("Tasks/Concurrent Mod Test.md");
        if (file) {
          await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
            frontmatter.Priority = "High";
          });
        }
      }),
      
      // Modification 2: Change status
      page.evaluate(async () => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath("Tasks/Concurrent Mod Test.md");
        if (file) {
          await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
            frontmatter.Status = "In Progress";
          });
        }
      }),
    ]);

    // Wait for changes to be reflected
    await page.waitForFunction(
      () => {
        const taskElement = document.querySelector('[data-testid^="local-task-item-"]:has-text("Concurrent Mod Test")');
        return taskElement && 
               (taskElement.textContent?.includes("High") || taskElement.textContent?.includes("In Progress"));
      },
      { timeout: 5000 }
    );

    // Verify the task still displays correctly (one of the changes should be applied)
    taskText = await taskItem.textContent();
    const hasHighPriority = taskText.includes("High");
    const hasInProgressStatus = taskText.includes("In Progress");
    
    // At least one of the concurrent modifications should be visible
    expect(hasHighPriority || hasInProgressStatus).toBe(true);
  });
});
