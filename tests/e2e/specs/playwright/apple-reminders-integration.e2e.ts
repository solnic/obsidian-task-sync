/**
 * E2E tests for Apple Reminders Integration
 * Tests Apple Reminders integration functionality including permissions, data fetching, and task import
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
  selectFromDropdown,
  fileExists,
} from "../../helpers/global";
import {
  stubAppleRemindersWithFixtures,
  clickReminderImportButton,
  waitForReminderImportComplete,
} from "../../helpers/apple-reminders-integration-helpers";
import {
  getTaskByTitle,
} from "../../helpers/entity-helpers";

test.describe("Apple Reminders Integration", () => {
  test("should import Apple Reminder as task", async ({ page }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "appleReminders");

    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    // Wait for Apple Reminders service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-apple-reminders"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "apple-reminders");
    await selectFromDropdown(page, "list-filter", "Work");

    // Click import button for first reminder
    await clickReminderImportButton(page, "Complete project proposal");
    await waitForReminderImportComplete(page, "Complete project proposal");

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/Complete project proposal.md");
    expect(taskExists).toBe(true);

    // Verify task appears in Local Tasks view
    await switchToTaskService(page, "local");
    expect(
      await page
        .locator('[data-testid="service-content-local"]:not(.tab-hidden) .task-sync-item-title:has-text(\'Complete project proposal\')')
        .count()
    ).toBe(1);

    // Go back to Apple Reminders tab to verify source data is preserved
    await switchToTaskService(page, "apple-reminders");

    // Wait for Apple Reminders to be visible
    await page.waitForSelector('[data-testid="apple-reminder-item"]', {
      state: "visible",
      timeout: 5000,
    });

    // Verify that the imported task still has source.data after filter changes
    const taskAfterFilterChange = await getTaskByTitle(
      page,
      "Complete project proposal"
    );
    expect(taskAfterFilterChange).toBeDefined();
    expect(taskAfterFilterChange.source.extension).toBe("apple-reminders");
    expect(taskAfterFilterChange.source.data).toBeDefined();
    expect(taskAfterFilterChange.source.data.title).toBe("Complete project proposal");

    // Verify the imported reminder is still visible and renders without crashing
    expect(
      await page
        .locator('[data-testid="apple-reminder-item"]:has-text("Complete project proposal")')
        .count()
    ).toBe(1);
  });

  test("should handle permission denied gracefully", async ({ page }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "appleReminders");

    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-denied",
      lists: "lists-basic",
      reminders: "reminders-empty",
    });

    // Wait for Apple Reminders service button to appear
    await page.waitForSelector(
      '[data-testid="service-apple-reminders"]',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "apple-reminders");

    // Should show permission denied message
    await page.waitForSelector('[data-testid="permission-denied-message"]', {
      state: "visible",
      timeout: 5000,
    });

    expect(
      await page.locator('[data-testid="permission-denied-message"]').textContent()
    ).toContain("Permission denied");
  });

  test("should filter reminders by list", async ({ page }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "appleReminders");

    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    await switchToTaskService(page, "apple-reminders");

    // Initially should show all reminders
    expect(
      await page.locator('[data-testid="apple-reminder-item"]').count()
    ).toBeGreaterThan(1);

    // Filter by Work list
    await selectFromDropdown(page, "list-filter", "Work");

    // Should only show Work reminders
    const workReminders = await page.locator('[data-testid="apple-reminder-item"]').count();
    expect(workReminders).toBe(2); // Based on fixture data

    // Filter by Personal list
    await selectFromDropdown(page, "list-filter", "Personal");

    // Should only show Personal reminders
    const personalReminders = await page.locator('[data-testid="apple-reminder-item"]').count();
    expect(personalReminders).toBe(3); // Based on fixture data
  });
});
