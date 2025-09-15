/**
 * End-to-End Tests for DailyNoteService
 * Tests the complete DailyNoteService functionality in a real Obsidian environment
 */

import { test, expect, describe } from "vitest";
import {
  createTestFolders,
  fileExists,
  waitForTaskSyncPlugin,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createTask } from "../helpers/entity-helpers";

describe("DailyNoteService", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);
  });

  test("should get today's daily note path", async () => {
    const todayPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Access the dailyNoteService instance
      const dailyNoteService = plugin.dailyNoteService;

      return await dailyNoteService.getTodayDailyNotePath();
    });

    // Should return a path with today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];
    expect(todayPath).toContain(today);
  });

  test("should create today's daily note if it doesn't exist", async () => {
    const result = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Access the dailyNoteService instance
      const dailyNoteService = plugin.dailyNoteService;

      return await dailyNoteService.ensureTodayDailyNote();
    });

    // Should return the path to the created daily note
    const today = new Date().toISOString().split("T")[0];
    expect(result.path).toContain(today);
    expect(result.created).toBe(true);

    // Verify the file was actually created
    const fileExistsResult = await fileExists(context.page, result.path);
    expect(fileExistsResult).toBe(true);
  });

  test("should add task link to today's daily note", async () => {
    // First create a test task
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskData = {
        title: "Test Task for Daily Note",
        priority: "Medium",
        done: false,
        status: "Backlog",
      };

      return await plugin.taskFileManager.createTaskFile(taskData);
    });

    // Now add it to today's daily note
    const result = await context.page.evaluate(async (taskPath) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Access the dailyNoteService instance
      const dailyNoteService = plugin.dailyNoteService;

      return await dailyNoteService.addTaskToToday(taskPath);
    }, taskPath);

    expect(result.success).toBe(true);
    expect(result.dailyNotePath).toBeDefined();

    // Verify the task link was added to the daily note
    const dailyNoteContent = await context.page.evaluate(
      async (dailyNotePath) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(dailyNotePath);
        return await app.vault.read(file);
      },
      result.dailyNotePath
    );

    expect(dailyNoteContent).toContain("Test Task for Daily Note");
    expect(dailyNoteContent).toContain("- [ ] [[Test Task for Daily Note]]");

    // Verify the Do Date property was set in the task's front-matter
    const taskFrontMatter = await context.page.evaluate(async (taskPath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(taskPath);
      const cache = app.metadataCache.getFileCache(file);
      return cache?.frontmatter;
    }, taskPath);

    const today = new Date().toISOString().split("T")[0];
    expect(taskFrontMatter["Do Date"]).toBe(today);
  });

  test("should correctly identify if task is already in today's daily note", async () => {
    // First create a test task
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskData = {
        title: "Test Task for Today Check",
        priority: "Medium",
        done: false,
        status: "Backlog",
      };

      return await plugin.taskFileManager.createTaskFile(taskData);
    });

    // Initially, the task should not be in today's daily note
    const initialCheck = await context.page.evaluate(async (taskPath) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.dailyNoteService.isTaskInToday(taskPath);
    }, taskPath);

    expect(initialCheck).toBe(false);

    // Add the task to today's daily note
    const addResult = await context.page.evaluate(async (taskPath) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.dailyNoteService.addTaskToToday(taskPath);
    }, taskPath);

    expect(addResult.success).toBe(true);

    // Now the task should be in today's daily note
    const afterAddCheck = await context.page.evaluate(async (taskPath) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.dailyNoteService.isTaskInToday(taskPath);
    }, taskPath);

    expect(afterAddCheck).toBe(true);
  });
});
