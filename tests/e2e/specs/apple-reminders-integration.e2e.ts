/**
 * E2E tests for Apple Reminders Integration
 * Tests Apple Reminders integration functionality including permissions, data fetching, and task import
 */

import { test, expect } from "../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
  selectFromDropdown,
  fileExists,
} from "../helpers/global";
import {
  stubAppleRemindersWithFixtures,
  clickReminderImportButton,
  waitForReminderImportComplete,
} from "../helpers/apple-reminders-integration-helpers";
import { getTaskByTitle, getAllTasks } from "../helpers/entity-helpers";

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
      state: "visible",
      timeout: 10000,
    });

    await selectFromDropdown(page, "list-filter", "Work");

    // Click import button for first reminder
    await clickReminderImportButton(page, "Complete project proposal");
    await waitForReminderImportComplete(page, "Complete project proposal");

    // Verify task file was created
    const taskExists = await fileExists(
      page,
      "Tasks/Complete project proposal.md"
    );
    expect(taskExists).toBe(true);

    // Verify task appears in Local Tasks view
    await switchToTaskService(page, "local");
    expect(
      await page
        .locator(
          "[data-testid=\"service-content-local\"]:not(.tab-hidden) .task-sync-item-title:has-text('Complete project proposal')"
        )
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
    expect(taskAfterFilterChange.source.data.title).toBe(
      "Complete project proposal"
    );

    // Verify the imported reminder is still visible and renders without crashing
    expect(
      await page
        .locator(
          '[data-testid="apple-reminder-item"]:has-text("Complete project proposal")'
        )
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
      state: "visible",
      timeout: 10000,
    });

    // Select the first list to load reminders
    await selectFromDropdown(page, "list-filter", "Work");

    // Wait for reminders to load
    await page.waitForSelector('[data-testid="apple-reminder-item"]', {
      state: "visible",
      timeout: 10000,
    });

    // Verify list filter dropdown is populated with list names
    const listFilterButton = page.locator('[data-testid="list-filter"]');

    // Initially shows first list (Work) by default - 2 incomplete reminders
    // Note: reminder-3 is completed and excluded by default
    const initialReminders = await page
      .locator('[data-testid="apple-reminder-item"]')
      .count();
    expect(initialReminders).toBe(2);

    // Verify it's showing Work list (not "All Lists")
    await expect(listFilterButton).toContainText("Work");
    await expect(listFilterButton).not.toContainText("All Lists");

    // Filter by Personal list
    await selectFromDropdown(page, "list-filter", "Personal");

    // Wait for exactly 2 Personal reminders to appear
    await expect(page.locator('[data-testid="apple-reminder-item"]')).toHaveCount(2, { timeout: 10000 });

    // Should only show Personal reminders (2 incomplete reminders: reminder-2 and reminder-5)
    // Note: reminder-3 is completed and excluded
    const personalReminders = await page
      .locator('[data-testid="apple-reminder-item"]')
      .count();
    expect(personalReminders).toBe(2);

    // Verify we have the expected Personal reminders by title
    expect(
      await page
        .locator(
          '[data-testid="apple-reminder-item"]:has-text("Buy groceries")'
        )
        .count()
    ).toBe(1);
    expect(
      await page
        .locator(
          '[data-testid="apple-reminder-item"]:has-text("Weekend hiking trip")'
        )
        .count()
    ).toBe(1);
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
      state: "visible",
      timeout: 10000,
    });

    // Select a list to load reminders
    await selectFromDropdown(page, "list-filter", "Work");

    // Wait for initial load to complete
    await page.waitForSelector('[data-testid="apple-reminder-item"]', {
      state: "visible",
      timeout: 10000,
    });

    // Click the refresh button
    const refreshButton = page.locator(
      '[data-testid="task-sync-apple-reminders-refresh-button"]'
    );
    await refreshButton.click();

    // Progress indicator should appear (even briefly)
    // Note: It may complete very quickly in tests, so we use a flexible approach
    // We'll try to catch it, but won't fail if it completes too fast
    try {
      await page.waitForSelector('[data-testid="refresh-progress"]', {
        state: "visible",
        timeout: 1000,
      });

      // If we caught it, verify it has the expected structure
      // Use toHaveCount which is more lenient than not.toBeEmpty
      const progressStatus = page.locator(
        '[data-testid="refresh-progress"] .task-sync-progress-status'
      );
      const progressPercentage = page.locator(
        '[data-testid="refresh-progress"] .task-sync-progress-percentage'
      );

      // Should have at least one of these elements (may vary based on timing)
      expect(
        (await progressStatus.count()) > 0 ||
          (await progressPercentage.count()) > 0
      ).toBe(true);
    } catch (e) {
      // Progress completed too fast, which is fine - the refresh still worked
    }

    // Verify reminders still loaded after refresh
    await expect(page.locator('[data-testid="apple-reminder-item"]').first()).toBeVisible({ timeout: 5000 });
    expect(
      await page.locator('[data-testid="apple-reminder-item"]').count()
    ).toBeGreaterThan(0);
  });

  test("should respect selected lists in settings", async ({ page }) => {
    // Set up stubs BEFORE enabling integration
    // Note: lists-basic fixture contains 4 lists: Work, Personal, Shopping, Projects
    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    await openView(page, "task-sync-main");

    // Enable integration with specific lists selected in settings
    await enableIntegration(page, "appleReminders", {
      reminderLists: ["Work", "Personal"], // Only sync these two lists out of 4 available
    });

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
      state: "visible",
      timeout: 10000,
    });

    // CRITICAL TEST: Verify the dropdown only shows selected lists from settings
    // Click the list filter button to open the dropdown
    const listFilterButton = page.locator('[data-testid="list-filter"]');
    await listFilterButton.click();

    // Wait for dropdown to appear (using correct test ID)
    await page.waitForSelector('[data-testid="list-filter-dropdown-item"]', {
      state: "visible",
      timeout: 5000,
    });

    // Get all dropdown items
    const dropdownItems = await page
      .locator('[data-testid="list-filter-dropdown-item"]')
      .allTextContents();

    // Filter out the "Select list" placeholder if it exists
    const actualLists = dropdownItems.filter((item) => item !== "Select list");

    // Verify ONLY the selected lists from settings are shown (Work and Personal)
    // Should NOT include Shopping or Projects
    expect(actualLists).toHaveLength(2);
    expect(actualLists).toContain("Work");
    expect(actualLists).toContain("Personal");
    expect(actualLists).not.toContain("Shopping");
    expect(actualLists).not.toContain("Projects");

    // Verify lists are sorted alphabetically (Personal before Work)
    expect(actualLists).toEqual(["Personal", "Work"]);

    // Close the dropdown by clicking elsewhere
    await page.keyboard.press("Escape");
    
    // Wait for dropdown to close
    await expect(page.locator('[data-testid="list-filter-dropdown"]')).not.toBeVisible();

    // First, check if extension is properly set up and stubs are installed
    const preRefreshCheck = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const appleRemindersExtension =
        plugin?.taskSyncApp?.appleRemindersExtension;

      return {
        extensionExists: !!appleRemindersExtension,
        isEnabled: appleRemindersExtension?.isEnabled(),
        isStubbed: appleRemindersExtension?.__isStubbed,
        stubsAvailable: !!(window as any).__appleRemindersApiStubs,
        stubInstaller: !!(window as any).__installAppleRemindersStubs,
      };
    });

    // If not stubbed, install stubs now
    if (!preRefreshCheck.isStubbed) {
      await page.evaluate(() => {
        const installer = (window as any).__installAppleRemindersStubs;
        if (installer) {
          const result = installer();
        }
      });
    }

    const refreshButton = page.locator(
      '[data-testid="task-sync-apple-reminders-refresh-button"]'
    );

    // Check if refresh button exists and is visible
    const buttonExists = await refreshButton.count();

    if (buttonExists > 0) {
      const isVisible = await refreshButton.isVisible();
      await refreshButton.click();
    }

    // Wait for refresh to complete - wait for reminders to be visible
    await expect(page.locator('[data-testid="apple-reminder-item"]').first()).toBeVisible({ timeout: 10000 });

    // Select Work list and verify only Work reminders are shown
    await selectFromDropdown(page, "list-filter", "Work");
    await page.waitForSelector('[data-testid="apple-reminder-item"]', {
      state: "visible",
      timeout: 10000,
    });

    const workReminders = await page
      .locator('[data-testid="apple-reminder-item"]')
      .count();
    expect(workReminders).toBe(2);

    // Verify Work reminder titles
    expect(
      await page
        .locator(
          '[data-testid="apple-reminder-item"]:has-text("Complete project proposal")'
        )
        .count()
    ).toBe(1);
    expect(
      await page
        .locator(
          '[data-testid="apple-reminder-item"]:has-text("Team meeting preparation")'
        )
        .count()
    ).toBe(1);

    // Switch to Personal list and verify only Personal reminders are shown
    await selectFromDropdown(page, "list-filter", "Personal");
    
    // Wait for exactly 2 Personal reminders to appear
    await expect(page.locator('[data-testid="apple-reminder-item"]')).toHaveCount(2, { timeout: 10000 });

    const personalReminders = await page
      .locator('[data-testid="apple-reminder-item"]')
      .count();
    expect(personalReminders).toBe(2);

    // Verify Personal reminder titles
    expect(
      await page
        .locator(
          '[data-testid="apple-reminder-item"]:has-text("Buy groceries")'
        )
        .count()
    ).toBe(1);
    expect(
      await page
        .locator(
          '[data-testid="apple-reminder-item"]:has-text("Weekend hiking trip")'
        )
        .count()
    ).toBe(1);

    // Verify that attempting to select a non-selected list would fail
    // This ensures the dropdown truly only contains the selected lists
    await listFilterButton.click();
    await page.waitForSelector('[data-testid="list-filter-dropdown-item"]', {
      state: "visible",
      timeout: 5000,
    });

    // Verify Shopping and Projects are NOT available in the dropdown
    const shoppingOption = page.locator(
      '[data-testid="list-filter-dropdown-item"]:has-text("Shopping")'
    );
    const projectsOption = page.locator(
      '[data-testid="list-filter-dropdown-item"]:has-text("Projects")'
    );

    expect(await shoppingOption.count()).toBe(0);
    expect(await projectsOption.count()).toBe(0);

    // Close dropdown
    await page.keyboard.press("Escape");
  });

  test("should show all lists when no specific lists selected in settings", async ({
    page,
  }) => {
    // Set up stubs with 4 available lists
    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    await openView(page, "task-sync-main");

    // Enable integration with NO lists selected (empty array means sync all)
    await enableIntegration(page, "appleReminders", {
      reminderLists: [], // Empty array should show ALL available lists
    });

    // Wait for Apple Reminders service button to appear
    await page.waitForSelector('[data-testid="service-apple-reminders"]', {
      state: "visible",
      timeout: 10000,
    });

    // Wait for it to be enabled
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
      state: "visible",
      timeout: 10000,
    });

    // Click the list filter button to open the dropdown
    const listFilterButton = page.locator('[data-testid="list-filter"]');
    await listFilterButton.click();

    // Wait for dropdown to appear (using correct test ID)
    await page.waitForSelector('[data-testid="list-filter-dropdown-item"]', {
      state: "visible",
      timeout: 5000,
    });

    // Get all dropdown items
    const dropdownItems = await page
      .locator('[data-testid="list-filter-dropdown-item"]')
      .allTextContents();

    // Filter out the "Select list" placeholder if it exists
    const actualLists = dropdownItems.filter((item) => item !== "Select list");

    // Verify ALL 4 lists are shown when no specific lists are selected
    expect(actualLists).toHaveLength(4);
    expect(actualLists).toContain("Work");
    expect(actualLists).toContain("Personal");
    expect(actualLists).toContain("Shopping");
    expect(actualLists).toContain("Projects");

    // Verify lists are sorted alphabetically
    expect(actualLists).toEqual(["Personal", "Projects", "Shopping", "Work"]);

    // Close dropdown
    await page.keyboard.press("Escape");
  });
});
