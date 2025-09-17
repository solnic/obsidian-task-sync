/**
 * End-to-end tests for todo promotion functionality
 */

import { test, expect, describe, beforeEach } from "vitest";
import {
  getFileContent,
  fileExists,
  createFullyQualifiedLink,
  executeCommand,
  openFile,
} from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Todo Promotion E2E", () => {
  const context = setupE2ETestHooks();

  test("should promote incomplete todo to task", async () => {
    // Create a simple test file with just a todo item
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Buy groceries for the week`;
      await app.vault.create("Areas/Personal.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Areas/Personal.md");

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press("Control+Home"); // Go to beginning of document
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(
      context.page,
      "Tasks/Buy groceries for the week.md"
    );
    expect(taskExists).toBe(true);

    // Verify the original file was updated
    const updatedContent = await getFileContent(
      context.page,
      "Areas/Personal.md"
    );
    expect(updatedContent).toContain("[[Buy groceries for the week]]");
    expect(updatedContent).not.toContain("- [ ] Buy groceries for the week");
  });

  test("should promote completed todo to task", async () => {
    // Create a simple test file with a completed todo item
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [x] Finish the documentation`;
      await app.vault.create("Projects/Documentation.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Projects/Documentation.md");

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press("Control+Home"); // Go to beginning of document
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(
      context.page,
      "Tasks/Finish the documentation.md"
    );
    expect(taskExists).toBe(true);

    // Verify the original file preserves completion state
    const updatedContent = await getFileContent(
      context.page,
      "Projects/Documentation.md"
    );
    expect(updatedContent).toContain("[x] [[Finish the documentation]]");
    expect(updatedContent).not.toContain("- [x] Finish the documentation");
  });

  test("should handle indented todo items", async () => {
    // Create a simple test file with an indented todo item
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `  - [ ] Nested todo item`;
      await app.vault.create("Areas/Work.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Areas/Work.md");

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press("Control+Home"); // Go to beginning of document
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(
      context.page,
      "Tasks/Nested todo item.md"
    );
    expect(taskExists).toBe(true);

    // Verify the original file preserves indentation and checkbox format
    const updatedContent = await getFileContent(context.page, "Areas/Work.md");
    expect(updatedContent).toContain("  - [ ] [[Nested todo item]]");
    expect(updatedContent).not.toContain("  - [ ] Nested todo item");
  });

  test("should show notice when no todo found", async () => {
    // Create a test file without todo items
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `This is just regular text.`;
      await app.vault.create("Areas/Test.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Areas/Test.md");

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press("Control+Home"); // Go to beginning of document
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(2000);

    // Verify no task was created for regular text
    const taskExists = await fileExists(
      context.page,
      "Tasks/This is just regular text.md"
    );
    expect(taskExists).toBe(false);
  });

  test("should work with different list markers", async () => {
    // Create a simple test file with asterisk todo item
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `* [ ] Asterisk todo item`;
      await app.vault.create("Areas/Mixed.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Areas/Mixed.md");

    // Position cursor on the todo line explicitly using keyboard navigation
    await context.page.keyboard.press("Control+Home"); // Go to beginning of document
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(3000);

    // Verify the task was created and original line updated
    const taskExists = await fileExists(
      context.page,
      "Tasks/Asterisk todo item.md"
    );
    expect(taskExists).toBe(true);

    const updatedContent = await getFileContent(context.page, "Areas/Mixed.md");
    expect(updatedContent).toContain("* [ ] [[Asterisk todo item]]");
    expect(updatedContent).not.toContain("* [ ] Asterisk todo item");
  });

  test("should set context properties correctly when promoting todo in area", async () => {
    // Create a test file in Areas folder
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Task with area context`;
      await app.vault.create("Areas/Work.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Areas/Work.md");

    // Position cursor
    await context.page.keyboard.press("Control+Home");
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(
      context.page,
      "Tasks/Task with area context.md"
    );
    expect(taskExists).toBe(true);

    // Verify the task has the correct area context in front-matter
    const taskContent = await getFileContent(
      context.page,
      "Tasks/Task with area context.md"
    );
    expect(taskContent).toContain("Areas:");
    expect(taskContent).toContain(
      `- "${createFullyQualifiedLink("Work", "Areas")}"`
    );
  });

  test("should set context properties correctly when promoting todo in project", async () => {
    // Create a test file in Projects folder
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Task with project context`;
      await app.vault.create("Projects/Website Redesign.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Projects/Website Redesign.md");

    // Position cursor
    await context.page.keyboard.press("Control+Home");
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(3000);

    // Verify the task file was created
    const taskExists = await fileExists(
      context.page,
      "Tasks/Task with project context.md"
    );
    expect(taskExists).toBe(true);

    // Verify the task has the correct project context in front-matter
    const taskContent = await getFileContent(
      context.page,
      "Tasks/Task with project context.md"
    );
    expect(taskContent).toContain(
      `Project: "${createFullyQualifiedLink("Website Redesign", "Projects")}"`
    );
  });

  test("should promote individual todo without auto-creating children", async () => {
    // Create a test file with nested todos
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Parent task with children
  - [ ] First child task
  - [ ] Second child task
  - [x] Completed child task`;
      await app.vault.create("Areas/Nested.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Areas/Nested.md");

    // Position cursor on parent todo
    await context.page.keyboard.press("Control+Home");
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(2000);

    // Verify only the parent task was created (no auto-creation of children)
    const parentExists = await fileExists(
      context.page,
      "Tasks/Parent task with children.md"
    );
    const child1Exists = await fileExists(
      context.page,
      "Tasks/First child task.md"
    );
    const child2Exists = await fileExists(
      context.page,
      "Tasks/Second child task.md"
    );
    const child3Exists = await fileExists(
      context.page,
      "Tasks/Completed child task.md"
    );

    expect(parentExists).toBe(true);
    expect(child1Exists).toBe(false); // Should not auto-create children
    expect(child2Exists).toBe(false);
    expect(child3Exists).toBe(false);

    // Verify the original file was updated with a link to the parent task only
    const updatedContent = await getFileContent(
      context.page,
      "Areas/Nested.md"
    );
    expect(updatedContent).toContain("- [ ] [[Parent task with children]]");
    expect(updatedContent).toContain("  - [ ] First child task"); // Children remain as todos
    expect(updatedContent).toContain("  - [ ] Second child task");
    expect(updatedContent).toContain("  - [x] Completed child task");
  });

  test("should not double-linkify already promoted parent todos", async () => {
    // Create a test file with nested todos
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Already promoted parent
  - [ ] Child to promote later`;
      await app.vault.create("Areas/DoubleLink.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Areas/DoubleLink.md");

    // Position cursor on parent todo
    await context.page.keyboard.press("Control+Home");
    await context.page.waitForTimeout(200);

    // First, promote the parent todo
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(3000);

    // Verify parent was promoted and line was linkified
    let updatedContent = await getFileContent(
      context.page,
      "Areas/DoubleLink.md"
    );
    expect(updatedContent).toContain("[[Already promoted parent]]");

    // Now position cursor on child todo and promote it
    await context.page.keyboard.press("ArrowDown"); // Move to child line
    await context.page.waitForTimeout(200);

    // Promote the child todo
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(3000);

    // Verify child was promoted
    const childExists = await fileExists(
      context.page,
      "Tasks/Child to promote later.md"
    );
    expect(childExists).toBe(true);

    // Verify parent line was NOT double-linkified
    updatedContent = await getFileContent(context.page, "Areas/DoubleLink.md");
    expect(updatedContent).toContain("[[Already promoted parent]]");
    expect(updatedContent).not.toContain("[[[[Already promoted parent]]]]");
    expect(updatedContent).toContain("[[Child to promote later]]");
  });

  test("should promote sub-todo without auto-creating parent", async () => {
    // Create a test file with nested todos
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const testContent = `- [ ] Main parent task
  - [ ] Sub-task to promote`;
      await app.vault.create("Areas/SubTask.md", testContent);
    });

    // Open the file using helper
    await openFile(context, "Areas/SubTask.md");

    // Position cursor on sub-todo
    await context.page.keyboard.press("Control+Home");
    await context.page.keyboard.press("ArrowDown"); // Move to sub-task line
    await context.page.waitForTimeout(200);

    // Execute the promote todo command
    await executeCommand(context, "Task Sync: Promote Todo to Task");
    await context.page.waitForTimeout(2000);

    // Verify only the sub-task was created (no auto-creation of parent)
    const parentExists = await fileExists(
      context.page,
      "Tasks/Main parent task.md"
    );
    const childExists = await fileExists(
      context.page,
      "Tasks/Sub-task to promote.md"
    );
    expect(parentExists).toBe(false); // Should not auto-create parent
    expect(childExists).toBe(true);

    // Verify the original file was updated with only the sub-task replaced
    const updatedContent = await getFileContent(
      context.page,
      "Areas/SubTask.md"
    );
    expect(updatedContent).toContain("- [ ] Main parent task"); // Parent remains as todo
    expect(updatedContent).toContain("  - [ ] [[Sub-task to promote]]"); // Sub-task becomes link
  });
});
