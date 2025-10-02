/**
 * Simple test for "Schedule for today" button functionality
 * Tests the interaction without complex task creation
 */

import { test, expect } from "@playwright/test";
import {
  executeCommand,
  openView,
  switchToTaskService,
} from "../../helpers/global";
import { startDailyPlanning } from "../../helpers/daily-planning-helpers";

test.describe("Schedule for Today Button - Simple", () => {
  test("should show schedule button when daily planning is active", async ({
    page,
  }) => {
    // Start daily planning to activate wizard mode
    await startDailyPlanning(page);

    // Open Tasks view in sidebar (keeping Daily Planning view open to maintain wizard mode)
    await openView(page, "tasks");

    // Switch to local service to see tasks
    await switchToTaskService(page, "local");

    // Wait for the task list to load
    await expect(page.locator('[data-testid="service-content"]')).toBeVisible();

    // Check if any tasks exist and if they show the schedule button on hover
    const taskItems = page.locator('[data-testid^="local-task-item-"]');
    const taskCount = await taskItems.count();

    if (taskCount > 0) {
      // Test with the first task
      const firstTask = taskItems.first();
      await firstTask.hover();

      // Look for the schedule button
      const scheduleButton = firstTask.locator(
        '[data-testid="schedule-for-today-button"]'
      );

      // The button should be visible on hover
      await expect(scheduleButton).toBeVisible({ timeout: 5000 });

      // Verify button text
      await expect(scheduleButton).toContainText("Schedule for today");

      // Try clicking the button
      await scheduleButton.click();

      // Wait for the action to complete
      await page.waitForTimeout(1000);

      // Verify the button text changes to indicate the task is scheduled
      await expect(scheduleButton).toContainText("✓ Scheduled for today");
    } else {
      console.log("No tasks found to test with");
    }
  });
});
