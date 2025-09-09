/**
 * E2E tests for context-aware modal functionality
 */

import { test, expect, describe } from "vitest";
import {
  createTestFolders,
  isElementVisible,
  isElementEnabled,
  waitForElementVisible,
  verifyTaskProperties,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, openFile } from "../helpers/shared-context";
import { createProject } from "../helpers/entity-helpers";

describe("Context-Aware Task Modal", () => {
  const context = setupE2ETestHooks();

  test("should open basic modal when no context", async () => {
    await createTestFolders(context.page);

    // Open modal via command palette
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-create-task");

    // Check modal title
    const title = await context.page.textContent(".modal-title");
    expect(title).toBe("Create New Task");

    // Check that context info is not shown
    const contextInfoVisible = await isElementVisible(
      context.page,
      ".task-sync-context-info"
    );
    expect(contextInfoVisible).toBe(false);

    // Check that project and area fields are enabled
    const projectFieldEnabled = await isElementEnabled(
      context.page,
      'input[placeholder*="Project"]'
    );
    const areaFieldEnabled = await isElementEnabled(
      context.page,
      'input[placeholder*="Area"]'
    );

    expect(projectFieldEnabled).toBe(true);
    expect(areaFieldEnabled).toBe(true);
  });

  test("should show project context when opened from project file", async () => {
    await createTestFolders(context.page);

    // Create a project using entity helper
    await createProject(context, {
      name: "Test Project",
      description:
        "This is a test project file.\n\n## Objectives\n- Complete the project\n- Test functionality",
    });

    // Open the project file using helper
    await openFile(context, "Projects/Test Project.md");

    // Open modal via command palette
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-modal-container");

    // Check modal title includes project context
    const title = await context.page.textContent(".modal-title");
    expect(title).toContain("Create Task for Project: Test Project");

    // Check that context info is shown in breadcrumb
    const breadcrumbVisible = await isElementVisible(
      context.page,
      ".task-sync-breadcrumb-title"
    );
    expect(breadcrumbVisible).toBe(true);
  });

  test("should use proper form fields for task creation", async () => {
    await createTestFolders(context.page);

    // Open modal
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-modal-container");

    // Check that form fields are present
    const titleInput = await isElementVisible(
      context.page,
      ".task-sync-title-input"
    );
    expect(titleInput).toBe(true);

    const contentTextarea = await isElementVisible(
      context.page,
      ".task-sync-description-input"
    );
    expect(contentTextarea).toBe(true);

    // Check that badge selectors are present
    const typeBadge = await isElementVisible(context.page, ".task-type-badge");
    expect(typeBadge).toBe(true);

    const statusBadge = await isElementVisible(
      context.page,
      ".task-status-badge"
    );
    expect(statusBadge).toBe(true);

    // Check toolbar inputs (now in property badges)
    const areasInput = await isElementVisible(
      context.page,
      'input[placeholder="Areas"]'
    );
    expect(areasInput).toBe(true);
  });

  test("should have improved styling with Obsidian components", async () => {
    await createTestFolders(context.page);

    // Open modal
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-modal-container");

    // Check that modal has proper structure
    const modalVisible = await isElementVisible(
      context.page,
      ".task-sync-modal-container"
    );
    expect(modalVisible).toBe(true);

    // Check that form actions have proper styling (now in footer)
    const cancelButtonVisible = await isElementVisible(
      context.page,
      ".task-sync-cancel-button"
    );
    const submitButtonVisible = await isElementVisible(
      context.page,
      ".task-sync-create-button"
    );

    expect(cancelButtonVisible).toBe(true);
    expect(submitButtonVisible).toBe(true);

    // Check button text
    const cancelText = await context.page.textContent(
      ".task-sync-cancel-button"
    );
    const submitText = await context.page.textContent(
      ".task-sync-create-button"
    );

    expect(cancelText).toBe("Cancel");
    expect(submitText).toBe("Create task");
  });

  test("should actually create a task when form is submitted", async () => {
    await createTestFolders(context.page);

    // Open modal
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-modal-container");

    // Fill in task details
    await context.page.fill(".task-sync-title-input", "Test Task Creation");
    await context.page.fill(
      ".task-sync-description-input",
      "This is a test task description"
    );

    // Only fill project field if it exists (not in project context)
    const projectInput = context.page.locator(
      '.task-sync-property-input[placeholder="Project"]'
    );
    if (await projectInput.isVisible()) {
      await projectInput.fill("Test Project");
    }

    await context.page.fill(
      '.task-sync-property-input[placeholder="Areas"]',
      "Testing"
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
        "Tasks/Test Task Creation.md"
      );
      return file !== null;
    });
    expect(taskExists).toBe(true);

    // Verify task properties using helper
    const expectedProperties: Record<string, any> = {
      Title: "Test Task Creation",
      Areas: ["[[Testing]]"],
    };

    // Only check project if it was set (when not in project context)
    const projectInputCheck = context.page.locator(
      '.task-sync-property-input[placeholder="Project"]'
    );
    if (await projectInputCheck.isVisible()) {
      expectedProperties.Project = "[[Test Project]]";
    }

    await verifyTaskProperties(
      context.page,
      "Tasks/Test Task Creation.md",
      expectedProperties
    );

    // Verify task content (description)
    const taskContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/Test Task Creation.md"
      );
      if (file) {
        return await app.vault.read(file);
      }
      return null;
    });

    expect(taskContent).toContain("This is a test task description");
  });

  test("should create task with project context when opened from project file", async () => {
    await createTestFolders(context.page);

    // Create a project using entity helper
    await createProject(context, {
      name: "Context Project",
      description: "A project for testing context-aware task creation",
    });

    // Open the project file
    await openFile(context, "Projects/Context Project.md");

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
      Project: "[[Context Project]]",
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
    await createTestFolders(context.page);

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
