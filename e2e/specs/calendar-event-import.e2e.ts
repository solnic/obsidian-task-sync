import { test, expect, describe, beforeAll } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Calendar Event Import", () => {
  const context = setupE2ETestHooks();

  test("should have calendar event import functionality available", async () => {
    // Check if AppleCalendarService has the importEventAsTask method
    const hasImportMethod = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return (
        typeof plugin.appleCalendarService.importEventAsTask === "function"
      );
    });

    expect(hasImportMethod).toBe(true);
  });

  test("should transform calendar event to task data correctly", async () => {
    // Test the transformation logic
    const transformResult = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Create a mock calendar event
      const mockEvent = {
        id: "test-event-1",
        title: "Test Meeting",
        description: "This is a test meeting",
        location: "Conference Room A",
        startDate: new Date("2024-01-15T10:00:00Z"),
        endDate: new Date("2024-01-15T11:00:00Z"),
        allDay: false,
        calendar: {
          id: "test-cal",
          name: "Test Calendar",
          visible: true,
          color: "#007AFF",
        },
        url: "calendar://event/test-event-1",
      };

      // Access the private transformation method via the service
      const service = plugin.appleCalendarService;

      // We can't directly access private methods, so we'll test the public import method
      // and check if it properly handles the event data
      try {
        // Get default import config
        const config = plugin.getDefaultImportConfig();

        // This should work without throwing an error
        const result = await service.importEventAsTask(mockEvent, config);

        return {
          success: true,
          hasTaskPath: !!result.taskPath,
          resultSuccess: result.success,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(transformResult.success).toBe(true);
    if (transformResult.success) {
      expect(transformResult.resultSuccess).toBe(true);
      expect(transformResult.hasTaskPath).toBe(true);
    }
  });

  test("should handle all-day events correctly", async () => {
    // Test all-day event transformation
    const transformResult = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Create a mock all-day event
      const mockEvent = {
        id: "test-event-2",
        title: "All Day Conference",
        description: "Annual company conference",
        location: "Main Auditorium",
        startDate: new Date("2024-01-15T00:00:00Z"),
        endDate: new Date("2024-01-16T00:00:00Z"),
        allDay: true,
        calendar: {
          id: "test-cal",
          name: "Work Calendar",
          visible: true,
          color: "#FF6B6B",
        },
        url: "calendar://event/test-event-2",
      };

      try {
        const config = plugin.getDefaultImportConfig();
        const result = await plugin.appleCalendarService.importEventAsTask(
          mockEvent,
          config
        );

        return {
          success: true,
          resultSuccess: result.success,
          hasTaskPath: !!result.taskPath,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(transformResult.success).toBe(true);
    if (transformResult.success) {
      expect(transformResult.resultSuccess).toBe(true);
      expect(transformResult.hasTaskPath).toBe(true);
    }
  });

  test("should prevent duplicate imports", async () => {
    // Test that importing the same event twice doesn't create duplicates
    const duplicateTest = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const mockEvent = {
        id: "test-event-duplicate",
        title: "Duplicate Test Event",
        description: "This event should not be imported twice",
        location: "Test Location",
        startDate: new Date("2024-01-15T14:00:00Z"),
        endDate: new Date("2024-01-15T15:00:00Z"),
        allDay: false,
        calendar: {
          id: "test-cal",
          name: "Test Calendar",
          visible: true,
          color: "#007AFF",
        },
        url: "calendar://event/test-event-duplicate",
      };

      try {
        const config = plugin.getDefaultImportConfig();

        // First import
        const result1 = await plugin.appleCalendarService.importEventAsTask(
          mockEvent,
          config
        );

        // Second import (should be skipped)
        const result2 = await plugin.appleCalendarService.importEventAsTask(
          mockEvent,
          config
        );

        return {
          success: true,
          firstImport: {
            success: result1.success,
            skipped: result1.skipped,
            hasTaskPath: !!result1.taskPath,
          },
          secondImport: {
            success: result2.success,
            skipped: result2.skipped,
            reason: result2.reason,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(duplicateTest.success).toBe(true);
    if (duplicateTest.success) {
      // First import should succeed
      expect(duplicateTest.firstImport.success).toBe(true);
      expect(duplicateTest.firstImport.skipped).toBeFalsy();
      expect(duplicateTest.firstImport.hasTaskPath).toBe(true);

      // Second import should be skipped
      expect(duplicateTest.secondImport.success).toBe(true);
      expect(duplicateTest.secondImport.skipped).toBe(true);
      expect(duplicateTest.secondImport.reason).toContain("already imported");
    }
  });
});
