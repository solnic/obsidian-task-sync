/**
 * E2E tests for todo promotion reverting functionality
 * Tests that reverting works with any promoted todo under cursor
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  getFileContent,
  fileExists,
  createTestFolders,
  executeCommand,
  openFile,
} from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Todo Promotion Reverting", () => {
  const context = setupE2ETestHooks();

  test("should revert promoted todo under cursor", async () => {
    await createTestFolders(context.page);

    // Create a test file with multiple todos
    const noteContent = `# Test Note

- [ ] First todo item
- [ ] Second todo item
- [ ] Third todo item`;

    await context.page.evaluate(async (content) => {
      await window.app.vault.create("Areas/Revert Test.md", content);
    }, noteContent);

    await openFile(context, "Areas/Revert Test.md");

    // Promote the second todo
    await context.page.keyboard.press("Control+Home"); // Go to beginning
    await context.page.keyboard.press("ArrowDown"); // Move to line 1 (empty)
    await context.page.keyboard.press("ArrowDown"); // Move to line 2 (first todo)
    await context.page.keyboard.press("ArrowDown"); // Move to line 3 (second todo)

    // Promote the second todo
    await executeCommand(context, "Task Sync: Promote todo to task");
    await context.page.waitForTimeout(2000);

    // Verify the task file was created
    const taskExists = await fileExists(
      context.page,
      "Tasks/Second todo item.md"
    );
    expect(taskExists).toBe(true);

    // Verify the original file was updated
    let updatedContent = await getFileContent(
      context.page,
      "Areas/Revert Test.md"
    );
    expect(updatedContent).toContain("[[Second todo item]]");
    expect(updatedContent).not.toContain("- [ ] Second todo item");

    // Now revert the promoted todo by placing cursor on the promoted line
    await context.page.keyboard.press("Control+Home"); // Go to beginning
    await context.page.keyboard.press("ArrowDown"); // Move to line 1 (empty)
    await context.page.keyboard.press("ArrowDown"); // Move to line 2 (first todo)
    await context.page.keyboard.press("ArrowDown"); // Move to line 3 (promoted second todo)

    // Execute the revert command
    await executeCommand(context, "Task Sync: Revert Promoted Todo");
    await context.page.waitForTimeout(2000);

    // Verify the task file was deleted
    const taskExistsAfterRevert = await fileExists(
      context.page,
      "Tasks/Second todo item.md"
    );
    expect(taskExistsAfterRevert).toBe(false);

    // Verify the original todo was restored
    const revertedContent = await getFileContent(
      context.page,
      "Areas/Revert Test.md"
    );
    expect(revertedContent).toContain("- [ ] Second todo item");
    expect(revertedContent).not.toContain("[[Second todo item]]");

    // Verify other todos are unchanged
    expect(revertedContent).toContain("- [ ] First todo item");
    expect(revertedContent).toContain("- [ ] Third todo item");
  });

  test("should revert completed promoted todo under cursor", async () => {
    await createTestFolders(context.page);

    // Create a test file with a completed todo
    const noteContent = `# Test Note

- [x] Completed todo item
- [ ] Regular todo item`;

    await context.page.evaluate(async (content) => {
      await window.app.vault.create("Areas/Completed Revert Test.md", content);
    }, noteContent);

    await openFile(context, "Areas/Completed Revert Test.md");

    // Promote the completed todo
    await context.page.keyboard.press("Control+Home"); // Go to beginning
    await context.page.keyboard.press("ArrowDown"); // Move to line 1 (empty)
    await context.page.keyboard.press("ArrowDown"); // Move to line 2 (completed todo)

    // Promote the completed todo
    await executeCommand(context, "Task Sync: Promote todo to task");
    await context.page.waitForTimeout(2000);

    // Verify the task file was created
    const taskExists = await fileExists(
      context.page,
      "Tasks/Completed todo item.md"
    );
    expect(taskExists).toBe(true);

    // Verify the original file was updated (should preserve [x] checkbox)
    let updatedContent = await getFileContent(
      context.page,
      "Areas/Completed Revert Test.md"
    );
    expect(updatedContent).toContain("- [x] [[Completed todo item]]");

    // Now revert the promoted todo
    await context.page.keyboard.press("Control+Home"); // Go to beginning
    await context.page.keyboard.press("ArrowDown"); // Move to line 1 (empty)
    await context.page.keyboard.press("ArrowDown"); // Move to line 2 (promoted completed todo)

    // Execute the revert command
    await executeCommand(context, "Task Sync: Revert Promoted Todo");
    await context.page.waitForTimeout(2000);

    // Verify the task file was deleted
    const taskExistsAfterRevert = await fileExists(
      context.page,
      "Tasks/Completed todo item.md"
    );
    expect(taskExistsAfterRevert).toBe(false);

    // Verify the original completed todo was restored
    const revertedContent = await getFileContent(
      context.page,
      "Areas/Completed Revert Test.md"
    );
    expect(revertedContent).toContain("- [x] Completed todo item");
    expect(revertedContent).not.toContain("[[Completed todo item]]");

    // Verify other todos are unchanged
    expect(revertedContent).toContain("- [ ] Regular todo item");
  });

  test("should show error when trying to revert non-promoted todo", async () => {
    await createTestFolders(context.page);

    // Create a test file with a regular todo (not promoted)
    const noteContent = `# Test Note

- [ ] Regular todo item`;

    await context.page.evaluate(async (content) => {
      await window.app.vault.create("Areas/Error Test.md", content);
    }, noteContent);

    await openFile(context, "Areas/Error Test.md");

    // Position cursor on the regular todo
    await context.page.keyboard.press("Control+Home"); // Go to beginning
    await context.page.keyboard.press("ArrowDown"); // Move to line 1 (empty)
    await context.page.keyboard.press("ArrowDown"); // Move to line 2 (regular todo)

    // Try to execute the revert command
    await executeCommand(context, "Task Sync: Revert Promoted Todo");
    await context.page.waitForTimeout(1000);

    // Check for error notice
    const notices = await context.page.evaluate(() => {
      const noticeElements = document.querySelectorAll(".notice");
      return Array.from(noticeElements).map((el) => el.textContent);
    });

    expect(
      notices.some((notice) =>
        notice?.includes("No promoted todo found under cursor")
      )
    ).toBe(true);

    // Verify the file content is unchanged
    const content = await getFileContent(context.page, "Areas/Error Test.md");
    expect(content).toContain("- [ ] Regular todo item");
  });
});
