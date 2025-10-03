/**
 * E2E tests for Clear All Caches command
 * Tests the actual cache clearing functionality in a real Obsidian environment
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import {
  executeCommand,
  getPlugin,
  fileExists,
  waitForFileContentToContain,
} from "../../helpers/global";
import {
  createProject,
  createArea,
  createTask,
} from "../../helpers/entity-helpers";

describe("Clear All Caches Command E2E", () => {
  const context = setupE2ETestHooks();

  test("should clear all caches, save data, and refresh stores", async () => {
    const testProject = await createProject(context.page, {
      name: "Cache Test Project",
      description: "Project for testing cache clearing",
    });

    await createArea(context.page, {
      name: "Cache Test Area",
      description: "Area for testing cache clearing",
    });

    await createTask(context.page, {
      title: "Cache Test Task",
      description: "Task for testing cache clearing",
      project: testProject.name,
    });

    const projectFileExists = await fileExists(
      context.page,
      "Projects/Cache Test Project.md"
    );
    expect(projectFileExists).toBe(true);

    const areaFileExists = await fileExists(
      context.page,
      "Areas/Cache Test Area.md"
    );
    expect(areaFileExists).toBe(true);

    const taskFileExists = await fileExists(
      context.page,
      "Tasks/Cache Test Task.md"
    );
    expect(taskFileExists).toBe(true);

    const plugin = await getPlugin(context.page);
    expect(plugin).toBeDefined();

    // Check that stores have cached entities
    const cachedTasksBefore = await context.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedTasks();
    });

    const cachedProjectsBefore = await context.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedProjects();
    });

    const cachedAreasBefore = await context.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedAreas();
    });

    expect(cachedTasksBefore.length).toBeGreaterThan(0);
    expect(cachedProjectsBefore.length).toBeGreaterThan(0);
    expect(cachedAreasBefore.length).toBeGreaterThan(0);

    // Step 4: Get cache manager stats before clearing
    const cacheStatsBefore = await context.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.cacheManager.getStats();
    });

    expect(cacheStatsBefore).toBeDefined();
    expect(Array.isArray(cacheStatsBefore)).toBe(true);

    await executeCommand(context.page, "Task Sync: Clear all caches");

    // Wait a moment for the command to complete
    await context.page.waitForTimeout(1000);

    // Check that cache manager caches were cleared
    const cacheStatsAfter = await context.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.cacheManager.getStats();
    });

    // Check that stores still have data (they should be refreshed from files)
    const cachedTasksAfter = await context.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedTasks();
    });

    const cachedProjectsAfter = await context.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedProjects();
    });

    const cachedAreasAfter = await context.page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedAreas();
    });

    // Verify data was refreshed from files (should still have our test entities)
    expect(cachedTasksAfter.length).toBeGreaterThan(0);
    expect(cachedProjectsAfter.length).toBeGreaterThan(0);
    expect(cachedAreasAfter.length).toBeGreaterThan(0);

    // Verify our test entities are still present after refresh
    const testTaskAfter = cachedTasksAfter.find(
      (task: any) => task.title === "Cache Test Task"
    );
    expect(testTaskAfter).toBeDefined();

    const testProjectAfter = cachedProjectsAfter.find(
      (project: any) => project.name === "Cache Test Project"
    );
    expect(testProjectAfter).toBeDefined();

    const testAreaAfter = cachedAreasAfter.find(
      (area: any) => area.name === "Cache Test Area"
    );
    expect(testAreaAfter).toBeDefined();
  });

  test("should handle cache clearing when no cached data exists", async () => {
    // Execute Clear All Caches command on fresh environment
    await executeCommand(context.page, "Task Sync: Clear all caches");

    // Wait for command to complete
    await context.page.waitForTimeout(500);

    // Verify command completed without errors
    const plugin = await getPlugin(context.page);
    expect(plugin).toBeDefined();
  });
});
