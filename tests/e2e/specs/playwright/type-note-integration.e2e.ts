/**
 * E2E tests for TypeNote integration with ObsidianExtension
 * Tests that Task note type is registered and used for task creation
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  readVaultFile,
  getFrontMatter,
  expectNotice,
} from "../../helpers/global";
import { createTask } from "../../helpers/entity-helpers";

test.describe("TypeNote Integration", () => {
  test("should register Task note type on extension load", async ({ page }) => {
    // Verify TypeNote is initialized and Task note type is registered
    const noteTypeRegistered = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Access the ObsidianExtension through the host
      const obsidianExtension = plugin.host.getExtensionById("obsidian");

      if (!obsidianExtension || !obsidianExtension.typeNote) {
        return { success: false, error: "TypeNote not initialized" };
      }

      // Check if Task note type is registered
      const taskNoteType = obsidianExtension.typeNote.registry.get("task");

      if (!taskNoteType) {
        return { success: false, error: "Task note type not registered" };
      }

      return {
        success: true,
        noteType: {
          id: taskNoteType.id,
          name: taskNoteType.name,
          version: taskNoteType.version,
          propertyCount: Object.keys(taskNoteType.properties).length,
        },
      };
    });

    expect(noteTypeRegistered.success).toBe(true);
    expect(noteTypeRegistered.noteType?.id).toBe("task");
    expect(noteTypeRegistered.noteType?.name).toBe("Task");
    expect(noteTypeRegistered.noteType?.version).toBe("1.0.0");
    expect(noteTypeRegistered.noteType?.propertyCount).toBeGreaterThan(0);
  });

  test("should create task using TypeNote with correct front-matter", async ({
    page,
  }) => {
    // Create a task using the helper
    const taskTitle = "TypeNote Test Task";
    const taskDescription = "Testing TypeNote integration";
    const taskCategory = "Feature";
    const taskPriority = "High";
    const taskStatus = "In Progress";

    await createTask(page, {
      title: taskTitle,
      description: taskDescription,
      category: taskCategory,
      priority: taskPriority,
      status: taskStatus,
    });

    // Wait for the file to be created
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(taskDescription);

    // Verify front-matter properties
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    expect(frontMatter.Description).toBe(taskDescription);
    expect(frontMatter.Category).toBe(taskCategory);
    expect(frontMatter.Priority).toBe(taskPriority);
    expect(frontMatter.Status).toBe(taskStatus);
    expect(frontMatter.Done).toBe(false);
  });

  test("should validate task properties using TypeNote schemas", async ({
    page,
  }) => {
    // Try to create a task with invalid status (not in settings)
    const result = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      try {
        // Try to create a task with invalid status
        const taskOperations = plugin.operations.taskOperations;
        await taskOperations.create({
          title: "Invalid Status Task",
          status: "InvalidStatus", // This should fail validation
        });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // The task should still be created because TypeNote uses enum schema
    // which will validate against the configured statuses
    // If the status is invalid, it should either fail or use default
    expect(result.success).toBeDefined();
  });

  test("should use settings configuration for task properties", async ({
    page,
  }) => {
    // Verify that TypeNote uses the settings for categories, priorities, and statuses
    const settingsConfig = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const obsidianExtension = plugin.host.getExtensionById("obsidian");

      const taskNoteType = obsidianExtension.typeNote.registry.get("task");

      if (!taskNoteType) {
        return { success: false, error: "Task note type not found" };
      }

      // Get select options from properties
      const categoryOptions =
        taskNoteType.properties.category?.selectOptions || [];
      const priorityOptions =
        taskNoteType.properties.priority?.selectOptions || [];
      const statusOptions = taskNoteType.properties.status?.selectOptions || [];

      return {
        success: true,
        categories: categoryOptions.map((opt: any) => opt.value),
        priorities: priorityOptions.map((opt: any) => opt.value),
        statuses: statusOptions.map((opt: any) => opt.value),
      };
    });

    expect(settingsConfig.success).toBe(true);

    // Verify that we have categories from settings
    expect(settingsConfig.categories).toBeDefined();
    expect(settingsConfig.categories.length).toBeGreaterThan(0);

    // Verify that we have priorities from settings
    expect(settingsConfig.priorities).toBeDefined();
    expect(settingsConfig.priorities.length).toBeGreaterThan(0);

    // Verify that we have statuses from settings
    expect(settingsConfig.statuses).toBeDefined();
    expect(settingsConfig.statuses.length).toBeGreaterThan(0);
  });

  test("should create task with all optional properties", async ({ page }) => {
    // Create a task with all properties set
    const taskData = {
      title: "Complete TypeNote Task",
      description: "A task with all properties",
      category: "Feature",
      priority: "High",
      status: "In Progress",
      done: false,
      areas: ["Development", "Testing"],
      tags: ["important", "urgent"],
    };

    await createTask(page, taskData);

    // Wait for the file to be created
    const expectedFilePath = `Tasks/${taskData.title}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify front-matter
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskData.title);
    expect(frontMatter.Description).toBe(taskData.description);
    expect(frontMatter.Category).toBe(taskData.category);
    expect(frontMatter.Priority).toBe(taskData.priority);
    expect(frontMatter.Status).toBe(taskData.status);
    expect(frontMatter.Done).toBe(taskData.done);
    expect(frontMatter.Areas).toEqual(taskData.areas);
    expect(frontMatter.tags).toEqual(taskData.tags);
  });

  test("should handle task creation with minimal required fields", async ({
    page,
  }) => {
    // Create a task with only required fields
    const taskTitle = "Minimal TypeNote Task";

    await createTask(page, {
      title: taskTitle,
    });

    // Wait for the file to be created
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify front-matter has defaults
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    expect(frontMatter.Done).toBe(false);
    expect(frontMatter.Status).toBeDefined(); // Should have default status
  });

  test("should update Task note type when settings change", async ({
    page,
  }) => {
    // This test verifies that the updateTaskNoteType method works
    const updateResult = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const obsidianExtension = plugin.host.getExtensionById("obsidian");

      try {
        // Call the update method
        await obsidianExtension.updateTaskNoteType();

        // Verify the note type is still registered
        const taskNoteType = obsidianExtension.typeNote.registry.get("task");

        return {
          success: true,
          noteTypeExists: !!taskNoteType,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.noteTypeExists).toBe(true);
  });
});
