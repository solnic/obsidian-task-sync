/**
 * E2E tests for "Schedule for today" button functionality
 * Tests the interaction between Tasks tab and Daily Planning wizard
 */

import { test, expect } from "@playwright/test";
import { executeCommand, openView, switchToTaskService } from "../../helpers/global";
import { createTask } from "../../helpers/entity-helpers";
import { startDailyPlanning } from "../../helpers/daily-planning-helpers";

test.describe("Schedule for Today Button", () => {
  test("should stage task when clicking 'Schedule for today' button in Tasks tab", async ({ page }) => {
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
    await expect(page.locator('[data-testid^="local-task-item-"]')).toBeVisible({
      timeout: 5000,
    });

    // Find our specific task
    const taskItem = page
      .locator('[data-testid^="local-task-item-"]')
      .filter({
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
    const stagedTask = page
      .locator('[data-testid="staged-task"]')
      .filter({
        hasText: "Test Task for Scheduling",
      });

    await expect(stagedTask).toBeVisible({ timeout: 5000 });
  });

  test("should show visual feedback when task is already staged", async ({ page }) => {
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
    const taskItem = page
      .locator('[data-testid^="local-task-item-"]')
      .filter({
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

    const stagedTasks = page
      .locator('[data-testid="staged-task"]')
      .filter({
        hasText: "Already Staged Task",
      });

    // Should only have one instance, not duplicates
    await expect(stagedTasks).toHaveCount(1);
  });
});
