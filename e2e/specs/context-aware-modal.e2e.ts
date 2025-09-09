/**
 * E2E tests for context-aware modal functionality
 */

import { test, expect, describe } from "vitest";
import {
  createTestFolders,
  isElementVisible,
  isElementEnabled,
  waitForElementVisible,
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
    await waitForElementVisible(context.page, ".task-sync-container");

    // Check modal title includes project context
    const title = await context.page.textContent(".modal-title");
    expect(title).toContain("Create Task for Project: Test Project");

    // Check that context info is shown
    const contextInfoVisible = await isElementVisible(
      context.page,
      ".task-sync-context-info"
    );
    expect(contextInfoVisible).toBe(true);
  });

  test("should use proper form fields for task creation", async () => {
    await createTestFolders(context.page);

    // Open modal
    await context.page.keyboard.press("Control+p");
    await context.page.fill(".prompt-input", "Add Task");
    await context.page.keyboard.press("Enter");

    // Wait for modal to appear
    await waitForElementVisible(context.page, ".task-sync-container");

    // Check that form fields are present
    const titleInput = await isElementVisible(
      context.page,
      ".task-sync-title-input"
    );
    expect(titleInput).toBe(true);

    const contentTextarea = await isElementVisible(
      context.page,
      ".task-sync-content-editor"
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

    // Check toolbar inputs
    const projectInput = await isElementVisible(
      context.page,
      'input[placeholder="Project"]'
    );
    expect(projectInput).toBe(true);

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
    await waitForElementVisible(context.page, ".task-sync-container");

    // Check that modal has proper structure
    const modalVisible = await isElementVisible(
      context.page,
      ".task-sync-container"
    );
    expect(modalVisible).toBe(true);

    // Check that form actions have proper styling
    const cancelButtonVisible = await isElementVisible(
      context.page,
      "button.mod-cancel"
    );
    const submitButtonVisible = await isElementVisible(
      context.page,
      "button.mod-cta"
    );

    expect(cancelButtonVisible).toBe(true);
    expect(submitButtonVisible).toBe(true);

    // Check button text
    const cancelText = await context.page.textContent("button.mod-cancel");
    const submitText = await context.page.textContent("button.mod-cta");

    expect(cancelText).toBe("Cancel");
    expect(submitText).toBe("Create task");
  });
});
