/**
 * E2E tests for "Schedule for today" button functionality
 * Tests the interaction between Tasks tab and Daily Planning wizard
 */

import { test, expect } from "@playwright/test";
import {
  executeCommand,
  openView,
  switchToTaskService,
} from "../../helpers/global";
import { createTask } from "../../helpers/entity-helpers";
import { startDailyPlanning } from "../../helpers/daily-planning-helpers";

test.describe("Schedule for Today Button", () => {
  test("should stage task when clicking 'Schedule for today' button in Tasks tab", async ({
    page,
  }) => {
    // Create a test task
    const task = await createTask(page, {
      title: "Test Task for Scheduling",
      description: "A task to test schedule for today functionality",
      status: "Not Started",
      done: false,
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Test Task for Scheduling");

    // Start daily planning to activate wizard mode
    await startDailyPlanning(page);

    // Open Tasks view in sidebar (keeping Daily Planning view open to maintain wizard mode)
    await openView(page, "tasks");

    // Switch to local service to see our test task
    await switchToTaskService(page, "local");

    // Wait for the task to appear
    await expect(page.locator('[data-testid^="local-task-item-"]')).toBeVisible(
      {
        timeout: 5000,
      }
    );

    // Find our specific task
    const taskItem = page.locator('[data-testid^="local-task-item-"]').filter({
      hasText: "Test Task for Scheduling",
    });

    // Verify the task is visible first
    await expect(taskItem).toBeVisible();

    // Hover over the task to reveal the schedule button
    await taskItem.hover();

    // Wait for the schedule button to appear on hover
    const scheduleButton = taskItem.locator(
      '[data-testid="schedule-for-today-button"]'
    );

    // Wait for the button to be visible after hover
    await expect(scheduleButton).toBeVisible({ timeout: 5000 });

    // Verify button text
    await expect(scheduleButton).toContainText("Schedule for today");

    // Click the schedule button
    await scheduleButton.click();

    // Wait for the action to complete
    await page.waitForTimeout(1000);

    // Verify the button text changes to indicate the task is scheduled
    await expect(scheduleButton).toContainText("✓ Scheduled for today");

    // Go to Daily Planning view step 2 to verify the task appears in staged tasks
    await page.click('[data-testid="daily-planning-view"]');

    // Navigate to step 2 (Today's Agenda)
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Verify the task appears in the staged tasks section
    const stagedTask = page.locator('[data-testid="staged-task"]').filter({
      hasText: "Test Task for Scheduling",
    });

    await expect(stagedTask).toBeVisible({ timeout: 5000 });
  });

  test("should show visual feedback when task is already staged", async ({
    page,
  }) => {
    // Create a test task
    const task = await createTask(page, {
      title: "Already Staged Task",
      description: "A task that will be staged twice",
      status: "Not Started",
      done: false,
    });

    expect(task).toBeTruthy();

    // Start daily planning
    await startDailyPlanning(page);

    // Open Tasks view
    await openView(page, "tasks");
    await switchToTaskService(page, "local");

    // Find the task
    const taskItem = page.locator('[data-testid^="local-task-item-"]').filter({
      hasText: "Already Staged Task",
    });

    await expect(taskItem).toBeVisible();

    // Hover and click schedule button first time
    await taskItem.hover();
    const scheduleButton = taskItem.locator(
      '[data-testid="schedule-for-today-button"]'
    );
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
    await page.waitForTimeout(500);

    // Verify button shows scheduled state
    await expect(scheduleButton).toContainText("✓ Scheduled for today");

    // Click again to test idempotency
    await scheduleButton.click();
    await page.waitForTimeout(500);

    // Should still show scheduled state (not duplicate)
    await expect(scheduleButton).toContainText("✓ Scheduled for today");

    // Verify only one instance appears in Daily Planning step 2
    await page.click('[data-testid="daily-planning-view"]');
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    const stagedTasks = page.locator('[data-testid="staged-task"]').filter({
      hasText: "Already Staged Task",
    });

    // Should only have one instance, not duplicates
    await expect(stagedTasks).toHaveCount(1);
  });

  test("should reflect planning mode in both Tasks and Daily View tabs", async ({
    page,
  }) => {
    // Initially, both views should not be in planning mode
    await openView(page, "tasks");
    await expect(
      page.locator('[data-testid="planning-header"]')
    ).not.toBeVisible();

    await openView(page, "daily");
    await expect(
      page.locator('[data-testid="planning-header"]')
    ).not.toBeVisible();

    // Start daily planning
    await startDailyPlanning(page);

    // Verify Daily Planning view is open and in planning mode
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible();

    // Switch to Tasks view - should now show planning mode
    await openView(page, "tasks");
    await expect(page.locator('[data-testid="planning-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-header"]')).toContainText(
      "📅 Daily Planning Mode"
    );

    // Switch to Daily View - should also show planning mode
    await openView(page, "daily");
    await expect(page.locator('[data-testid="planning-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-header"]')).toContainText(
      "📅 Daily Planning Mode - Day View"
    );

    // Complete daily planning
    await openView(page, "daily-planning");
    await page.click('[data-testid="next-button"]'); // Go to step 2
    await page.click('[data-testid="next-button"]'); // Go to step 3
    const confirmButton = page.locator('[data-testid="confirm-button"]');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Wait for planning to complete
    await page.waitForTimeout(1000);

    // Verify both views are no longer in planning mode
    await openView(page, "tasks");
    await expect(
      page.locator('[data-testid="planning-header"]')
    ).not.toBeVisible();

    await openView(page, "daily");
    await expect(
      page.locator('[data-testid="planning-header"]')
    ).not.toBeVisible();
  });

  test("should NOT show staged tasks in Day View - only in Daily Planning wizard", async ({
    page,
  }) => {
    // Create a test task
    const task = await createTask(page, {
      title: "Task Should Not Appear in Day View",
      description:
        "This task should only appear in Daily Planning wizard, not Day View",
      status: "Not Started",
      done: false,
    });

    expect(task).toBeTruthy();

    // Start daily planning
    await startDailyPlanning(page);

    // Open Tasks view and stage a task
    await openView(page, "tasks");
    await switchToTaskService(page, "local");

    const taskItem = page.locator('[data-testid^="local-task-item-"]').filter({
      hasText: "Task Should Not Appear in Day View",
    });

    await expect(taskItem).toBeVisible();
    await taskItem.hover();

    const scheduleButton = taskItem.locator(
      '[data-testid="schedule-for-today-button"]'
    );
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
    await page.waitForTimeout(500);

    // Verify task is staged
    await expect(scheduleButton).toContainText("✓ Scheduled for today");

    // Switch to Day View - staged task should NOT appear here
    await openView(page, "daily");

    // Day View should show planning header but NO staged tasks
    await expect(page.locator('[data-testid="planning-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="planning-header"]')).toContainText(
      "📅 Daily Planning Mode - Day View"
    );

    // The staged task should NOT appear in Day View
    const dayViewTaskList = page.locator('[data-testid="task-planning-view"]');
    await expect(dayViewTaskList).not.toContainText(
      "Task Should Not Appear in Day View"
    );

    // But the task SHOULD appear in Daily Planning wizard step 2
    await openView(page, "daily-planning");
    await page.click('[data-testid="next-button"]'); // Go to step 2
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    const stagedTask = page.locator('[data-testid="staged-task"]').filter({
      hasText: "Task Should Not Appear in Day View",
    });
    await expect(stagedTask).toBeVisible();
  });
});
