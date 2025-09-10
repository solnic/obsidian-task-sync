/**
 * E2E tests for Bases integration functionality
 * Tests the BaseManager service in a real Obsidian environment
 */

import { test, expect, describe, beforeAll } from "vitest";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
  waitForBaseFile,
  fileExists,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";
import { createProject, createArea } from "../helpers/entity-helpers";

describe("Bases Integration", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);
  });

  test("should have base management functionality available", async () => {
    // Check if the plugin is loaded and has base management commands
    const hasRefreshCommand = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      return "obsidian-task-sync:refresh" in commands;
    });

    expect(hasRefreshCommand).toBe(true);

    const hasAddTaskCommand = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      return "obsidian-task-sync:add-task" in commands;
    });

    expect(hasAddTaskCommand).toBe(true);
  });

  test(
    "should regenerate bases when command is executed",
    { timeout: 15000 },
    async () => {
      // Create test project and area files using entity helpers
      const testProject = await createProject(context, {
        name: "Test Project",
        description: "This is a test project for bases integration.",
      });

      const testArea = await createArea(context, {
        name: "Test Area",
        description: "This is a test area for bases integration.",
      });

      // Execute regenerate bases command
      await executeCommand(context, "Task Sync: Refresh");

      // Wait for the Tasks.base file to be created
      await waitForBaseFile(context.page, "Bases/Tasks.base");

      // Check if Tasks.base file was created
      const baseFileExists = await fileExists(context.page, "Bases/Tasks.base");
      expect(baseFileExists).toBe(true);

      // Verify entities were created correctly using returned objects
      expect(testProject.name).toBe("Test Project");
      expect(testArea.name).toBe("Test Area");

      // Verify the entities exist in the file system
      const projectFileExists = await fileExists(
        context.page,
        "Projects/Test Project.md"
      );
      expect(projectFileExists).toBe(true);

      const areaFileExists = await fileExists(
        context.page,
        "Areas/Test Area.md"
      );
      expect(areaFileExists).toBe(true);

      // Verify that individual base files were created for the entities
      const testProjectBaseExists = await fileExists(
        context.page,
        "Bases/Test Project.base"
      );
      expect(testProjectBaseExists).toBe(true);

      const testAreaBaseExists = await fileExists(
        context.page,
        "Bases/Test Area.base"
      );
      expect(testAreaBaseExists).toBe(true);
    }
  );

  test("should add base embedding to project files", async () => {
    // Create a project using entity helper
    const sampleProject = await createProject(context, {
      name: "Sample Project",
      description: "Some project content.",
    });

    // Enable project bases and execute regenerate bases command
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        // Enable project bases to get specific base embedding
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
      }
    });

    // Execute regenerate bases command
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for the project base file to be created
    await waitForBaseFile(context.page, "Bases/Sample Project.base");

    // Verify project was created correctly
    expect(sampleProject.name).toBe("Sample Project");

    // Verify the project file exists
    const projectFileExists = await fileExists(
      context.page,
      "Projects/Sample Project.md"
    );
    expect(projectFileExists).toBe(true);

    // Check if project base file was created
    const projectBaseExists = await fileExists(
      context.page,
      "Bases/Sample Project.base"
    );
    expect(projectBaseExists).toBe(true);

    // Verify the project file has base embedding by checking file content through API
    const projectFileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Projects/Sample Project.md"
      );
      if (file) {
        return await app.vault.read(file);
      }
      return null;
    });

    expect(projectFileContent).toContain("![[Bases/Sample Project.base]]");
  });

  test("should create Bases folder automatically", async () => {
    // Check if Bases folder was created during plugin initialization
    const basesExists = await fileExists(context.page, "Bases");
    expect(basesExists).toBe(true);
  });
});
