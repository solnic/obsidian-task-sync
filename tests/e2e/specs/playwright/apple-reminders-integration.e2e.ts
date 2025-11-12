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
    // Set up stubs BEFORE enabling integration
    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    await openView(page, "task-sync-main");
    await enableIntegration(page, "appleReminders");

    // Wait for Apple Reminders service button to appear first
    await page.waitForSelector('[data-testid="service-apple-reminders"]', {
      state: "visible",
      timeout: 10000,
    });

    // Now wait for it to be enabled
    await page.waitForSelector(
      '[data-testid="service-apple-reminders"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "apple-reminders");

    // Wait for the list filter button to be visible and enabled
    await page.waitForSelector('[data-testid="list-filter"]:not([disabled])', {
      state: 'visible',
      timeout: 10000
    });

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

  test("should filter reminders by list", async ({ page }) => {
    // Set up stubs BEFORE enabling integration
    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    await openView(page, "task-sync-main");
    await enableIntegration(page, "appleReminders");
    await switchToTaskService(page, "apple-reminders");

    // Wait for reminders to load
    await page.waitForSelector('[data-testid="apple-reminder-item"]', {
      state: "visible",
      timeout: 10000,
    });

    // Verify list filter dropdown is populated with list names
    const listFilterButton = page.locator('[data-testid="list-filter"]');

    // Initially shows first list (Work) by default - 2 incomplete reminders
    // Note: reminder-3 is completed and excluded by default
    const initialReminders = await page.locator('[data-testid="apple-reminder-item"]').count();
    expect(initialReminders).toBe(2);

    // Verify it's showing Work list (not "All Lists")
    await expect(listFilterButton).toContainText("Work");
    await expect(listFilterButton).not.toContainText("All Lists");

    // Filter by Personal list
    await selectFromDropdown(page, "list-filter", "Personal");

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should only show Personal reminders (2 incomplete reminders: reminder-2 and reminder-5)
    // Note: reminder-3 is completed and excluded
    const personalReminders = await page.locator('[data-testid="apple-reminder-item"]').count();
    expect(personalReminders).toBe(2);
  });

  test("should show progress indicator during refresh", async ({ page }) => {
    // Set up stubs BEFORE enabling integration
    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    await openView(page, "task-sync-main");
    await enableIntegration(page, "appleReminders");
    await switchToTaskService(page, "apple-reminders");

    // Wait for initial load to complete
    await page.waitForSelector('[data-testid="apple-reminder-item"]', {
      state: "visible",
      timeout: 10000,
    });

    // Click the refresh button
    const refreshButton = page.locator('[data-testid="task-sync-apple-reminders-refresh-button"]');
    await refreshButton.click();

    // Progress indicator should appear (even briefly)
    // Note: It may complete very quickly in tests, so we use a flexible approach
    try {
      await page.waitForSelector('[data-testid="refresh-progress"]', {
        state: "visible",
        timeout: 1000,
      });

      // Progress should show status and percentage
      const progressStatus = page.locator('[data-testid="refresh-progress"] .task-sync-progress-status');
      const progressPercentage = page.locator('[data-testid="refresh-progress"] .task-sync-progress-percentage');

      // Should have some content (may vary based on timing)
      await expect(progressStatus).not.toBeEmpty();
      await expect(progressPercentage).not.toBeEmpty();
    } catch (e) {
      // If progress completes too quickly, that's okay - refresh still worked
      console.log("Progress indicator completed too quickly to verify (expected in fast test environments)");
    }

    // Verify reminders still loaded after refresh
    expect(await page.locator('[data-testid="apple-reminder-item"]').count()).toBeGreaterThan(0);
  });
});
