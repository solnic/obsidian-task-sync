/**
 * E2E tests for todo promotion parent-child relationship functionality
 * Tests that when promoting a parent todo, existing child tasks get their Parent Task property updated
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  getFileContent,
  fileExists,
  executeCommand,
  openFile,
} from "../../helpers/global";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";

describe("Todo Promotion Parent-Child Relationships", () => {
  const context = setupE2ETestHooks();

  test("should update child task parent when promoting parent todo", async () => {
    // Create a note with parent and child todos
    const noteContent = `# Test Note

- [ ] Parent todo item
  - [ ] Child todo item
  - [ ] Another child todo`;

    await context.page.evaluate(async (content) => {
      await window.app.vault.create("Areas/Parent-Child Test.md", content);
    }, noteContent);
    await openFile(context.page, "Areas/Parent-Child Test.md");

    // First, promote the parent todo (required before child can be promoted)
    // Position cursor on the parent todo line (line 2, 0-indexed)
    await context.page.keyboard.press("Control+Home"); // Go to beginning
    await context.page.keyboard.press("ArrowDown"); // Move to line 1 (empty)
    await context.page.keyboard.press("ArrowDown"); // Move to line 2 (parent todo)

    // Promote the parent todo
    await executeCommand(context.page, "Task Sync: Promote todo to task");

    // Wait for parent task creation to complete
    await context.page.waitForTimeout(1000);

    // Verify the parent task was created
    const parentTaskExists = await fileExists(
      context.page,
      "Tasks/Parent todo item.md"
    );
    expect(parentTaskExists).toBe(true);

    // Debug: Check file content after parent promotion
    const fileContentAfterParent = await getFileContent(
      context.page,
      "Areas/Parent-Child Test.md"
    );
    console.log("File content after parent promotion:", fileContentAfterParent);

    // Now promote the child todo (this should work since parent exists)
    // Position cursor on the child todo line by going to the beginning and navigating to the child line
    await context.page.keyboard.press("Control+Home"); // Go to beginning
    await context.page.keyboard.press("ArrowDown"); // Move to line 1 (empty)
    await context.page.keyboard.press("ArrowDown"); // Move to line 2 (parent todo - now a link)
    await context.page.keyboard.press("ArrowDown"); // Move to line 3 (child todo)

    // Promote the child todo
    await executeCommand(context.page, "Task Sync: Promote todo to task");

    // Wait for child task creation to complete
    await context.page.waitForTimeout(2000);

    // Check if there are any notices displayed (which might indicate an error)
    const notices = await context.page.evaluate(() => {
      const noticeElements = document.querySelectorAll(".notice");
      return Array.from(noticeElements).map((el) => el.textContent);
    });
    if (notices.length > 0) {
      console.log("Notices displayed:", notices);
    }

    // Verify the child task was created
    const childTaskExists = await fileExists(
      context.page,
      "Tasks/Child todo item.md"
    );
    expect(childTaskExists).toBe(true);

    // Check that the child task now has the parent task set
    const childTaskContent = await getFileContent(
      context.page,
      "Tasks/Child todo item.md"
    );

    expect(childTaskContent).toContain(
      'Parent task: "[[Tasks/Parent todo item|Parent todo item]]"'
    );
  });
});
