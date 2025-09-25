/**
 * End-to-End Tests for TaskTodoMarkdownProcessor
 * Tests the markdown processor that enhances todo items with task badges
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import { createTestFolders } from "../../helpers/global";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import { createTask } from "../../helpers/entity-helpers";

describe("TaskTodoMarkdownProcessor", () => {
  const context = setupE2ETestHooks();

  test("should enhance todo items with task badges in reading mode", async () => {
    // Create test tasks with different properties
    await createTask(context.page, {
      title: "High Priority Bug",
      category: "Bug",
      priority: "High",
      status: "In Progress",
      done: false,
    });

    await createTask(context.page, {
      title: "Feature Request",
      category: "Feature",
      priority: "Medium",
      status: "Backlog",
      done: false,
    });

    await createTask(context.page, {
      title: "Completed Task",
      category: "Task",
      priority: "Low",
      status: "Done",
      done: true,
    });

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

## Nested Lists
- [ ] Parent item
  - [ ] [[High Priority Bug]] - Nested task link
  - [ ] Regular nested item
  - [x] [[Completed Task]] - Nested completed task
`;

    // Create the test markdown file
    await context.page.evaluate(async (content) => {
      const app = (window as any).app;
      await app.vault.create("test-markdown-processor.md", content);
    }, markdownContent);

    // Wait for file creation
    await context.page.waitForTimeout(500);

    // Open the file in reading mode
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "test-markdown-processor.md"
      );
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        // Switch to reading mode
        await leaf.setViewState({
          type: "markdown",
          state: { mode: "preview", file: file.path },
        });
      }
    });

    // Wait for markdown processing
    await context.page.waitForTimeout(1000);

    // Check that badges are added to todo items with task links
    const todoItemsWithBadges = await context.page
      .locator(".task-sync-todo-badges")
      .count();
    expect(todoItemsWithBadges).toBeGreaterThan(0);

    // Check for specific badge types
    const categoryBadges = await context.page
      .locator(".task-sync-todo-category-badge")
      .count();
    const priorityBadges = await context.page
      .locator(".task-sync-todo-priority-badge")
      .count();
    const statusBadges = await context.page
      .locator(".task-sync-todo-status-badge")
      .count();

    expect(categoryBadges).toBeGreaterThan(0);
    expect(priorityBadges).toBeGreaterThan(0);
    expect(statusBadges).toBeGreaterThan(0);

    // Verify specific badge content by checking for badge containers and text content
    const bugBadgeExists = await context.page.evaluate(() => {
      const badges = document.querySelectorAll(
        ".task-sync-todo-category-badge"
      );
      return Array.from(badges).some((badge) =>
        badge.textContent?.includes("Bug")
      );
    });
    expect(bugBadgeExists).toBe(true);

    const highPriorityBadgeExists = await context.page.evaluate(() => {
      const badges = document.querySelectorAll(
        ".task-sync-todo-priority-badge"
      );
      return Array.from(badges).some((badge) =>
        badge.textContent?.includes("High")
      );
    });
    expect(highPriorityBadgeExists).toBe(true);

    const featureBadgeExists = await context.page.evaluate(() => {
      const badges = document.querySelectorAll(
        ".task-sync-todo-category-badge"
      );
      return Array.from(badges).some((badge) =>
        badge.textContent?.includes("Feature")
      );
    });
    expect(featureBadgeExists).toBe(true);
  });

  test("should not add badges to todo items without task links", async () => {
    const markdownContent = `# Regular Todo Items

- [ ] Regular todo item without links
- [x] Completed regular todo
- [ ] Todo with [[Non-existent Task]] link
- [ ] Todo with external [link](https://example.com)
`;

    await context.page.evaluate(async (content) => {
      const app = (window as any).app;
      await app.vault.create("regular-todos.md", content);
    }, markdownContent);

    await context.page.waitForTimeout(500);

    // Open in reading mode
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("regular-todos.md");
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        await leaf.setViewState({
          type: "markdown",
          state: { mode: "preview", file: file.path },
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Should not have any badges for non-task links
    const badgeCount = await context.page
      .locator(".task-sync-todo-badges")
      .count();
    expect(badgeCount).toBe(0);
  });

  test("should handle nested todo items correctly", async () => {
    await createTask(context.page, {
      title: "Nested Task",
      category: "Feature",
      priority: "High",
      status: "In Progress",
    });

    const markdownContent = `# Nested Todo Structure

- [ ] Parent task
  - [ ] [[Nested Task]] - Should have badges
  - [ ] Regular nested item
  - [ ] Another level
    - [x] [[Nested Task]] - Deep nested with badges
`;

    await context.page.evaluate(async (content) => {
      const app = (window as any).app;
      await app.vault.create("nested-todos.md", content);
    }, markdownContent);

    await context.page.waitForTimeout(500);

    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("nested-todos.md");
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        await leaf.setViewState({
          type: "markdown",
          state: { mode: "preview", file: file.path },
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Should find badges in nested items
    const badgeContainers = await context.page
      .locator(".task-sync-todo-badges")
      .count();
    expect(badgeContainers).toBeGreaterThanOrEqual(2); // Two nested task references

    // Verify nested badges are properly positioned
    const nestedTaskBadgesExist = await context.page.evaluate(() => {
      const listItems = document.querySelectorAll("li");
      return Array.from(listItems).some(
        (li) =>
          li.textContent?.includes("Nested Task") &&
          li.querySelector(".task-sync-todo-badges")
      );
    });
    expect(nestedTaskBadgesExist).toBe(true);
  });

  test("should display correct badges for different task properties", async () => {
    // Create tasks with different properties to test badge rendering
    await createTask(context.page, {
      title: "Bug Task",
      category: "Bug",
      priority: "High",
      status: "In Progress",
    });

    await createTask(context.page, {
      title: "Feature Task",
      category: "Feature",
      priority: "Medium",
      status: "Backlog",
    });

    const markdownContent = `# Task Properties Test

- [ ] [[Bug Task]] - Should show bug category and high priority
- [ ] [[Feature Task]] - Should show feature category and medium priority
`;

    await context.page.evaluate(async (content) => {
      const app = (window as any).app;
      await app.vault.create("properties-test.md", content);
    }, markdownContent);

    await context.page.waitForTimeout(500);

    // Open in reading mode
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("properties-test.md");
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        await leaf.setViewState({
          type: "markdown",
          state: { mode: "preview", file: file.path },
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Verify bug task badges
    const bugBadgeExists = await context.page.evaluate(() => {
      const badges = document.querySelectorAll(
        ".task-sync-todo-category-badge"
      );
      return Array.from(badges).some((badge) =>
        badge.textContent?.includes("Bug")
      );
    });
    expect(bugBadgeExists).toBe(true);

    const highPriorityBadgeExists = await context.page.evaluate(() => {
      const badges = document.querySelectorAll(
        ".task-sync-todo-priority-badge"
      );
      return Array.from(badges).some((badge) =>
        badge.textContent?.includes("High")
      );
    });
    expect(highPriorityBadgeExists).toBe(true);

    // Verify feature task badges
    const featureBadgeExists = await context.page.evaluate(() => {
      const badges = document.querySelectorAll(
        ".task-sync-todo-category-badge"
      );
      return Array.from(badges).some((badge) =>
        badge.textContent?.includes("Feature")
      );
    });
    expect(featureBadgeExists).toBe(true);

    const mediumPriorityBadgeExists = await context.page.evaluate(() => {
      const badges = document.querySelectorAll(
        ".task-sync-todo-priority-badge"
      );
      return Array.from(badges).some((badge) =>
        badge.textContent?.includes("Medium")
      );
    });
    expect(mediumPriorityBadgeExists).toBe(true);
  });

  test("should handle tasks with missing properties gracefully", async () => {
    // Create task with minimal properties
    await createTask(context.page, {
      title: "Minimal Task",
      // Only title, no category/priority/status
    });

    const markdownContent = `# Minimal Task Test

- [ ] [[Minimal Task]] - Should handle missing properties
`;

    await context.page.evaluate(async (content) => {
      const app = (window as any).app;
      await app.vault.create("minimal-task-test.md", content);
    }, markdownContent);

    await context.page.waitForTimeout(500);

    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("minimal-task-test.md");
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        await leaf.setViewState({
          type: "markdown",
          state: { mode: "preview", file: file.path },
        });
      }
    });

    await context.page.waitForTimeout(1000);

    // Should still process the item but may have fewer badges
    const todoItemExists = await context.page.evaluate(() => {
      const listItems = document.querySelectorAll("li");
      return Array.from(listItems).some((li) =>
        li.textContent?.includes("Minimal Task")
      );
    });
    expect(todoItemExists).toBe(true);

    // Should not crash or cause errors
    const errorMessages = await context.page.locator(".notice-error").count();
    expect(errorMessages).toBe(0);
  });
});
