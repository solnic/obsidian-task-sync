import { test, expect, describe, beforeAll } from "vitest";
import { executeCommand } from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Obsidian Day View", () => {
  const context = setupE2ETestHooks();

  test("should render custom day view with zoom controls", async () => {
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

    // Check if our custom day view is rendered
    await context.page.waitForSelector('[data-testid="obsidian-day-view"]', {
      state: "visible",
      timeout: 5000,
    });

    // Check for header with date and zoom controls
    await context.page.waitForSelector(
      '[data-testid="obsidian-day-view-header"]',
      {
        state: "visible",
        timeout: 5000,
      }
    );

    // Check for zoom controls (back in day view header)
    await context.page.waitForSelector(
      '[data-testid="obsidian-day-view-zoom-controls"]',
      {
        state: "visible",
        timeout: 5000,
      }
    );

    // Check for time slots
    const timeSlots = context.page.locator(
      '[data-testid="obsidian-day-view-time-slot"]'
    );
    const timeSlotCount = await timeSlots.count();
    expect(timeSlotCount).toBeGreaterThan(0);

    console.log(`Found ${timeSlotCount} time slots in day view`);
  });

  test("should display hour labels correctly", async () => {
    // Open Task Planning view
    await executeCommand(context, "Task Sync: Open Task Planning");

    // Wait for the view to load
    await context.page.waitForSelector('[data-testid="task-planning-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Wait for day view to be visible
    await context.page.waitForSelector('[data-testid="obsidian-day-view"]', {
      state: "visible",
      timeout: 5000,
    });

    // Check that hour labels are displayed correctly
    const timeLabels = context.page.locator(
      '[data-testid="obsidian-day-view-time-label"]'
    );
    const labelCount = await timeLabels.count();
    expect(labelCount).toBeGreaterThan(0);

    // Check that labels contain AM/PM format
    const firstLabel = await timeLabels.first().textContent();
    expect(firstLabel).toMatch(/\d+\s+(AM|PM)/);

    // Check that two-digit hours don't wrap (should be on single line)
    const tenAmLabel = context.page.locator(
      '[data-testid="obsidian-day-view-time-label"]',
      {
        hasText: "10 AM",
      }
    );

    if ((await tenAmLabel.count()) > 0) {
      const labelHeight = await tenAmLabel.evaluate(
        (el) => (el as HTMLElement).offsetHeight
      );
      const lineHeight = await tenAmLabel.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return parseFloat(style.lineHeight);
      });

      // Height should be approximately equal to line height (not wrapped)
      expect(labelHeight).toBeLessThanOrEqual(lineHeight * 1.5);
      console.log(
        `10 AM label height: ${labelHeight}px, line height: ${lineHeight}px`
      );
    }

    console.log(`Found ${labelCount} time labels`);
  });

  test("should handle zoom functionality", async () => {
    // Open Task Planning view
    await executeCommand(context, "Task Sync: Open Task Planning");

    // Wait for the view to load
    await context.page.waitForSelector('[data-testid="task-planning-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Wait for day view to be visible
    await context.page.waitForSelector('[data-testid="obsidian-day-view"]', {
      state: "visible",
      timeout: 5000,
    });

    // Count initial time slots
    const initialTimeSlots = context.page.locator(
      '[data-testid="obsidian-day-view-time-slot"]'
    );
    const initialCount = await initialTimeSlots.count();

    // First zoom out to ensure we can zoom in (since we might start at max zoom)
    const zoomOutButton = context.page.locator(
      '[data-testid="obsidian-day-view-zoom-out-btn"]'
    );

    // Check if zoom out button is enabled
    const isZoomOutEnabled = await zoomOutButton.isEnabled();
    if (isZoomOutEnabled) {
      await zoomOutButton.click();

      // Wait for the view to update using smart waiting
      await context.page.waitForFunction(
        (expectedCount) => {
          const timeSlots = document.querySelectorAll(
            '[data-testid="obsidian-day-view-time-slot"]'
          );
          return timeSlots.length !== expectedCount;
        },
        initialCount,
        { timeout: 5000 }
      );
    }

    // Count time slots after zoom out (should be more)
    const zoomedOutTimeSlots = context.page.locator(
      '[data-testid="obsidian-day-view-time-slot"]'
    );
    const zoomedOutCount = await zoomedOutTimeSlots.count();

    // Now zoom in
    const zoomInButton = context.page.locator(
      '[data-testid="obsidian-day-view-zoom-in-btn"]'
    );
    await zoomInButton.click();

    // Wait for the view to update using smart waiting
    await context.page.waitForFunction(
      (expectedCount) => {
        const timeSlots = document.querySelectorAll(
          '[data-testid="obsidian-day-view-time-slot"]'
        );
        return timeSlots.length !== expectedCount;
      },
      zoomedOutCount,
      { timeout: 5000 }
    );

    // Count time slots after zoom in (should be fewer than zoomed out)
    const zoomedInTimeSlots = context.page.locator(
      '[data-testid="obsidian-day-view-time-slot"]'
    );
    const zoomedInCount = await zoomedInTimeSlots.count();

    expect(zoomedInCount).toBeLessThan(zoomedOutCount);

    console.log(
      `Time slots: initial=${initialCount}, zoomedOut=${zoomedOutCount}, zoomedIn=${zoomedInCount}`
    );
  });

  test("should load and display test events", async () => {
    // Open Task Planning view
    await executeCommand(context, "Task Sync: Open Task Planning");

    // Wait for the view to load
    await context.page.waitForSelector('[data-testid="task-planning-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Look for the "Load Test Events" button
    const loadTestEventsButton = context.page.locator("button", {
      hasText: "Load Test Events",
    });

    if ((await loadTestEventsButton.count()) > 0) {
      // Click the load test events button
      await loadTestEventsButton.click();

      // Wait for events to load using smart waiting
      await context.page.waitForFunction(
        () => {
          const events = document.querySelectorAll(
            '[data-testid="obsidian-day-view-event"]'
          );
          return events.length > 0;
        },
        { timeout: 5000 }
      );

      // Check if events are displayed in the day view
      const events = context.page.locator(
        '[data-testid="obsidian-day-view-event"]'
      );
      const eventCount = await events.count();

      expect(eventCount).toBeGreaterThan(0);

      // Check that events have titles
      const firstEvent = events.first();
      const eventTitle = await firstEvent
        .locator('[data-testid="obsidian-day-view-event-title"]')
        .textContent();
      expect(eventTitle).toBeTruthy();

      // Check that events have time information
      const eventTime = await firstEvent
        .locator('[data-testid="obsidian-day-view-event-time"]')
        .textContent();
      expect(eventTime).toMatch(/\d+:\d+\s+(AM|PM)\s+-\s+\d+:\d+\s+(AM|PM)/);

      console.log(`Found ${eventCount} events in day view`);
      console.log(`First event: "${eventTitle}" at ${eventTime}`);
    } else {
      console.log(
        "Load Test Events button not found - test events may already be loaded"
      );

      // Still check if any events are visible
      const events = context.page.locator(
        '[data-testid="obsidian-day-view-event"]'
      );
      const eventCount = await events.count();
      console.log(
        `Found ${eventCount} events in day view without loading test events`
      );
    }
  });

  test("should show event import overlays on hover", async () => {
    // Open Task Planning view
    await executeCommand(context, "Task Sync: Open Task Planning");

    // Wait for the view to load
    await context.page.waitForSelector('[data-testid="task-planning-view"]', {
      state: "visible",
      timeout: 10000,
    });

    // Load test events if button is available
    const loadTestEventsButton = context.page.locator("button", {
      hasText: "Load Test Events",
    });

    if ((await loadTestEventsButton.count()) > 0) {
      await loadTestEventsButton.click();
      // Wait for events to load using smart waiting
      await context.page.waitForFunction(
        () => {
          const events = document.querySelectorAll(
            '[data-testid="obsidian-day-view-event"]'
          );
          return events.length > 0;
        },
        { timeout: 5000 }
      );
    }

    // Check if events are present
    const events = context.page.locator(
      '[data-testid="obsidian-day-view-event"]'
    );

    const firstEvent = events.first();

    // Hover over the first event
    await firstEvent.hover();

    // Wait for hover transition to complete using smart waiting
    await context.page.waitForFunction(
      () => {
        const overlay = document.querySelector(
          '[data-testid="obsidian-day-view-event-overlay"]'
        );
        if (!overlay) return false;
        const opacity = window.getComputedStyle(overlay).opacity;
        return parseFloat(opacity) > 0;
      },
      { timeout: 5000 }
    );

    // Check if import overlay appears - use data attribute
    const overlay = firstEvent.locator(
      '[data-testid="obsidian-day-view-event-overlay"]'
    );

    // Check if overlay becomes visible after hover (check computed opacity)
    const overlayOpacity = await overlay.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });

    // The overlay should have opacity > 0 when hovered
    expect(parseFloat(overlayOpacity)).toBeGreaterThan(0);

    // Check if import button is present
    const importButton = overlay.locator(
      '[data-testid="obsidian-day-view-import-btn"]'
    );

    const buttonText = await importButton.textContent();
    expect(buttonText).toMatch(/(Import|Add to today)/);
  });
});
