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
  openFile,
} from "../../helpers/global";
import {
  waitForBaseViewToLoad,
  clickBaseNewButton,
} from "../../helpers/bases-helpers";
import { createProject } from "../../helpers/entity-helpers";

test.describe("Base UI Note Creation", () => {
  test("should auto-complete missing properties when clicking New button in Base UI", async ({
    page,
  }) => {
    // Create a test project - this will have an embedded base
    const project = await createProject(page, {
      name: "Test Base UI Project",
      description: "Project for testing Base UI note creation",
    });

    const projectPath = `Projects/${project.name}.md`;
    
    // Get list of existing tasks before creating new one
    const existingTasks = await page.evaluate(async () => {
      const app = (window as any).app;
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) return [];
      const files = tasksFolder.children || [];
      return files
        .filter((f: any) => f.extension === "md")
        .map((f: any) => f.path);
    });
    
    // Open the project file
    await openFile(page, projectPath);
    
    // Wait for the bases view to appear (even if empty)
    await page.waitForSelector('.bases-view', { state: 'visible' });
    
    // Wait for the toolbar with New button to appear
    await page.waitForSelector('.bases-toolbar .bases-toolbar-new-item-menu', { state: 'visible' });

    // Click the "New" button in the Base UI
    await clickBaseNewButton(page);

    // Find the newly created file (one that wasn't in existingTasks)
    let newTaskPath: string | null = null;
    const deadline = Date.now() + 5000; // 5 second timeout
    
    while (Date.now() < deadline && !newTaskPath) {
      const currentTasks = await page.evaluate(async () => {
        const app = (window as any).app;
        const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
        if (!tasksFolder) return [];
        const files = tasksFolder.children || [];
        return files
          .filter((f: any) => f.extension === "md")
          .map((f: any) => f.path);
      });
      
      const newTasks = currentTasks.filter((path: string) => !existingTasks.includes(path));
      if (newTasks.length > 0) {
        newTaskPath = newTasks[0];
        break;
      }
      
      await page.waitForTimeout(100);
    }

    expect(newTaskPath).toBeTruthy();
    expect(newTaskPath).toContain("Tasks/");
    
    console.log("New task created at:", newTaskPath);

    // Wait for the file to be processed by NoteKit file watcher
    await waitForFileProcessed(page, newTaskPath!);
    
    // Read initial content to see what Base UI created
    const initialContent = await readVaultFile(page, newTaskPath!);
    console.log("Initial content from Base UI:", initialContent);

    // Wait for auto-completion to add missing properties
    await waitForFileContentToContain(page, newTaskPath!, "Type: Task", 5000);

    // Wait for sync to complete
    await waitForSyncComplete(page);

    // Read the updated file content
    const updatedContent = await readVaultFile(page, newTaskPath!);

    // Verify that missing properties were auto-completed
    expect(updatedContent).toContain("Type: Task");
    expect(updatedContent).toContain("Category:"); // Should have default value
    expect(updatedContent).toContain("Priority:"); // Should have default value
    expect(updatedContent).toContain("Status:"); // Should have default value
    expect(updatedContent).toContain("Done: false"); // Should have default value
    expect(updatedContent).toContain("Areas:");
    expect(updatedContent).toContain("tags:");

    // Verify that the Project property was set by the Base UI (if the base includes it)
    // The property might be there from the base configuration
  });

  test("should auto-complete all missing properties with correct defaults", async ({
    page,
  }) => {
    // Create a task with minimal properties using vault.create to simulate
    // a note created with only basic frontmatter (like Base UI would do)
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
