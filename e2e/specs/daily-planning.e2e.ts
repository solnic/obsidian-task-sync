/**
 * End-to-End Tests for Daily Planning Functionality
 * Tests the complete daily planning workflow
 */

import { test, expect, describe, beforeAll } from "vitest";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";
import { createTask } from "../helpers/entity-helpers";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
  waitForTaskPropertySync,
} from "../helpers/task-sync-setup";

describe("Daily Planning", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Stub Apple Calendar service to prevent network calls to iCloud
    await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

      if (plugin?.appleCalendarService) {
        // Stub getTodayEvents to return empty array
        plugin.appleCalendarService.getTodayEvents = async () => {
          console.log(
            "🔧 Stubbed getTodayEvents called - returning empty array"
          );
          return [];
        };

        // Stub getEvents to return empty array
        plugin.appleCalendarService.getEvents = async () => {
          console.log("🔧 Stubbed getEvents called - returning empty array");
          return [];
        };

        // Stub checkPermissions to return true
        plugin.appleCalendarService.checkPermissions = async () => {
          console.log("🔧 Stubbed checkPermissions called - returning true");
          return true;
        };

        console.log("🔧 Apple Calendar service stubbed successfully");
      }
    });
  });

  test("should open Daily Planning view via command", async () => {
    // Execute the "Start daily planning" command
    await executeCommand(context, "Start daily planning");

    // Wait for the command to complete
    await context.page.waitForTimeout(2000);

    // Check if Daily Planning view is present in the DOM
    const dailyPlanningView = await context.page.evaluate(() => {
      return (
        document.querySelector('[data-testid="daily-planning-view"]') !== null
      );
    });

    expect(dailyPlanningView).toBe(true);
  });

  test("should complete daily planning workflow with all 3 steps and reactivity", async () => {
    // Create a test task with a Do Date set to yesterday
    const yesterdayString = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const taskPath = await context.page.evaluate(async (yesterdayString) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Test Task for Daily Planning",
        description: "A task to test the complete daily planning workflow",
        done: false,
        doDate: yesterdayString,
      });
    }, yesterdayString);

    expect(taskPath).toBeTruthy();

    // Start daily planning
    await executeCommand(context, "Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // STEP 1: Review Yesterday's Tasks
    await context.page.waitForSelector('[data-testid="step-1"]', {
      timeout: 5000,
    });

    const stepTitle = context.page.locator(".step-info h3");
    expect(await stepTitle.textContent()).toContain("Review Yesterday");

    // Navigate to step 2
    await context.page.click('[data-testid="next-button"]');

    // STEP 2: Today's Agenda - Test reactivity by changing Do Date
    await context.page.waitForSelector('[data-testid="step-2"]', {
      timeout: 5000,
    });

    expect(await stepTitle.textContent()).toContain("Today's Agenda");

    // Check initial scheduled tasks count
    const initialScheduledTasks = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    const initialCount = await initialScheduledTasks.count();

    // Edit the task file to change Do Date to today (testing reactivity)
    const todayString = new Date().toISOString().split("T")[0];

    await context.page.evaluate(
      async (args) => {
        const { taskPath, todayString } = args;
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(taskPath);

        if (file) {
          const currentContent = await app.vault.read(file);
          const updatedContent = currentContent.replace(
            /Do Date: \d{4}-\d{2}-\d{2}/,
            `Do Date: ${todayString}`
          );
          await app.vault.modify(file, updatedContent);
        }
      },
      { taskPath, todayString }
    );

    // Wait for the Do Date property to be updated in the file
    await waitForTaskPropertySync(
      context.page,
      taskPath,
      "Do Date",
      todayString,
      10000
    );

    // Wait for the UI to update via reactivity
    await context.page.waitForSelector(
      '[data-testid="scheduled-task"]:has-text("Test Task for Daily Planning")',
      { timeout: 10000 }
    );

    // Verify the task now appears in today's agenda
    const updatedScheduledTasks = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    const updatedCount = await updatedScheduledTasks.count();
    expect(updatedCount).toBe(initialCount + 1);

    // Verify the specific task appears
    const taskInAgenda = context.page
      .locator('[data-testid="scheduled-task"]')
      .filter({ hasText: "Test Task for Daily Planning" });
    expect(await taskInAgenda.isVisible()).toBe(true);

    // Navigate to step 3
    await context.page.click('[data-testid="next-button"]');

    // STEP 3: Plan Summary
    await context.page.waitForSelector('[data-testid="step-3"]', {
      timeout: 5000,
    });

    expect(await stepTitle.textContent()).toContain("Confirm Plan");

    // Verify the task appears in the final plan summary
    const summaryTask = context.page.locator(".preview-item.task").filter({
      hasText: "Test Task for Daily Planning",
    });
    expect(await summaryTask.isVisible()).toBe(true);

    // Test the complete workflow by confirming the plan
    const confirmButton = context.page.locator(
      '[data-testid="confirm-button"]'
    );
    if (await confirmButton.isVisible()) {
      await confirmButton.click();

      // Wait for confirmation to complete
      await context.page.waitForTimeout(2000);
    }
  });
});
