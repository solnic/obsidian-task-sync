/**
 * End-to-end tests for todo promotion functionality
 * Ported from old-stuff/specs-old/vitest/todo-promotion.e2e.ts
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  getFileContent,
  fileExists,
  openFile,
  waitForFileContentToContain,
} from "../../helpers/global";
import { createArea, createProject } from "../../helpers/entity-helpers";
import { goToLine } from "../../helpers/editor";

test.describe("Todo Promotion", () => {
  test("should promote incomplete todo to task", async ({ page }) => {
    await createArea(page, {
      name: "Personal",
      description: "- [ ] Buy groceries for the week",
    });

    await openFile(page, "Areas/Personal.md");
    await goToLine(page, "Buy groceries for the week");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Buy groceries for the week.md",
      "Buy groceries for the week"
    );

    const updatedContent = await getFileContent(page, "Areas/Personal.md");
    expect(updatedContent).toContain("[[Buy groceries for the week]]");
    expect(updatedContent).not.toContain("- [ ] Buy groceries for the week");
  });

  test("should promote completed todo to task", async ({ page }) => {
    await createProject(page, {
      name: "Documentation",
      description: "- [x] Finish the documentation",
    });

    await openFile(page, "Projects/Documentation.md");
    await goToLine(page, "Finish the documentation");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Finish the documentation.md",
      "Finish the documentation"
    );

    const updatedContent = await getFileContent(
      page,
      "Projects/Documentation.md"
    );
    expect(updatedContent).toContain("[x] [[Finish the documentation]]");
    expect(updatedContent).not.toContain("- [x] Finish the documentation");
  });

  test("should handle indented todo items", async ({ page }) => {
    await createArea(page, {
      name: "Work",
      description: "  - [ ] Nested todo item",
    });

    await openFile(page, "Areas/Work.md");
    await goToLine(page, "Nested todo item");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Nested todo item.md",
      "Nested todo item"
    );

    const updatedContent = await getFileContent(page, "Areas/Work.md");
    expect(updatedContent).toContain("  - [ ] [[Nested todo item]]");
    expect(updatedContent).not.toContain("  - [ ] Nested todo item");
  });

  test("should show notice when no todo found", async ({ page }) => {
    // Use unique name to avoid conflicts with other tests
    const uniqueAreaName = `TestArea-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    await createArea(page, {
      name: uniqueAreaName,
      description: "This is just regular text.",
    });

    await openFile(page, `Areas/${uniqueAreaName}.md`);
    await goToLine(page, "This is just regular text");

    await executeCommand(page, "Promote Todo to Task");

    // Verify no task was created for regular text
    const taskExists = await fileExists(
      page,
      "Tasks/This is just regular text.md"
    );
    expect(taskExists).toBe(false);
  });

  test("should work with different list markers", async ({ page }) => {
    await createArea(page, {
      name: "Mixed",
      description: "* [ ] Asterisk todo item",
    });

    await openFile(page, "Areas/Mixed.md");
    await goToLine(page, "Asterisk todo item");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Asterisk todo item.md",
      "Asterisk todo item"
    );

    const updatedContent = await getFileContent(page, "Areas/Mixed.md");
    expect(updatedContent).toContain("* [ ] [[Asterisk todo item]]");
    expect(updatedContent).not.toContain("* [ ] Asterisk todo item");
  });

  test("should set context properties correctly when promoting todo in area", async ({
    page,
  }) => {
    // Use unique name to avoid conflicts with other tests
    const uniqueAreaName = `WorkArea-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    await createArea(page, {
      name: uniqueAreaName,
      description: "- [ ] Task with area context",
    });

    await openFile(page, `Areas/${uniqueAreaName}.md`);
    await goToLine(page, "Task with area context");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Task with area context.md",
      "Task with area context"
    );

    const taskContent = await getFileContent(
      page,
      "Tasks/Task with area context.md"
    );
    expect(taskContent).toContain("Areas:");
    expect(taskContent).toContain(uniqueAreaName);
  });

  test("should promote sub-todo with parent task set", async ({ page }) => {
    await createArea(page, {
      name: "Parent-Child",
      description: `- [ ] Parent task item
  - [ ] Child todo item`,
    });

    await openFile(page, "Areas/Parent-Child.md");
    await goToLine(page, "Parent task item");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Parent task item.md",
      "Parent task item"
    );

    await openFile(page, "Areas/Parent-Child.md");
    await goToLine(page, "Child todo item");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Child todo item.md",
      "Child todo item"
    );

    const childTaskContent = await getFileContent(
      page,
      "Tasks/Child todo item.md"
    );
    expect(childTaskContent).toContain('Parent task: "[[Parent task item]]"');
  });

  test("should sync completion status between promoted todo and task", async ({
    page,
  }) => {
    await createArea(page, {
      name: "Sync-Test",
      description: "- [ ] Task to be completed",
    });

    await openFile(page, "Areas/Sync-Test.md");
    await goToLine(page, "Task to be completed");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Task to be completed.md",
      "Task to be completed"
    );

    const contentAfterPromotion = await getFileContent(
      page,
      "Areas/Sync-Test.md"
    );
    expect(contentAfterPromotion).toContain("- [ ] [[Task to be completed]]");

    // Mark the todo as completed by directly modifying the file content
    await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("Areas/Sync-Test.md");
      const content = await app.vault.read(file);
      const updatedContent = content.replace(
        "- [ ] [[Task to be completed]]",
        "- [x] [[Task to be completed]]"
      );
      await app.vault.adapter.write("Areas/Sync-Test.md", updatedContent);
    });

    // Wait for the task file to be updated
    await waitForFileContentToContain(
      page,
      "Tasks/Task to be completed.md",
      "Done: true"
    );

    const taskContent = await getFileContent(
      page,
      "Tasks/Task to be completed.md"
    );
    expect(taskContent).toContain("Done: true");

    const contentAfterCheck = await getFileContent(page, "Areas/Sync-Test.md");
    expect(contentAfterCheck).toContain("- [x] [[Task to be completed]]");
  });

  test("should set context properties correctly when promoting todo in project", async ({
    page,
  }) => {
    await createProject(page, {
      name: "Website Redesign",
      description: "- [ ] Task with project context",
    });

    await openFile(page, "Projects/Website Redesign.md");
    await goToLine(page, "Task with project context");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Task with project context.md",
      "Task with project context"
    );

    const taskContent = await getFileContent(
      page,
      "Tasks/Task with project context.md"
    );
    expect(taskContent).toContain("Project:");
    expect(taskContent).toContain("Website Redesign");
  });
});
