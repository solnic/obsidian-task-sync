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
} from "../helpers/task-sync-setup";

describe("Daily Planning", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);
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

  test("should update step 2 when task Do Date is changed via file editing", async () => {
    // Create a test task without Do Date
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Test Task for Do Date Change",
        description: "A task to test Do Date property changes",
        done: false,
      });
    });

    // Start daily planning
    await executeCommand(context, "Start daily planning");
    await context.page.waitForTimeout(2000);

    // Navigate to step 2
    const nextButton = context.page.locator('[data-testid="next-button"]');
    await nextButton.click();
    await context.page.waitForTimeout(1000);

    // Verify we're on step 2 and initially no scheduled tasks
    const stepTitle = context.page.locator('[data-testid="step-title"]');
    const stepTitleText = await stepTitle.textContent();
    expect(stepTitleText).toContain("Today's Agenda");

    const initialScheduledTasks = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    const initialCount = await initialScheduledTasks.count();

    // Now edit the task file to add Do Date for today using Obsidian's native API
    const todayString = new Date().toISOString().split("T")[0];
    await context.page.evaluate(
      async (args) => {
        const { taskPath, todayString } = args;
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(taskPath);

        if (file) {
          // Use Obsidian's processFrontMatter to add Do Date property
          await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
            frontmatter["Do Date"] = todayString;
          });
          console.log("Do Date property added:", todayString);
        } else {
          console.error("File not found:", taskPath);
        }
      },
      { taskPath, todayString }
    );

    // Wait for file change to be processed
    await context.page.waitForTimeout(1000);

    // Check if the scheduled tasks list is updated
    // The task should now appear in step 2 as a scheduled task
    const updatedScheduledTasks = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    const updatedCount = await updatedScheduledTasks.count();

    // The count should have increased by 1
    expect(updatedCount).toBe(initialCount + 1);

    // Verify the task appears in the list
    const taskTitle = context.page
      .locator('[data-testid="scheduled-task"]')
      .filter({ hasText: "Test Task for Do Date Change" });
    expect(await taskTitle.count()).toBeGreaterThan(0);
  });

  test("should show 'Schedule for today' button in Tasks view when Daily Planning is active", async () => {
    // Create a test task
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Test Task for Scheduling",
        description: "A task to test scheduling functionality",
        done: false,
      });
    });

    expect(taskPath).toBeTruthy();

    // Start daily planning
    await executeCommand(context, "Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // Open Tasks view using the proper helper
    await openTasksView(context.page);

    // Wait for Tasks view to open and become visible
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Switch to Local service tab
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for the task to appear
    const taskItem = await context.page.waitForSelector(
      '[data-testid*="test-task-for-scheduling"]',
      { timeout: 10000 }
    );

    // Hover over the task to show action buttons
    await taskItem.hover();

    // Verify "Schedule for today" button appears instead of "Add to today"
    const scheduleButton = await context.page.waitForSelector(
      '[data-testid="schedule-for-today-button"]',
      { timeout: 5000 }
    );
    expect(scheduleButton).toBeTruthy();

    // Verify "Add to today" button is not present
    const addToTodayButton = context.page.locator(
      '[data-testid="add-to-today-button"]'
    );
    const addToTodayCount = await addToTodayButton.count();
    expect(addToTodayCount).toBe(0);

    // Click the "Schedule for today" button
    await context.page.click('[data-testid="schedule-for-today-button"]');

    // Wait for the operation to complete
    await context.page.waitForTimeout(1000);

    // Verify button state changes to indicate task is scheduled
    await context.page.waitForSelector(
      '[data-testid="schedule-for-today-button"]:has-text("✓ Scheduled")',
      { timeout: 5000 }
    );
  });

  test("should show scheduled tasks in Daily Planning wizard steps", async () => {
    // Create a test task
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Task to Schedule in Wizard",
        description: "A task to test scheduling in wizard",
        done: false,
      });
    });

    expect(taskPath).toBeTruthy();

    // Start daily planning
    await executeCommand(context, "Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // Open Tasks view and schedule the task
    await openTasksView(context.page);
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Switch to Local service tab
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Find and schedule the task
    const taskItem = await context.page.waitForSelector(
      '[data-testid*="task-to-schedule-in-wizard"]',
      { timeout: 10000 }
    );
    await taskItem.hover();
    await context.page.click('[data-testid="schedule-for-today-button"]');

    // Wait for button to show "✓ Scheduled"
    await context.page.waitForSelector(
      '[data-testid="schedule-for-today-button"]:has-text("✓ Scheduled")',
      { timeout: 5000 }
    );

    // Go to step 2 (Today's Agenda) in Daily Planning wizard
    await context.page.click('[data-testid="next-button"]');

    // Verify the scheduled task appears in Today's Agenda
    await context.page.waitForSelector('[data-testid="scheduled-task"]', {
      timeout: 5000,
    });

    const scheduledTask = context.page
      .locator('[data-testid="scheduled-task"]')
      .filter({
        hasText: "Task to Schedule in Wizard",
      });
    expect(await scheduledTask.isVisible()).toBe(true);

    // Verify it has the "Added during planning" badge
    const planningBadge = scheduledTask.locator(".task-badge.planning");
    expect(await planningBadge.isVisible()).toBe(true);

    // Go to step 3 (Plan Summary)
    await context.page.click('[data-testid="next-button"]');

    // Verify the scheduled task appears in the final plan summary
    const summaryTask = context.page.locator(".preview-item.task").filter({
      hasText: "Task to Schedule in Wizard",
    });
    expect(await summaryTask.isVisible()).toBe(true);

    // Verify it has the "Scheduled during planning" badge
    const scheduledBadge = summaryTask.locator(".preview-badge.scheduled");
    expect(await scheduledBadge.isVisible()).toBe(true);
  });
});

/**
 * Helper function to open Tasks view
 */
async function openTasksView(page: any): Promise<void> {
  // First ensure the view exists
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

    if (plugin) {
      const existingLeaves = app.workspace.getLeavesOfType("tasks");
      if (existingLeaves.length === 0) {
        const rightLeaf = app.workspace.getRightLeaf(false);
        await rightLeaf.setViewState({
          type: "tasks",
          active: false,
        });
      }
    }
  });

  // Ensure right sidebar is open
  const rightSidebarToggle = page
    .locator(".sidebar-toggle-button.mod-right")
    .first();
  if (await rightSidebarToggle.isVisible()) {
    await rightSidebarToggle.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Click on the Tasks tab in the right sidebar
  const tasksTab = page.locator('.workspace-tab-header[aria-label="Tasks"]');

  if (await tasksTab.isVisible()) {
    await tasksTab.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  } else {
    // Alternative: use command palette
    await page.keyboard.press("Control+p");
    await page.fill(".prompt-input", "Tasks");
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
