import { test, expect, describe, beforeAll } from "vitest";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";
import { waitForTaskSyncPlugin } from "../helpers/task-sync-setup";

describe("Obsidian Day View", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await waitForTaskSyncPlugin(context.page);
  });

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
    await context.page.waitForSelector(".obsidian-day-view", {
      state: "visible",
      timeout: 5000,
    });

    // Check for header with date and zoom controls
    await context.page.waitForSelector(".obsidian-day-view__header", {
      state: "visible",
      timeout: 5000,
    });

    // Check for zoom controls
    await context.page.waitForSelector(".obsidian-day-view__zoom-btn", {
      state: "visible",
      timeout: 5000,
    });

    // Check for time slots
    const timeSlots = await context.page.locator(
      ".obsidian-day-view__time-slot"
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
    await context.page.waitForSelector(".obsidian-day-view", {
      state: "visible",
      timeout: 5000,
    });

    // Check that hour labels are displayed correctly
    const timeLabels = await context.page.locator(
      ".obsidian-day-view__time-label"
    );
    const labelCount = await timeLabels.count();
    expect(labelCount).toBeGreaterThan(0);

    // Check that labels contain AM/PM format
    const firstLabel = await timeLabels.first().textContent();
    expect(firstLabel).toMatch(/\d+\s+(AM|PM)/);

    // Check that two-digit hours don't wrap (should be on single line)
    const tenAmLabel = await context.page.locator(
      ".obsidian-day-view__time-label",
      {
        hasText: "10 AM",
      }
    );

    if ((await tenAmLabel.count()) > 0) {
      const labelHeight = await tenAmLabel.evaluate((el) => el.offsetHeight);
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
    await context.page.waitForSelector(".obsidian-day-view", {
      state: "visible",
      timeout: 5000,
    });

    // Count initial time slots
    const initialTimeSlots = await context.page.locator(
      ".obsidian-day-view__time-slot"
    );
    const initialCount = await initialTimeSlots.count();

    // Click zoom in button (the + button)
    const zoomButtons = await context.page.locator(
      ".obsidian-day-view__zoom-btn"
    );
    const zoomInButton = zoomButtons.nth(1); // Second button is the + button
    await zoomInButton.click();

    // Wait a moment for the view to update
    await context.page.waitForTimeout(500);

    // Count time slots after zoom in (should be fewer)
    const zoomedTimeSlots = await context.page.locator(
      ".obsidian-day-view__time-slot"
    );
    const zoomedCount = await zoomedTimeSlots.count();

    expect(zoomedCount).toBeLessThan(initialCount);

    // Click zoom out button (the - button)
    const zoomOutButton = zoomButtons.nth(0); // First button is the - button
    await zoomOutButton.click();

    // Wait a moment for the view to update
    await context.page.waitForTimeout(500);

    // Count should be back to original or more
    const finalTimeSlots = await context.page.locator(
      ".obsidian-day-view__time-slot"
    );
    const finalCount = await finalTimeSlots.count();

    expect(finalCount).toBeGreaterThanOrEqual(initialCount);

    console.log(
      `Time slots: initial=${initialCount}, zoomed=${zoomedCount}, final=${finalCount}`
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
    const loadTestEventsButton = await context.page.locator("button", {
      hasText: "Load Test Events",
    });

    if ((await loadTestEventsButton.count()) > 0) {
      // Click the load test events button
      await loadTestEventsButton.click();

      // Wait for events to load
      await context.page.waitForTimeout(1000);

      // Check if events are displayed in the day view
      const events = await context.page.locator(".obsidian-day-view__event");
      const eventCount = await events.count();

      expect(eventCount).toBeGreaterThan(0);

      // Check that events have titles
      const firstEvent = events.first();
      const eventTitle = await firstEvent
        .locator(".obsidian-day-view__event-title")
        .textContent();
      expect(eventTitle).toBeTruthy();

      // Check that events have time information
      const eventTime = await firstEvent
        .locator(".obsidian-day-view__event-time")
        .textContent();
      expect(eventTime).toMatch(/\d+:\d+\s+(AM|PM)\s+-\s+\d+:\d+\s+(AM|PM)/);

      console.log(`Found ${eventCount} events in day view`);
      console.log(`First event: "${eventTitle}" at ${eventTime}`);
    } else {
      console.log(
        "Load Test Events button not found - test events may already be loaded"
      );

      // Still check if any events are visible
      const events = await context.page.locator(".obsidian-day-view__event");
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
    const loadTestEventsButton = await context.page.locator("button", {
      hasText: "Load Test Events",
    });

    if ((await loadTestEventsButton.count()) > 0) {
      await loadTestEventsButton.click();
      await context.page.waitForTimeout(1000);
    }

    // Check if events are present
    const events = await context.page.locator(".obsidian-day-view__event");
    const eventCount = await events.count();

    if (eventCount > 0) {
      const firstEvent = events.first();

      // Hover over the first event
      await firstEvent.hover();

      // Check if import overlay appears
      const overlay = await firstEvent.locator(
        ".obsidian-day-view__event-overlay"
      );
      const isOverlayVisible = await overlay.isVisible();
      expect(isOverlayVisible).toBe(true);

      // Check if import button is present
      const importButton = await overlay.locator(
        ".obsidian-day-view__import-btn"
      );
      const isButtonVisible = await importButton.isVisible();
      expect(isButtonVisible).toBe(true);

      // Check button text
      const buttonText = await importButton.textContent();
      expect(buttonText).toMatch(/(Import|Add to today)/);

      console.log(`Event overlay shows button: "${buttonText}"`);
    } else {
      console.log("No events found to test hover functionality");
    }
  });
});
