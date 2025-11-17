/**
 * E2E tests for todo promotion parent-child relationship functionality
 * Ported from old-stuff/specs-old/vitest/todo-promotion-parent-child.e2e.ts
 */

import { test, expect } from "../../helpers/setup";
import {
  getFileContent,
  fileExists,
  executeCommand,
  openFile,
  waitForFileContentToContain,
} from "../../helpers/global";
import { createTask, createArea } from "../../helpers/entity-helpers";
import { goToLine } from "../../helpers/editor";

test.describe("Todo Promotion Parent-Child Hierarchy", { tag: '@todo-promotion' }, () => {
  test("should promote individual todo without auto-creating children", async ({
    page,
  }) => {
    await createArea(page, {
      name: "Nested",
      description: `- [ ] Parent task with children
  - [ ] First child task
  - [ ] Second child task
  - [x] Completed child task`,
    });

    await openFile(page, "Areas/Nested.md");
    await goToLine(page, "Parent task with children");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Parent task with children.md",
      "Parent task with children"
    );

    // Verify only the parent task was created (no auto-creation of children)
    const child1Exists = await fileExists(page, "Tasks/First child task.md");
    const child2Exists = await fileExists(page, "Tasks/Second child task.md");
    const child3Exists = await fileExists(
      page,
      "Tasks/Completed child task.md"
    );

    expect(child1Exists).toBe(false); // Should not auto-create children
    expect(child2Exists).toBe(false);
    expect(child3Exists).toBe(false);

    // Verify the original file was updated with a link to the parent task only
    const updatedContent = await getFileContent(page, "Areas/Nested.md");
    expect(updatedContent).toContain("- [ ] [[Parent task with children]]");
    expect(updatedContent).toContain("  - [ ] First child task"); // Children remain as todos
    expect(updatedContent).toContain("  - [ ] Second child task");
    expect(updatedContent).toContain("  - [x] Completed child task");
  });

  test("should promote sub-todo without auto-creating parent", async ({
    page,
  }) => {
    await createArea(page, {
      name: "SubTask",
      description: `- [ ] Main parent task
  - [ ] Sub-task to promote`,
    });

    await openFile(page, "Areas/SubTask.md");
    await goToLine(page, "Sub-task to promote");

    await executeCommand(page, "Promote Todo to Task");

    await waitForFileContentToContain(
      page,
      "Tasks/Sub-task to promote.md",
      "Sub-task to promote"
    );

    // Verify only the sub-task was created (no auto-creation of parent)
    const parentExists = await fileExists(page, "Tasks/Main parent task.md");
    expect(parentExists).toBe(false); // Should not auto-create parent

    // Verify the original file was updated with only the sub-task replaced
    const updatedContent = await getFileContent(page, "Areas/SubTask.md");
    expect(updatedContent).toContain("- [ ] Main parent task"); // Parent remains as todo
    expect(updatedContent).toContain("  - [ ] [[Sub-task to promote]]"); // Sub-task becomes link
  });
});
