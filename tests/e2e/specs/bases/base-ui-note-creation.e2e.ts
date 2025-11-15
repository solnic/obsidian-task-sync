/**
 * E2E tests for Base UI Note Creation
 * Tests that notes created via Base UI are automatically completed with missing properties
 */

import { test, expect } from "../../helpers/setup";
import {
  waitForFileContentToContain,
  waitForFileProcessed,
  readVaultFile,
  waitForSyncComplete,
} from "../../helpers/global";

test.describe("Base UI Note Creation", () => {
  test("should auto-complete missing properties when creating task via Base UI", async ({
    page,
  }) => {
    // Simulate creating a task note via Base UI
    // Base UI only adds properties configured in the base (e.g., Title and Project)
    // Our plugin should detect this and add missing required properties
    const taskContent = `---
Title: Test Task from Base UI
Project: "[[Test Project]]"
---

This task was created via Base UI with limited properties.
`;

    // Create the file directly in vault (simulating Base UI creation)
    await page.evaluate(
      async ({ filePath, content }) => {
        const app = (window as any).app;
        await app.vault.create(filePath, content);
      },
      { filePath: "Tasks/Test Task from Base UI.md", content: taskContent }
    );

    // Wait for the file to be processed
    await waitForFileProcessed(page, "Tasks/Test Task from Base UI.md");

    // Wait for the auto-completion to add the missing properties
    await waitForFileContentToContain(
      page,
      "Tasks/Test Task from Base UI.md",
      "Type: Task"
    );

    // Wait for sync to complete
    await waitForSyncComplete(page);

    // Read the updated file content
    const updatedContent = await readVaultFile(
      page,
      "Tasks/Test Task from Base UI.md"
    );

    // Verify that missing required properties were added
    expect(updatedContent).toContain("Type: Task");
    expect(updatedContent).toContain("Category:"); // Should have default value
    expect(updatedContent).toContain("Priority:"); // Should have default value
    expect(updatedContent).toContain("Status:"); // Should have default value
    expect(updatedContent).toContain("Done: false"); // Should have default value

    // Verify existing properties were preserved
    expect(updatedContent).toContain("Title: Test Task from Base UI");
    expect(updatedContent).toContain('Project: "[[Test Project]]"');
  });

  test("should auto-complete missing properties with correct default values", async ({
    page,
  }) => {
    // Create a task with minimal properties
    const minimalTaskContent = `---
Title: Minimal Task
---

Minimal task content.
`;

    // Create the file
    await page.evaluate(
      async ({ filePath, content }) => {
        const app = (window as any).app;
        await app.vault.create(filePath, content);
      },
      { filePath: "Tasks/Minimal Task.md", content: minimalTaskContent }
    );

    // Wait for file to be processed
    await waitForFileProcessed(page, "Tasks/Minimal Task.md");

    // Wait for auto-completion
    await waitForFileContentToContain(
      page,
      "Tasks/Minimal Task.md",
      "Type: Task"
    );

    // Wait for sync
    await waitForSyncComplete(page);

    // Read the updated content
    const updatedContent = await readVaultFile(page, "Tasks/Minimal Task.md");

    // Verify default values match the Task note type defaults
    expect(updatedContent).toContain("Type: Task");
    expect(updatedContent).toContain("Category: Task"); // Default category
    expect(updatedContent).toContain("Priority: Medium"); // Default priority
    expect(updatedContent).toContain("Status: Backlog"); // Default status
    expect(updatedContent).toContain("Done: false");
    expect(updatedContent).toContain("Areas: []");
    expect(updatedContent).toContain("tags: []");
  });
});
