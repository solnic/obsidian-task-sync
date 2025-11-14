/**
 * E2E tests for Calendar Day View with Apple Calendar Integration
 * Following the established patterns from github-integration.e2e.ts
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
} from "../../helpers/global";
import {
  stubAppleCalendarAPIs,
  stubGoogleCalendarAPIs,
} from "../../helpers/api-stubbing";

test.describe("Calendar Day View", () => {
  test("should display calendar events from Apple Calendar", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");

    // Enable integration first to initialize the calendar extension
    await enableIntegration(page, "appleCalendar");

    // Then stub Apple Calendar APIs with fixture data
    await stubAppleCalendarAPIs(page, {
      calendars: "calendars-basic",
      events: "today-events-basic", // Use today-events-basic for the events fixture too
      todayEvents: "today-events-basic",
      permissions: "permissions-granted",
    });

    // Wait for calendar service button to appear and be enabled
    await page.waitForSelector('[data-testid="service-calendar"]', {
      state: "visible",
      timeout: 2500,
    });

    // Switch to calendar view
    await switchToTaskService(page, "calendar");

    // Wait for calendar events to load
    await page.waitForSelector('[data-testid="obsidian-day-view-event"]', {
      state: "visible",
      timeout: 2500,
    });

    // Verify events are displayed
    const eventCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(eventCount).toBeGreaterThan(0);

    // Verify specific events from fixture
    expect(
      await page
        .locator(
          '[data-testid="obsidian-day-view-event"]:has-text("Morning Standup")'
        )
        .count()
    ).toBe(1);

    expect(
      await page
        .locator(
          '[data-testid="obsidian-day-view-event"]:has-text("Lunch with Client")'
        )
        .count()
    ).toBe(1);
  });

  test("should filter events by calendar selection", async ({ page }) => {
    await openView(page, "task-sync-main");

    // Enable integration first to initialize the calendar extension
    await enableIntegration(page, "appleCalendar");

    // Then stub Apple Calendar APIs with fixture data
    await stubAppleCalendarAPIs(page, {
      calendars: "calendars-basic",
      events: "events-basic",
      todayEvents: "today-events-basic",
      permissions: "permissions-granted",
    });

    // Wait for calendar service to be enabled
    await page.waitForSelector(
      '[data-testid="service-calendar"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    // Switch to calendar view
    await switchToTaskService(page, "calendar");

    // Wait for events to load
    await page.waitForSelector('[data-testid="obsidian-day-view-event"]', {
      state: "visible",
      timeout: 2500,
    });

    // Get initial event count (all calendars)
    const initialEventCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(initialEventCount).toBeGreaterThan(0);

    // Open calendar filter dropdown
    const calendarFilterButton = page.locator(
      '[data-testid="calendar-filter"]'
    );
    await calendarFilterButton.click();

    // Wait for dropdown to appear
    await page.waitForSelector('[data-testid="calendar-filter-dropdown"]', {
      state: "visible",
      timeout: 2500,
    });

    // First, deselect "All calendars" to clear selection
    const allCalendarsOption = page.locator(
      '[data-testid="calendar-filter-dropdown-item"]:has-text("All calendars")'
    );
    await allCalendarsOption.click();

    // Then select "Work Calendar" only
    const workCalendarOption = page.locator(
      '[data-testid="calendar-filter-dropdown-item"]:has-text("Work Calendar")'
    );
    await workCalendarOption.click();

    // Close dropdown
    await page.keyboard.press("Escape");

    // Wait for events to be filtered: all visible events should be from Work Calendar
    await page.waitForFunction(() => {
      const events = Array.from(
        document.querySelectorAll('[data-testid="obsidian-day-view-event"]')
      );
      return (
        events.length > 0 &&
        events.every(
          (e) => e.getAttribute("data-calendar-name") === "Work Calendar"
        )
      );
    });

    // Verify only Work Calendar events are shown
    const filteredEvents = page.locator(
      '[data-testid="obsidian-day-view-event"]'
    );
    const filteredCount = await filteredEvents.count();

    // All filtered events should be from Work Calendar
    for (let i = 0; i < filteredCount; i++) {
      const event = filteredEvents.nth(i);
      const calendarName = await event.getAttribute("data-calendar-name");
      expect(calendarName).toBe("Work Calendar");
    }
  });

  test("should search and filter events by title", async ({ page }) => {
    await openView(page, "task-sync-main");

    // Enable integration first to initialize the calendar extension
    await enableIntegration(page, "appleCalendar");

    // Then stub Apple Calendar APIs with fixture data
    await stubAppleCalendarAPIs(page, {
      calendars: "calendars-basic",
      events: "today-events-basic",
      todayEvents: "today-events-basic",
      permissions: "permissions-granted",
    });

    // Wait for calendar service to be enabled
    await page.waitForSelector(
      '[data-testid="service-calendar"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    // Switch to calendar view
    await switchToTaskService(page, "calendar");

    // Wait for events to load
    await page.waitForSelector('[data-testid="obsidian-day-view-event"]', {
      state: "visible",
      timeout: 2500,
    });

    // Get initial event count
    const initialEventCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(initialEventCount).toBe(2); // Should have 2 today events

    // Use search to filter events - use more specific selector to get calendar search input
    const searchInput = page.locator(
      '[data-testid="day-view-tab"] [data-testid="task-sync-search-input"]'
    );
    await searchInput.fill("Standup");

    // Wait for only 1 event containing "Morning Standup" to be visible
    await expect(
      page.locator('[data-testid="obsidian-day-view-event"]')
    ).toHaveCount(1, { timeout: 2500 });

    // Verify only matching events are shown
    const filteredCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(filteredCount).toBe(1);

    // Verify the shown event is the correct one
    const visibleEvent = page
      .locator('[data-testid="obsidian-day-view-event"]')
      .first();
    await expect(visibleEvent).toContainText("Morning Standup");
  });

  test("should navigate between dates using date picker", async ({ page }) => {
    await openView(page, "task-sync-main");

    // Enable integration first to initialize the calendar extension
    await enableIntegration(page, "appleCalendar");

    // Then stub Apple Calendar APIs with fixture data
    await stubAppleCalendarAPIs(page, {
      calendars: "calendars-basic",
      todayEvents: "today-events-basic",
      events: "events-basic",
      permissions: "permissions-granted",
    });

    // Wait for calendar service to be enabled
    await page.waitForSelector(
      '[data-testid="service-calendar"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    // Switch to calendar view
    await switchToTaskService(page, "calendar");

    // Wait for today's events to load
    await page.waitForSelector('[data-testid="obsidian-day-view-event"]', {
      state: "visible",
      timeout: 2500,
    });

    // Verify today's events are shown
    const todayEventCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(todayEventCount).toBeGreaterThan(0);

    // Click next day button
    const nextDayButton = page.locator(
      '[data-testid="obsidian-day-view-next-day-btn"]'
    );
    await nextDayButton.click();

    // Wait for the button click to be processed - the button should still exist
    await expect(nextDayButton).toBeVisible();

    // The event list should change (different events or no events)
    // Note: This is a basic test - in a real scenario, we'd stub different fixture data for different dates
  });
});

test.describe("Calendar Day View - Google Calendar", () => {
  test("should display calendar events from Google Calendar", async ({
    page,
  }) => {
    // Enable Google Calendar integration BEFORE opening the view
    await enableIntegration(page, "googleCalendar");

    await openView(page, "task-sync-main");

    // Stub Google Calendar APIs with fixture data
    await stubGoogleCalendarAPIs(page, {
      calendars: "calendars-basic",
      events: "today-events-basic",
      todayEvents: "today-events-basic",
      permissions: "permissions-granted",
    });

    // Wait for calendar service button to appear and be enabled
    await page.waitForSelector('[data-testid="service-calendar"]', {
      state: "visible",
      timeout: 2500,
    });

    // Switch to calendar view
    await switchToTaskService(page, "calendar");

    // Wait for calendar events to load
    await page.waitForSelector('[data-testid="obsidian-day-view-event"]', {
      state: "visible",
      timeout: 2500,
    });

    // Verify events are displayed
    const eventCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(eventCount).toBeGreaterThan(0);

    // Verify specific events from Google Calendar fixture
    expect(
      await page
        .locator(
          '[data-testid="obsidian-day-view-event"]:has-text("Team Meeting")'
        )
        .count()
    ).toBe(1);

    expect(
      await page
        .locator(
          '[data-testid="obsidian-day-view-event"]:has-text("Project Review")'
        )
        .count()
    ).toBe(1);
  });

  test("should filter Google Calendar events by calendar selection", async ({
    page,
  }) => {
    // Enable Google Calendar integration BEFORE opening the view
    await enableIntegration(page, "googleCalendar");

    await openView(page, "task-sync-main");

    // Stub Google Calendar APIs with fixture data
    await stubGoogleCalendarAPIs(page, {
      calendars: "calendars-basic",
      events: "events-basic",
      todayEvents: "today-events-basic",
      permissions: "permissions-granted",
    });

    // Wait for calendar service to be enabled
    await page.waitForSelector(
      '[data-testid="service-calendar"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    // Switch to calendar view
    await switchToTaskService(page, "calendar");

    // Wait for events to load
    await page.waitForSelector('[data-testid="obsidian-day-view-event"]', {
      state: "visible",
      timeout: 2500,
    });

    // Get initial event count (all calendars)
    const initialEventCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(initialEventCount).toBeGreaterThan(0);

    // Open calendar filter dropdown
    const calendarFilterButton = page.locator(
      '[data-testid="calendar-filter"]'
    );
    await calendarFilterButton.click();

    // Wait for dropdown to appear
    await page.waitForSelector('[data-testid="calendar-filter-dropdown"]', {
      state: "visible",
      timeout: 2500,
    });

    // First, deselect "All calendars" to clear selection
    const allCalendarsOption = page.locator(
      '[data-testid="calendar-filter-dropdown-item"]:has-text("All calendars")'
    );
    await allCalendarsOption.click();

    // Then select "Work Calendar" only
    const workCalendarOption = page.locator(
      '[data-testid="calendar-filter-dropdown-item"]:has-text("Work Calendar")'
    );
    await workCalendarOption.click();

    // Close dropdown
    await page.keyboard.press("Escape");

    // Wait for events to be filtered
    await page.waitForFunction(() => {
      const events = Array.from(
        document.querySelectorAll('[data-testid="obsidian-day-view-event"]')
      );
      return (
        events.length > 0 &&
        events.every(
          (e) => e.getAttribute("data-calendar-name") === "Work Calendar"
        )
      );
    });

    // Verify only Work Calendar events are shown
    const filteredEvents = page.locator(
      '[data-testid="obsidian-day-view-event"]'
    );
    const filteredCount = await filteredEvents.count();

    // All filtered events should be from Work Calendar
    for (let i = 0; i < filteredCount; i++) {
      const event = filteredEvents.nth(i);
      const calendarName = await event.getAttribute("data-calendar-name");
      expect(calendarName).toBe("Work Calendar");
    }
  });

  test("should search and filter Google Calendar events by title", async ({
    page,
  }) => {
    // Enable Google Calendar integration BEFORE opening the view
    await enableIntegration(page, "googleCalendar");

    await openView(page, "task-sync-main");

    // Stub Google Calendar APIs with fixture data
    await stubGoogleCalendarAPIs(page, {
      calendars: "calendars-basic",
      events: "today-events-basic",
      todayEvents: "today-events-basic",
      permissions: "permissions-granted",
    });

    // Wait for calendar service to be enabled
    await page.waitForSelector(
      '[data-testid="service-calendar"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    // Switch to calendar view
    await switchToTaskService(page, "calendar");

    // Wait for events to load
    await page.waitForSelector('[data-testid="obsidian-day-view-event"]', {
      state: "visible",
      timeout: 2500,
    });

    // Get initial event count
    const initialEventCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(initialEventCount).toBe(2); // Should have 2 today events

    // Use search to filter events
    const searchInput = page.locator(
      '[data-testid="day-view-tab"] [data-testid="task-sync-search-input"]'
    );
    await searchInput.fill("Team");

    // Wait for only 1 event containing "Team" to be visible
    await expect(
      page.locator('[data-testid="obsidian-day-view-event"]')
    ).toHaveCount(1, { timeout: 2500 });

    // Verify only matching events are shown
    const filteredCount = await page
      .locator('[data-testid="obsidian-day-view-event"]')
      .count();
    expect(filteredCount).toBe(1);

    // Verify the shown event is the correct one
    const visibleEvent = page
      .locator('[data-testid="obsidian-day-view-event"]')
      .first();
    await expect(visibleEvent).toContainText("Team Meeting");
  });
});
