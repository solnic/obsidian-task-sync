/**
 * E2E tests for context-aware modal functionality
 */

import { test, expect, describe } from "vitest";
import {
  waitForElementVisible,
  verifyTaskProperties,
  createFullyQualifiedLink,
  getFileContent,
  openFile,
} from "../../helpers/global";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import { createProject } from "../../helpers/entity-helpers";

describe("Context-Aware Task Modal", () => {
  const context = setupE2ETestHooks();

  test("should create a task when form is submitted", async () => {
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-modal-container");

    // Fill in task details
    await context.page.fill(
      "[data-testid='title-input']",
      "Test Task Creation"
    );
    await context.page.fill(
      "[data-testid='description-input']",
      "This is a test task description"
    );

    // Click more options to reveal extra fields
    await context.page.click("[data-testid='more-options-button']");

    // Wait for extra fields to appear
    await waitForElementVisible(context.page, "[data-testid='areas-input']");

    // Fill in areas
    await context.page.fill("[data-testid='areas-input']", "Testing");

    // Submit the form
    await context.page.click("[data-testid='create-button']");

    // Wait for modal to close
    await context.page.waitForSelector(".task-sync-modal-container", {
      state: "detached",
    });

    // Verify task properties using helper
    const expectedProperties: Record<string, any> = {
      Title: "Test Task Creation",
      Areas: [createFullyQualifiedLink("Testing", "Areas")],
    };

    // Only check project if it was set (when not in project context)
    const projectInputCheck = context.page.locator(
      '.task-sync-property-input[placeholder="Project"]'
    );
    if (await projectInputCheck.isVisible()) {
      expectedProperties.Project = createFullyQualifiedLink(
        "Test Project",
        "Projects"
      );
    }

    await verifyTaskProperties(
      context.page,
      "Tasks/Test Task Creation.md",
      expectedProperties
    );

    // Verify task content (description)
    const taskContent = await getFileContent(
      context.page,
      "Tasks/Test Task Creation.md"
    );

    expect(taskContent).toContain("This is a test task description");
  });

  test("should create task with project context when opened from project file", async () => {
    // Create a project using entity helper
    await createProject(context.page, {
      name: "Context Project",
      description: "A project for testing context-aware task creation",
    });

    // Open the project file
    await openFile(context.page, "Projects/Context Project.md");

    // Open modal via command palette
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-modal-container");

    // Fill in task details (project should be auto-filled)
    await context.page.fill(".task-sync-title-input", "Context Aware Task");
    await context.page.fill(
      ".task-sync-description-input",
      "This task should inherit project context"
    );

    // Submit the form
    await context.page.click(".task-sync-create-button");

    // Wait for modal to close
    await context.page.waitForSelector(".task-sync-modal-container", {
      state: "detached",
    });

    // Verify task file was created
    const taskExists = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/Context Aware Task.md"
      );
      return file !== null;
    });
    expect(taskExists).toBe(true);

    // Verify task properties using helper
    await verifyTaskProperties(context.page, "Tasks/Context Aware Task.md", {
      Title: "Context Aware Task",
      Project: createFullyQualifiedLink("Context Project", "Projects"),
    });

    // Verify task content (description)
    const taskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/Context Aware Task.md"
      );
      if (file) {
        return await app.vault.read(file);
      }
      return null;
    });

    expect(taskContent).toContain("This task should inherit project context");
  });

  test("should handle task creation cancellation properly", async () => {
    // Open modal
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-modal-container");

    // Fill in some task details
    await context.page.fill(".task-sync-title-input", "Cancelled Task");
    await context.page.fill(
      ".task-sync-description-input",
      "This task should not be created"
    );

    // Cancel the form
    await context.page.click(".task-sync-cancel-button");

    // Wait for modal to close
    await context.page.waitForSelector(".task-sync-modal-container", {
      state: "detached",
    });

    // Verify task file was NOT created
    const taskExists = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("Tasks/Cancelled Task.md");
      return file !== null;
    });
    expect(taskExists).toBe(false);
  });
});
