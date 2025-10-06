/**
 * E2E tests for todo promotion reverting functionality
 * Ported from old-stuff/specs-old/vitest/todo-promotion-revert.e2e.ts
 */

import { test, expect } from "../../helpers/setup";
import {
  getFileContent,
  executeCommand,
  openFile,
  waitForFileContentToContain,
} from "../../helpers/global";
import {
  createArea,
  getTaskByTitle,
  waitForTaskToBeRemoved,
} from "../../helpers/entity-helpers";

test.describe("Todo Promotion Reverting", () => {
  test("should revert promoted todo under cursor", async ({ page }) => {
    const todos = [
      "- [ ] First todo item",
      "- [ ] Second todo item",
      "- [ ] Third todo item",
    ];

    const noteContent = todos.join("\n");

    await createArea(page, { name: "Revert Test", description: noteContent });
    await openFile(page, "Areas/Revert Test.md");

    await page.keyboard.press("Control+Home"); // Go to beginning
    await page.keyboard.press("ArrowDown"); // Move to line 1 (first todo)
    await page.keyboard.press("ArrowDown"); // Move to line 2 (second todo)

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Second todo item.md",
      "Second todo item"
    );

    await openFile(page, "Areas/Revert Test.md");

    let updatedContent = await getFileContent(page, "Areas/Revert Test.md");
    expect(updatedContent).toContain("[[Second todo item]]");

    await page.keyboard.press("Control+Home"); // Go to beginning
    await page.keyboard.press("ArrowDown"); // Move to line 1 (first todo)
    await page.keyboard.press("ArrowDown"); // Move to line 2 (second todo)

    await executeCommand(page, "Revert Promoted Todo");

    await waitForFileContentToContain(
      page,
      "Areas/Revert Test.md",
      "- [ ] Second todo item"
    );

    // Wait for the task to be removed from the store
    await waitForTaskToBeRemoved(page, "Second todo item");

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

    await page.keyboard.press("Control+Home"); // Go to beginning
    await page.keyboard.press("ArrowDown"); // Move to line 1 (first todo)
    await page.keyboard.press("ArrowDown"); // Move to line 2 (second todo)

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Second todo item.md",
      "Second todo item"
    );

    const secondTask = await getTaskByTitle(page, "Second todo item");

    expect(secondTask.done).toBe(true);

    await openFile(page, "Areas/Revert Test.md");

    let updatedContent = await getFileContent(page, "Areas/Revert Test.md");
    expect(updatedContent).toContain("[[Second todo item]]");

    await page.keyboard.press("Control+Home"); // Go to beginning
    await page.keyboard.press("ArrowDown"); // Move to line 1 (first todo)
    await page.keyboard.press("ArrowDown"); // Move to line 2 (second todo)

    await executeCommand(page, "Revert Promoted Todo");

    await waitForFileContentToContain(
      page,
      "Areas/Revert Test.md",
      "- [x] Second todo item"
    );

    // Wait for the task to be removed from the store
    await waitForTaskToBeRemoved(page, "Second todo item");

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

    // Position cursor on the regular todo
    await page.keyboard.press("Control+Home"); // Go to beginning
    await page.keyboard.press("ArrowDown"); // Move to line 1 (empty)
    await page.keyboard.press("ArrowDown"); // Move to line 2 (regular todo)

    // Try to execute the revert command
    await executeCommand(page, "Revert Promoted Todo");
    await page.waitForTimeout(1000);

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
