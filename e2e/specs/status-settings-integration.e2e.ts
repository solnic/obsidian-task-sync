/**
 * E2E tests for Status Settings Integration with Event System
 * Tests that changes to status configurations properly affect the synchronization behavior
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import {
  waitForTaskPropertySync,
  waitForStatusChangeComplete,
  openTaskStatusSettings,
  addTaskStatus,
  verifyTaskProperties,
} from "../helpers/global";
import { createTask } from "../helpers/entity-helpers";

describe("Status Settings Integration with Event System", () => {
  const context = setupE2ETestHooks();

  test("should respect isDone configuration for status synchronization", async () => {
    // Open Task Status settings and add custom statuses through UI
    await openTaskStatusSettings(context);

    // Add a custom status marked as done
    await addTaskStatus(context.page, "Shipped", true);

    // Add a custom status not marked as done
    await addTaskStatus(context.page, "Blocked", false);

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

    // Verify the properties were updated correctly
    await verifyTaskProperties(context.page, `Tasks/${task.title}.md`, {
      Status: "Shipped",
      Done: true,
    });

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

    // Verify the properties were updated correctly
    await verifyTaskProperties(context.page, `Tasks/${task.title}.md`, {
      Status: "Blocked",
      Done: false,
    });
  });

  test("should handle multiple done statuses correctly", async () => {
    // Configure multiple statuses as done through UI
    await openTaskStatusSettings(context);
    await addTaskStatus(context.page, "Completed", true);
    await addTaskStatus(context.page, "Delivered", true);
    await addTaskStatus(context.page, "Archived", true);
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

      // Verify the properties were updated correctly
      await verifyTaskProperties(context.page, `Tasks/${task.title}.md`, {
        Status: status,
        Done: true,
      });
    }
  });

  test("should prefer appropriate status when Done changes", async () => {
    // Configure multiple statuses with different done states through UI
    await openTaskStatusSettings(context);

    // Add additional done statuses
    await addTaskStatus(context.page, "Completed", true);
    await addTaskStatus(context.page, "Finished", true);

    // Add additional non-done statuses
    await addTaskStatus(context.page, "Todo", false);

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
    await verifyTaskProperties(context.page, `Tasks/${task.title}.md`, {
      Done: true,
      Status: "Done",
    });

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
    await verifyTaskProperties(context.page, `Tasks/${task.title}.md`, {
      Done: false,
      Status: "Backlog", // Should prefer "Backlog" over other non-done statuses
    });
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

    // Verify the properties were updated correctly
    await verifyTaskProperties(context.page, `Tasks/${task.title}.md`, {
      Status: "Done",
      Done: true,
    });

    // Change settings (add new status) through UI
    await openTaskStatusSettings(context);
    await addTaskStatus(context.page, "Review", false);
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

    // Verify the properties were updated correctly
    await verifyTaskProperties(context.page, `Tasks/${task.title}.md`, {
      Status: "Review",
      Done: false, // Review is not marked as done
    });
  });
});
