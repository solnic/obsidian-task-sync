import { test, expect, describe } from "vitest";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";
import {
  createTask,
  createArea,
  createProject,
} from "../helpers/entity-helpers";

describe("Refresh Type Validation", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);
  });

  test("should not create bases for files without correct Type property", async () => {
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
      }
    });

    // Create valid entities using helpers
    await createProject(context, {
      name: "Valid Project",
      description: "Valid project file.",
    });

    await createArea(context, {
      name: "Valid Area",
      description: "Valid area file.",
    });

    // Create invalid files with wrong Type properties (manual creation for testing validation)
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Invalid files that should NOT get bases (wrong Type)
      await app.vault.create(
        "Projects/Invalid Project.md",
        `---
Name: Invalid Project
Type: Area
---

Invalid project file.`
      );

      await app.vault.create(
        "Areas/Invalid Area.md",
        `---
Name: Invalid Area
Type: Project
---

Invalid area file.`
      );
    });

    // Wait for property handlers to process files
    await context.page.waitForTimeout(2000);

    // Trigger base regeneration
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for bases to be generated
    await context.page.waitForTimeout(3000);

    // Check which base files exist
    const baseFiles = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const basesFolder = app.vault.getAbstractFileByPath("Bases");
      if (!basesFolder) return [];

      const files: string[] = [];
      const collectFiles = (folder: any) => {
        for (const child of folder.children) {
          if (child.extension === "base") {
            files.push(child.name);
          }
        }
      };
      collectFiles(basesFolder);
      return files;
    });

    // Should have bases for valid files
    expect(baseFiles).toContain("Valid Project.base");
    expect(baseFiles).toContain("Valid Area.base");

    // Should NOT have bases for invalid files (wrong Type)
    expect(baseFiles).not.toContain("Invalid Project.base");
    expect(baseFiles).not.toContain("Invalid Area.base");
  });

  test("should handle task files correctly during refresh based on Type property", async () => {
    await createTask(
      context,
      {
        title: "Valid Task",
        category: "Task",
        status: "Backlog",
      },
      "Valid task file."
    );

    // Create invalid task files for testing validation (manual creation)
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Task without Type property (should get Type property added during refresh)
      await app.vault.create(
        "Tasks/No Type Task.md",
        `---
Title: No Type Task
Status: Backlog
---

Task without Type property.`
      );

      // Invalid task with wrong Type property (should remain unchanged)
      await app.vault.create(
        "Tasks/Wrong Type Task.md",
        `---
Title: Wrong Type Task
Type: Project
Status: Backlog
---

Task with wrong Type property.`
      );
    });

    // Execute refresh command
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Check actual file states after refresh
    const fileStates = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const results: {
        filename: string;
        hasTypeProperty: boolean;
        typeValue: string;
        isValidTask: boolean;
      }[] = [];

      const files = [
        "Tasks/Valid Task.md",
        "Tasks/No Type Task.md",
        "Tasks/Wrong Type Task.md",
      ];

      for (const filePath of files) {
        try {
          const frontMatter = await plugin.taskFileManager.loadFrontMatter(
            filePath
          );
          const hasTypeProperty = frontMatter.Type !== undefined;
          const typeValue = frontMatter.Type || "";
          const isValidTask = typeValue === "Task";

          results.push({
            filename: filePath,
            hasTypeProperty,
            typeValue,
            isValidTask,
          });
        } catch (error) {
          results.push({
            filename: filePath,
            hasTypeProperty: false,
            typeValue: "",
            isValidTask: false,
          });
        }
      }

      return results;
    });

    // Verify behavior based on actual file states
    const validTask = fileStates.find(
      (f) => f.filename === "Tasks/Valid Task.md"
    );
    const noTypeTask = fileStates.find(
      (f) => f.filename === "Tasks/No Type Task.md"
    );
    const wrongTypeTask = fileStates.find(
      (f) => f.filename === "Tasks/Wrong Type Task.md"
    );

    // Valid task should remain valid
    expect(validTask?.hasTypeProperty).toBe(true);
    expect(validTask?.typeValue).toBe("Task");
    expect(validTask?.isValidTask).toBe(true);

    // Task without Type should get Type property added during refresh
    expect(noTypeTask?.hasTypeProperty).toBe(true);
    expect(noTypeTask?.typeValue).toBe("Task");
    expect(noTypeTask?.isValidTask).toBe(true);

    // Task with wrong Type should remain unchanged (not processed as a task)
    expect(wrongTypeTask?.hasTypeProperty).toBe(true);
    expect(wrongTypeTask?.typeValue).toBe("Project");
    expect(wrongTypeTask?.isValidTask).toBe(false);
  });

  test("should add Status field to task files during refresh", async () => {
    await createTask(
      context,
      {
        title: "Task Without Status",
        category: "Task",
        done: false,
      },
      "This task is missing the Status field."
    );

    await createTask(
      context,
      {
        title: "Another Task",
        category: "Task",
        priority: "High",
        done: false,
      },
      "Another task missing Status field."
    );

    // Remove Status field from both tasks to test refresh functionality
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      const files = ["Tasks/Task Without Status.md", "Tasks/Another Task.md"];
      for (const filePath of files) {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
          const content = await app.vault.read(file);
          const updatedContent = content.replace(/Status: [^\n]+\n/g, "");
          await app.vault.modify(file, updatedContent);
        }
      }
    });

    // Execute refresh command
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Check that Status field was added to both files using API
    const filesWithStatus = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const results: {
        filename: string;
        hasStatus: boolean;
        statusValue: string;
      }[] = [];

      const files = ["Tasks/Task Without Status.md", "Tasks/Another Task.md"];

      for (const filePath of files) {
        try {
          const frontMatter = await plugin.taskFileManager.loadFrontMatter(
            filePath
          );
          const hasStatus = frontMatter.Status !== undefined;
          const statusValue = frontMatter.Status || "";

          results.push({
            filename: filePath,
            hasStatus,
            statusValue,
          });
        } catch (error) {
          results.push({
            filename: filePath,
            hasStatus: false,
            statusValue: "",
          });
        }
      }

      return results;
    });

    // Verify both files now have Status field
    expect(filesWithStatus).toHaveLength(2);

    for (const fileResult of filesWithStatus) {
      expect(fileResult.hasStatus).toBe(true);
      expect(fileResult.statusValue).toBe("Backlog"); // Should use default value
    }

    console.log("Files with Status after refresh:", filesWithStatus);
  });
});
