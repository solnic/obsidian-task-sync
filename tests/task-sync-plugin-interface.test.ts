/**
 * TaskSyncPlugin Interface Tests
 * Tests that the interface properly defines the contract for commands
 */

import { describe, it, expect } from "vitest";
import type { TaskSyncPluginInterface } from "../src/interfaces/TaskSyncPluginInterface";

describe("TaskSyncPluginInterface", () => {
  it("should compile with all required methods", () => {
    // This test verifies the interface structure at compile time
    // If this compiles, the interface is properly structured

    const mockImplementation: TaskSyncPluginInterface = {
      app: {} as any,
      createTask: async () => ({} as any),
      createArea: async () => ({} as any),
      createProject: async () => ({} as any),
      refresh: async () => {},
      refreshBaseViews: async () => {},
      detectCurrentFileContext: () => ({ type: "none" }),
      getCurrentContext: () => ({ type: "none" }),
      getDefaultImportConfig: () => ({} as any),
      contextService: {
        detectCurrentFileContext: () => ({ type: "none" }),
        detectFileContext: () => ({ type: "none" }),
      },
      modalService: {
        openTaskCreateModal: async () => {},
        openAreaCreateModal: () => {},
        openProjectCreateModal: () => {},
        openTaskScheduleModal: () => {},
      },
      todoPromotionService: {
        promoteTodoToTask: async () => ({ message: "" }),
        revertPromotedTodo: async () => ({ message: "" }),
      },
      dailyNoteService: {
        ensureTodayDailyNote: async () => ({ path: "", created: false }),
        addTaskToToday: async () => ({ success: false, dailyNotePath: "" }),
      },
      cacheManager: {
        getStats: async () => [],
        clearAllCaches: async () => {},
      },
      appleCalendarService: {
        isPlatformSupported: () => false,
        isEnabled: () => false,
        checkPermissions: async () => false,
        getTodayEvents: async () => [],
      },
      taskSchedulingService: {
        isEnabled: () => false,
        scheduleTask: async () => ({ success: false }),
        isTaskScheduled: async () => false,
      },
      appleRemindersService: {
        isPlatformSupported: () => false,
        checkPermissions: async () => ({ success: false }),
        fetchReminders: async () => ({ success: false, data: [] }),
        importReminderAsTask: async () => ({ success: false }),
      },
    };

    // If we can create this mock implementation, the interface is complete
    expect(mockImplementation).toBeDefined();
    expect(typeof mockImplementation.createTask).toBe("function");
    expect(typeof mockImplementation.refresh).toBe("function");
    expect(typeof mockImplementation.detectCurrentFileContext).toBe("function");
  });

  it("should define proper return types", () => {
    // Test that the interface defines proper return types
    // This test verifies TypeScript compilation - if it compiles, types are correct

    // Create a function that accepts the interface
    function testInterface(plugin: TaskSyncPluginInterface) {
      // These should compile without type errors
      const taskPromise: Promise<any> = plugin.createTask({});
      const areaPromise: Promise<any> = plugin.createArea({} as any);
      const projectPromise: Promise<any> = plugin.createProject({} as any);
      const refreshPromise: Promise<void> = plugin.refresh();
      const contextResult: any = plugin.detectCurrentFileContext();

      return {
        taskPromise,
        areaPromise,
        projectPromise,
        refreshPromise,
        contextResult,
      };
    }

    // If this compiles, the interface types are correct
    expect(testInterface).toBeDefined();
  });
});
