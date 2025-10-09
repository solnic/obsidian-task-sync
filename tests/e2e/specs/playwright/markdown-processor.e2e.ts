/**
 * E2E tests for TaskTodoMarkdownProcessor
 * Tests the markdown processor that enhances todo items with task badges
 * Ported from old-stuff to new architecture using Playwright
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  readVaultFile,
  createFile,
  expectNotice,
} from "../../helpers/global";

test.describe("TaskTodoMarkdownProcessor", () => {
  test("should enhance todo items with task badges in reading mode", async ({
    page,
  }) => {
    // Create test tasks with different properties
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Create first task - High Priority Bug
    await page.fill('[data-testid="property-title"]', "High Priority Bug");
    await page.fill(
      '[data-testid="template-content-textarea"]',
      "Critical bug that needs immediate attention"
    );
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    // Create second task - Feature Request
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    await page.fill('[data-testid="property-title"]', "Feature Request");
    await page.fill(
      '[data-testid="template-content-textarea"]',
      "New feature to implement"
    );
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    // Create third task - Completed Task
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    await page.fill('[data-testid="property-title"]', "Completed Task");
    await page.fill(
      '[data-testid="template-content-textarea"]',
      "Task that is already done"
    );
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    // Wait for all task files to be created
    await waitForFileCreation(page, "Tasks/High Priority Bug.md");
    await waitForFileCreation(page, "Tasks/Feature Request.md");
    await waitForFileCreation(page, "Tasks/Completed Task.md");

    // Create a markdown file with todo items linking to these tasks
    const markdownContent = `# Test Todo Items

## Basic Todo Items
- [ ] [[High Priority Bug]] - Should show high priority and bug badges
- [ ] [[Feature Request]] - Should show medium priority and feature badges
- [x] [[Completed Task]] - Should show completed status badge

## Mixed Content
- [ ] Regular todo without task link
- [ ] Todo with [[High Priority Bug]] link in middle of text
- [x] Another completed item with [[Feature Request]] reference

## Non-todo items
- Regular list item with [[High Priority Bug]] link (should not get badges)
- Another regular item

## Nested Lists
- [ ] Parent todo with [[Feature Request]]
  - [ ] Child todo with [[High Priority Bug]]
  - [x] Completed child with [[Completed Task]]
`;

    const testFilePath = "Test Todo Items.md";
    await createFile(page, testFilePath, {}, markdownContent);

    // Open the test file in reading mode
    await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        // Switch to reading mode by setting the view state
        await leaf.setViewState({
          type: "markdown",
          state: { file: filePath, mode: "preview" },
        });
      }
    }, testFilePath);

    // Wait for the file to be rendered in reading mode by waiting for the first badge to appear
    await page.waitForSelector(".task-sync-todo-badges");

    // Check that badges are added to todo items with task links
    const todoWithBadges = page.locator(".task-sync-todo-badges");
    const badgeCount = await todoWithBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // Check for status badge presence (status has default value "Backlog")
    const statusBadge = page.locator(".task-sync-todo-status-badge");
    await expect(statusBadge.first()).toBeVisible();

    // Verify that multiple todo items have badges (should be at least 3 from our test data)
    expect(badgeCount).toBeGreaterThanOrEqual(3);

    // Verify that regular list items with task links also get badges (this is the expected behavior)
    const regularListItem = page.locator(
      'li:has(a[href*="High Priority Bug"]):not(:has(input[type="checkbox"]))'
    );
    const regularItemBadges = regularListItem.locator(".task-sync-todo-badges");
    await expect(regularItemBadges.first()).toBeVisible();
  });

  test("should handle nested todo items with task links", async ({ page }) => {
    // Create a simple task for testing
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    await page.fill('[data-testid="property-title"]', "Nested Task Test");
    await page.fill(
      '[data-testid="template-content-textarea"]',
      "Task for nested list testing"
    );

    // Submit with defaults
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    await waitForFileCreation(page, "Tasks/Nested Task Test.md");

    // Create markdown with nested todo items
    const nestedMarkdownContent = `# Nested Todo Test

- [ ] Parent todo item
  - [ ] Child todo with [[Nested Task Test]] link
    - [ ] Grandchild todo with [[Nested Task Test]] reference
  - [x] Completed child todo with [[Nested Task Test]]
- [ ] Another parent with [[Nested Task Test]]
`;

    const nestedTestFilePath = "Nested Todo Test.md";
    await createFile(page, nestedTestFilePath, {}, nestedMarkdownContent);

    // Open the file in reading mode
    await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        await leaf.setViewState({
          type: "markdown",
          state: { file: filePath, mode: "preview" },
        });
      }
    }, nestedTestFilePath);

    // Wait for the preview to render by waiting for nested todo badges to appear
    await page.waitForSelector(
      'li:has(a[href*="Nested Task Test"]) .task-sync-todo-badges'
    );

    // Check that nested todo items also get badges
    const nestedTodoBadges = page.locator(
      'li:has(a[href*="Nested Task Test"]) .task-sync-todo-badges'
    );
    await expect(nestedTodoBadges.first()).toBeVisible();

    // Verify multiple nested items have badges
    const allBadgedItems = page.locator(
      'li:has(a[href*="Nested Task Test"]) .task-sync-todo-badges'
    );
    const badgeCount = await allBadgedItems.count();
    expect(badgeCount).toBeGreaterThan(1);
  });

  test("should not add badges to non-task links", async ({ page }) => {
    // Create a regular markdown file (not a task)
    const regularContent = `# Regular Note

This is just a regular note with some content.
`;

    const regularFilePath = "Regular Note.md";
    await createFile(page, regularFilePath, {}, regularContent);

    // Create markdown with todo items linking to the regular note
    const todoContent = `# Todo Items with Regular Links

- [ ] Todo item with [[Regular Note]] link
- [x] Completed todo with [[Regular Note]] reference
- Regular list item with [[Regular Note]] link
`;

    const todoFilePath = "Todo with Regular Links.md";
    await createFile(page, todoFilePath, {}, todoContent);

    // Open the todo file in reading mode
    await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        await leaf.setViewState({
          type: "markdown",
          state: { file: filePath, mode: "preview" },
        });
      }
    }, todoFilePath);

    // Wait for the preview to render by waiting for the heading to appear
    await page.waitForSelector('h1:has-text("Todo Items with Regular Links")');

    // Verify that no badges are added for non-task links
    const badges = page.locator(".task-sync-todo-badges");
    await expect(badges).not.toBeVisible();

    // Verify that no task mention indicators are added
    const mentionIndicators = page.locator(".task-sync-mention-indicator");
    await expect(mentionIndicators).not.toBeVisible();
  });
});
