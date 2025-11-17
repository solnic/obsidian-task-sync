/**
 * E2E tests for todo promotion reverting functionality
 * Ported from old-stuff/specs-old/vitest/todo-promotion-revert.e2e.ts
 */

import { test, expect } from "../../helpers/setup";
import {
  getFileContent,
  executeCommand,
  openFile,
  waitForFileToContainText,
  goToLineNumber,
  promoteTodoAndWait,
} from "../../helpers/global";
import {
  createArea,
  getTaskByTitle,
  waitForTaskToBeRemoved,
} from "../../helpers/entity-helpers";

test.describe("Todo Promotion Reverting", { tag: '@todo-promotion' }, () => {
  test("should revert promoted todo under cursor", async ({ page }) => {
    const todos = [
      "- [ ] First todo item",
      "- [ ] Second todo item",
      "- [ ] Third todo item",
    ];

    const noteContent = todos.join("\n");

    await createArea(page, { name: "Revert Test", description: noteContent });
    await openFile(page, "Areas/Revert Test.md");

    await goToLineNumber(page, 2); // Position on second todo

    await promoteTodoAndWait(page, "Areas/Revert Test.md", "Second todo item");

    // Verify the area file was updated
    let updatedContent = await getFileContent(page, "Areas/Revert Test.md");
    expect(updatedContent).toContain("[[Second todo item]]");

    // Re-open the file to ensure clean state and position cursor
    await openFile(page, "Areas/Revert Test.md");
    await goToLineNumber(page, 2); // Position on the promoted link

    await executeCommand(page, "Revert Promoted Todo");

    // Wait for the task to be removed from the store
    await waitForTaskToBeRemoved(page, "Second todo item");

    // Verify the content was reverted
    const revertedContent = await getFileContent(page, "Areas/Revert Test.md");
    expect(revertedContent).toContain("- [ ] Second todo item");

    expect(await getTaskByTitle(page, "Second todo item")).toBeUndefined();
  });

  test("should revert completed promoted todo under cursor", async ({
    page,
  }) => {
    const todos = [
      "- [ ] First todo item",
      "- [x] Second todo item",
      "- [ ] Third todo item",
    ];

    const noteContent = todos.join("\n");

    await createArea(page, { name: "Revert Test", description: noteContent });
    await openFile(page, "Areas/Revert Test.md");

    await goToLineNumber(page, 2); // Position on second todo

    await promoteTodoAndWait(page, "Areas/Revert Test.md", "Second todo item");

    const secondTask = await getTaskByTitle(page, "Second todo item");
    expect(secondTask.done).toBe(true);

    // Verify the area file was updated
    let updatedContent = await getFileContent(page, "Areas/Revert Test.md");
    expect(updatedContent).toContain("[[Second todo item]]");

    // Re-open the file to ensure clean state and position cursor
    await openFile(page, "Areas/Revert Test.md");
    await goToLineNumber(page, 2); // Position on the promoted link

    await executeCommand(page, "Revert Promoted Todo");

    // Wait for the task to be removed from the store
    await waitForTaskToBeRemoved(page, "Second todo item");

    // Verify the content was reverted
    const revertedContent = await getFileContent(page, "Areas/Revert Test.md");
    expect(revertedContent).toContain("- [x] Second todo item");

    expect(await getTaskByTitle(page, "Second todo item")).toBeUndefined();
  });

  test("should show error when trying to revert non-promoted todo", async ({
    page,
  }) => {
    // Create a test file with a regular todo (not promoted)
    const noteContent = `# Test Note

- [ ] Regular todo item`;

    await page.evaluate(async (content: string) => {
      await (window as any).app.vault.create("Areas/Error Test.md", content);
    }, noteContent);

    await openFile(page, "Areas/Error Test.md");

    await goToLineNumber(page, 2); // Position on the regular todo

    // Try to execute the revert command
    await executeCommand(page, "Revert Promoted Todo");

    // Wait for error notice to appear
    await page.waitForSelector(".notice", { timeout: 2500 });

    // Check for error notice
    const notices = await page.evaluate(() => {
      const noticeElements = document.querySelectorAll(".notice");
      return Array.from(noticeElements).map((el) => el.textContent);
    });

    expect(
      notices.some((notice: string | null) =>
        notice?.includes("No promoted todo found under cursor")
      )
    ).toBe(true);

    // Verify the file content is unchanged
    const content = await getFileContent(page, "Areas/Error Test.md");
    expect(content).toContain("- [ ] Regular todo item");
  });
});
