/**
 * E2E tests for Status Settings Integration with Event System
 * Tests that changes to status configurations properly affect the synchronization behavior
 */

import { test, expect, describe, beforeAll } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
  waitForTaskPropertySync,
  waitForStatusChangeComplete,
  openTaskStatusSettings,
  addTaskStatus,
  toggleTaskStatusDone,
} from "../helpers/task-sync-setup";
import { createTask } from "../helpers/entity-helpers";

describe("Status Settings Integration with Event System", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);
  });

  test("should respect isDone configuration for status synchronization", async () => {
    // Open Task Status settings and add custom statuses through UI
    await openTaskStatusSettings(context);

    // Add a custom status marked as done
    await addTaskStatus(context.page, "Shipped", "purple", true);

    // Add a custom status not marked as done
    await addTaskStatus(context.page, "Blocked", "red", false);

    // Close settings by pressing Escape
    await context.page.keyboard.press("Escape");

    // Create a task using entity helper
    const task = await createTask(
      context,
      {
        title: "Custom Status Task",
        category: "Task",
        priority: "Medium",
        areas: ["Development"],
        project: "Test Project",
        done: false,
        status: "Backlog",
        tags: ["test"],
      },
      "This task tests custom status configurations."
    );

    // Test changing to custom done status
    await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace(
          "Status: Backlog",
          "Status: Shipped"
        );
        await app.vault.modify(file, updatedContent);
      }
    }, task.title);

    // Wait for synchronization using smart wait - wait for both status and done to be updated
    await waitForStatusChangeComplete(
      context.page,
      `Tasks/${task.title}.md`,
      "Shipped",
      true
    );

    // Verify the changes using the cached task entity
    let updatedTask = await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const cachedTasks = plugin.getCachedTasks();
      return cachedTasks.find((t: any) => t.title === taskName);
    }, task.title);

    expect(updatedTask.status).toBe("Shipped");
    expect(updatedTask.done).toBe(true);

    // Test changing to custom non-done status
    await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace(
          "Status: Shipped",
          "Status: Blocked"
        );
        await app.vault.modify(file, updatedContent);
      }
    }, task.title);

    // Wait for synchronization using smart wait - wait for both status and done to be updated
    await waitForStatusChangeComplete(
      context.page,
      `Tasks/${task.title}.md`,
      "Blocked",
      false
    );

    // Verify the changes using the cached task entity
    const finalTask = await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const cachedTasks = plugin.getCachedTasks();
      return cachedTasks.find((t: any) => t.title === taskName);
    }, task.title);

    expect(finalTask.status).toBe("Blocked");
    expect(finalTask.done).toBe(false);
  });

  test("should update synchronization when status isDone property changes", async () => {
    // Create a task with a specific status using entity helper
    const task = await createTask(
      context,
      {
        title: "Dynamic Config Task",
        category: "Task",
        priority: "High",
        areas: ["Development"],
        project: "Test Project",
        done: false,
        status: "In Progress",
        tags: ["test"],
      },
      "This task tests dynamic configuration changes."
    );

    // Initially, "In Progress" should not be marked as done
    expect(task.status).toBe("In Progress");
    expect(task.done).toBe(false);

    // Change the "In Progress" status to be marked as done through UI
    await openTaskStatusSettings(context);
    await toggleTaskStatusDone(context.page, "In Progress", true);
    await context.page.keyboard.press("Escape");

    // Trigger a status change to the same status to test the new configuration
    await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);

      if (file) {
        const content = await app.vault.read(file);
        // Change to a different status and back to trigger the event
        let updatedContent = content.replace(
          "Status: In Progress",
          "Status: Backlog"
        );
        await app.vault.modify(file, updatedContent);
      }
    }, task.title);

    // Wait for the intermediate change to be processed
    await waitForTaskPropertySync(
      context.page,
      `Tasks/${task.title}.md`,
      "Status",
      "Backlog"
    );

    // Change back to In Progress
    await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace(
          "Status: Backlog",
          "Status: In Progress"
        );
        await app.vault.modify(file, updatedContent);
      }
    }, task.title);

    // Wait for synchronization with new configuration using smart wait
    await waitForTaskPropertySync(
      context.page,
      `Tasks/${task.title}.md`,
      "Done",
      "true"
    );

    // Verify the changes using the cached task entity
    const updatedTask = await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const cachedTasks = plugin.getCachedTasks();
      return cachedTasks.find((t: any) => t.title === taskName);
    }, task.title);

    expect(updatedTask.status).toBe("In Progress");
    expect(updatedTask.done).toBe(true);
  });

  test("should handle multiple done statuses correctly", async () => {
    // Configure multiple statuses as done through UI
    await openTaskStatusSettings(context);
    await addTaskStatus(context.page, "Completed", "green", true);
    await addTaskStatus(context.page, "Delivered", "blue", true);
    await addTaskStatus(context.page, "Archived", "gray", true);
    await context.page.keyboard.press("Escape");

    // Create a task using entity helper
    const task = await createTask(
      context,
      {
        title: "Multiple Done Task",
        category: "Task",
        priority: "Low",
        areas: ["Development"],
        project: "Test Project",
        done: false,
        status: "Backlog",
        tags: ["test"],
      },
      "This task tests multiple done statuses."
    );

    // Test each done status
    const doneStatuses = ["Completed", "Delivered", "Archived"];

    for (const status of doneStatuses) {
      // Change to the done status
      await context.page.evaluate(
        async ({ taskName, statusName }) => {
          const app = (window as any).app;
          const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);

          if (file) {
            const content = await app.vault.read(file);
            const updatedContent = content.replace(
              /Status: \w+/,
              `Status: ${statusName}`
            );
            await app.vault.modify(file, updatedContent);
          }
        },
        { taskName: task.title, statusName: status }
      );

      // Wait for synchronization using smart wait
      await waitForTaskPropertySync(
        context.page,
        `Tasks/${task.title}.md`,
        "Done",
        "true"
      );

      // Verify the changes using the cached task entity
      const updatedTask = await context.page.evaluate(async (taskName) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const cachedTasks = plugin.getCachedTasks();
        return cachedTasks.find((t: any) => t.title === taskName);
      }, task.title);

      expect(updatedTask.status).toBe(status);
      expect(updatedTask.done).toBe(true);
    }
  });

  test("should prefer appropriate status when Done changes", async () => {
    // Configure multiple statuses with different done states through UI
    await openTaskStatusSettings(context);

    // Add additional done statuses
    await addTaskStatus(context.page, "Completed", "green", true);
    await addTaskStatus(context.page, "Finished", "purple", true);

    // Add additional non-done statuses
    await addTaskStatus(context.page, "Todo", "blue", false);

    await context.page.keyboard.press("Escape");

    // Create a task with a non-done status (use Backlog which is guaranteed to be non-done)
    const task = await createTask(
      context,
      {
        title: "Status Preference Task",
        category: "Task",
        priority: "Medium",
        areas: ["Development"],
        project: "Test Project",
        done: false,
        status: "Backlog",
        tags: ["test"],
      },
      "This task tests status preference logic."
    );

    // Change Done to true
    await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);
      const content = await app.vault.read(file);
      const updatedContent = content.replace("Done: false", "Done: true");
      await app.vault.modify(file, updatedContent);
    }, task.title);

    // Wait for synchronization using smart wait - wait for both Done and Status to be updated
    await waitForStatusChangeComplete(
      context.page,
      `Tasks/${task.title}.md`,
      "Done",
      true
    );

    // Verify Status was changed to a done status (should prefer "Done")
    let updatedTask = await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const cachedTasks = plugin.getCachedTasks();
      return cachedTasks.find((t: any) => t.title === taskName);
    }, task.title);

    expect(updatedTask.done).toBe(true);
    expect(updatedTask.status).toBe("Done");

    // Change Done back to false
    await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);
      const content = await app.vault.read(file);
      const updatedContent = content.replace("Done: true", "Done: false");
      await app.vault.modify(file, updatedContent);
    }, task.title);

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(
      context.page,
      `Tasks/${task.title}.md`,
      "Done",
      "false"
    );

    // Also wait for the Status to be updated
    await waitForTaskPropertySync(
      context.page,
      `Tasks/${task.title}.md`,
      "Status",
      "Backlog"
    );

    // Verify Status was changed to a non-done status (should prefer "Backlog")
    const finalTask = await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const cachedTasks = plugin.getCachedTasks();
      return cachedTasks.find((t: any) => t.title === taskName);
    }, task.title);

    expect(finalTask.done).toBe(false);
    expect(finalTask.status).toBe("Backlog"); // Should prefer "Backlog" over other non-done statuses
  });

  test("should handle settings changes without breaking existing synchronization", async () => {
    // Create a task using entity helper
    const task = await createTask(
      context,
      {
        title: "Settings Change Task",
        category: "Task",
        priority: "High",
        areas: ["Development"],
        project: "Test Project",
        done: false,
        status: "Backlog",
        tags: ["test"],
      },
      "This task tests settings changes."
    );

    // Test initial synchronization
    await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace(
          "Status: Backlog",
          "Status: Done"
        );
        await app.vault.modify(file, updatedContent);
      }
    }, task.title);

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(
      context.page,
      `Tasks/${task.title}.md`,
      "Done",
      "true"
    );

    let updatedTask = await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const cachedTasks = plugin.getCachedTasks();
      return cachedTasks.find((t: any) => t.title === taskName);
    }, task.title);

    expect(updatedTask.status).toBe("Done");
    expect(updatedTask.done).toBe(true);

    // Change settings (add new status) through UI
    await openTaskStatusSettings(context);
    await addTaskStatus(context.page, "Review", "orange", false);
    await context.page.keyboard.press("Escape");

    // Test synchronization still works after settings change
    await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${taskName}.md`);

      if (file) {
        const content = await app.vault.read(file);
        const updatedContent = content.replace(
          "Status: Done",
          "Status: Review"
        );
        await app.vault.modify(file, updatedContent);
      }
    }, task.title);

    // Wait for synchronization using smart wait
    await waitForTaskPropertySync(
      context.page,
      `Tasks/${task.title}.md`,
      "Done",
      "false"
    );

    const finalTask = await context.page.evaluate(async (taskName) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const cachedTasks = plugin.getCachedTasks();
      return cachedTasks.find((t: any) => t.title === taskName);
    }, task.title);

    expect(finalTask.status).toBe("Review");
    expect(finalTask.done).toBe(false); // Review is not marked as done
  });
});
