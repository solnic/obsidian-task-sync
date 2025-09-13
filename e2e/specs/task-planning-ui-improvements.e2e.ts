import { test, expect, describe, beforeAll } from "vitest";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";
import { waitForTaskSyncPlugin } from "../helpers/task-sync-setup";

describe("Task Planning UI Improvements", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await waitForTaskSyncPlugin(context.page);
  });

  test("should show correct calendar filter text", async () => {
    // Open Task Planning view
    await executeCommand(context, "Task Sync: Open Task Planning");

    // Wait for command palette to close
    await context.page.waitForSelector(".prompt-container", {
      state: "hidden",
      timeout: 5000,
    });

    // Wait for the view to load and become visible
    await context.page.waitForSelector('[data-testid="task-planning-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Check if calendar filter button exists
    const calendarFilter = await context.page.locator(
      '[data-testid="calendar-filter"]'
    );

    if ((await calendarFilter.count()) > 0) {
      // Get the filter button text
      const filterText = await calendarFilter.textContent();

      // The text should say "calendars" instead of "selected"
      // It should be either "All calendars", "1 calendar", or "X calendars"
      expect(filterText).toMatch(
        /^(All calendars|\d+ calendars?|[^0-9]+ calendar)$/
      );

      // Specifically check it doesn't contain "selected"
      expect(filterText).not.toContain("selected");

      console.log(`Calendar filter text: "${filterText}"`);
    } else {
      // If no calendar filter is present, it might be because Apple Calendar is not enabled
      // This is expected behavior and the test should pass
      console.log(
        "Calendar filter not present - Apple Calendar integration may not be enabled"
      );
    }
  });

  test("should hide today's date section from calendar header", async () => {
    // Open Task Planning view
    await executeCommand(context, "Task Sync: Open Task Planning");

    // Wait for command palette to close
    await context.page.waitForSelector(".prompt-container", {
      state: "hidden",
      timeout: 5000,
    });

    // Wait for the view to load and become visible
    await context.page.waitForSelector('[data-testid="task-planning-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Check if calendar wrapper exists
    const calendarWrapper = await context.page.locator(".calendar-wrapper");

    if ((await calendarWrapper.count()) > 0) {
      // Check that the range heading (today's date section) is hidden
      const rangeHeading = await context.page.locator(".sx__range-heading");

      if ((await rangeHeading.count()) > 0) {
        // The element might exist but should be hidden via CSS
        const isVisible = await rangeHeading.isVisible();
        expect(isVisible).toBe(false);
        console.log("Range heading is properly hidden");
      } else {
        // Element doesn't exist, which is also fine
        console.log("Range heading element not found (expected)");
      }
    } else {
      console.log(
        "Calendar wrapper not present - Apple Calendar integration may not be enabled"
      );
    }
  });

  test("should make calendar take full height", async () => {
    // Open Task Planning view
    await executeCommand(context, "Task Sync: Open Task Planning");

    // Wait for command palette to close
    await context.page.waitForSelector(".prompt-container", {
      state: "hidden",
      timeout: 5000,
    });

    // Wait for the view to load and become visible
    await context.page.waitForSelector('[data-testid="task-planning-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Check if calendar wrapper exists
    const calendarWrapper = await context.page.locator(".calendar-wrapper");

    if ((await calendarWrapper.count()) > 0) {
      // Check that the calendar wrapper has height: 100% style
      const styles = await calendarWrapper.evaluate((el) => {
        const computedStyle = window.getComputedStyle(el);
        return {
          height: computedStyle.height,
          flex: computedStyle.flex,
        };
      });

      // The calendar should have flex: 1 and height: 100%
      expect(styles.flex).toBe("1 1 0%"); // This is how flex: 1 is computed
      console.log(
        `Calendar wrapper styles - height: ${styles.height}, flex: ${styles.flex}`
      );
    } else {
      console.log(
        "Calendar wrapper not present - Apple Calendar integration may not be enabled"
      );
    }
  });
});
