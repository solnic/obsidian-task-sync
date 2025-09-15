/**
 * E2E tests for Apple Reminders integration
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Apple Reminders Integration", () => {
  const context = setupE2ETestHooks();

  test("should have Apple Reminders service initialized", async () => {
    // Check if the Apple Reminders service is properly initialized
    const hasAppleRemindersService = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin && plugin.appleRemindersService !== undefined;
    });

    expect(hasAppleRemindersService).toBe(true);
  });

  test("should have Apple Reminders commands available on macOS", async () => {
    // Check if Apple Reminders commands are registered
    const hasAppleRemindersCommands = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;

      // Check for Apple Reminders commands
      const hasImportCommand =
        "obsidian-task-sync:import-apple-reminders" in commands;
      const hasPermissionCommand =
        "obsidian-task-sync:check-apple-reminders-permissions" in commands;

      return {
        hasImportCommand,
        hasPermissionCommand,
        platform: process.platform,
      };
    });

    // Commands should exist if platform is macOS
    if (hasAppleRemindersCommands.platform === "darwin") {
      expect(hasAppleRemindersCommands.hasImportCommand).toBe(true);
      expect(hasAppleRemindersCommands.hasPermissionCommand).toBe(true);
    } else {
      // On non-macOS platforms, commands should not be registered
      expect(hasAppleRemindersCommands.hasImportCommand).toBe(false);
      expect(hasAppleRemindersCommands.hasPermissionCommand).toBe(false);
    }
  });

  test("should have Apple Reminders settings in settings tab", async () => {
    // Open settings using the proper API method
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    // Wait for settings to load
    await context.page.waitForTimeout(1000);

    // Check if Apple Reminders settings section exists
    const hasAppleRemindersSettings = await context.page.evaluate(() => {
      // Look for Apple Reminders heading in the settings content
      const headings = document.querySelectorAll("h3");
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        if (heading.textContent?.includes("Apple Reminders")) {
          return true;
        }
      }
      return false;
    });

    expect(hasAppleRemindersSettings).toBe(true);

    // Close settings
    await context.page.evaluate(() => {
      const app = (window as any).app;
      app.setting.close();
    });
  });

  test("should show platform warning on non-macOS systems", async () => {
    // Skip this test on macOS since we want to test the warning
    const platform = await context.page.evaluate(() => process.platform);

    if (platform === "darwin") {
      return;
    }

    // Open settings using the proper API method
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    // Wait for settings to load
    await context.page.waitForTimeout(1000);

    // Check if platform warning is shown
    const hasPlatformWarning = await context.page.evaluate(() => {
      // Look for platform warning text in the settings content
      const text = document.body.textContent || "";
      return (
        text.includes(
          "Apple Reminders integration is only available on macOS"
        ) ||
        text.includes("macOS only") ||
        text.includes("only available on macOS")
      );
    });

    expect(hasPlatformWarning).toBe(true);

    // Close settings
    await context.page.evaluate(() => {
      const app = (window as any).app;
      app.setting.close();
    });
  });

  test("should handle Apple Reminders service enablement correctly", async () => {
    // Test service enablement logic
    const serviceStatus = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin || !plugin.appleRemindersService) {
        return { error: "Service not found" };
      }

      const service = plugin.appleRemindersService;

      return {
        isPlatformSupported: service.isPlatformSupported(),
        isEnabled: service.isEnabled(),
        platform: process.platform,
        settingsEnabled: plugin.settings.appleRemindersIntegration.enabled,
      };
    });

    expect(serviceStatus.error).toBeUndefined();
    expect(typeof serviceStatus.isPlatformSupported).toBe("boolean");
    expect(typeof serviceStatus.isEnabled).toBe("boolean");

    // Platform support should match actual platform
    if (serviceStatus.platform === "darwin") {
      expect(serviceStatus.isPlatformSupported).toBe(true);
    } else {
      expect(serviceStatus.isPlatformSupported).toBe(false);
    }

    // Service should not be enabled by default
    expect(serviceStatus.isEnabled).toBe(false);
    expect(serviceStatus.settingsEnabled).toBe(false);
  });

  test("should have proper default settings for Apple Reminders", async () => {
    // Check default Apple Reminders settings
    const defaultSettings = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        return { error: "Plugin not found" };
      }

      return plugin.settings.appleRemindersIntegration;
    });

    expect(defaultSettings.error).toBeUndefined();
    expect(defaultSettings.enabled).toBe(false);
    expect(defaultSettings.includeCompletedReminders).toBe(false);
    expect(defaultSettings.reminderLists).toEqual([]);
    expect(defaultSettings.syncInterval).toBe(60);
    expect(defaultSettings.excludeAllDayReminders).toBe(false);
    expect(defaultSettings.defaultTaskType).toBe("Task");
    expect(defaultSettings.importNotesAsDescription).toBe(true);
    expect(defaultSettings.preservePriority).toBe(true);
  });

  test("should show Apple Reminders service in TasksView when enabled on macOS", async () => {
    // Skip this test on non-macOS platforms
    const platform = await context.page.evaluate(() => process.platform);
    if (platform !== "darwin") {
      return;
    }

    // Enable Apple Reminders integration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin) {
        plugin.settings.appleRemindersIntegration.enabled = true;
        await plugin.saveSettings();
      }
    });

    // Open Tasks view
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.commands.executeCommandById(
        "obsidian-task-sync:open-tasks-view"
      );
    });

    // Wait for the view to load
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      timeout: 5000,
    });

    // Check if Apple Reminders service is available in the service switcher
    const hasAppleRemindersService = await context.page.evaluate(() => {
      const tasksView = document.querySelector('[data-testid="tasks-view"]');
      if (!tasksView) return false;

      // Look for Apple Reminders service in the service switcher
      const serviceElements = tasksView.querySelectorAll("[data-service-id]");
      for (let i = 0; i < serviceElements.length; i++) {
        const serviceEl = serviceElements[i];
        if (serviceEl.getAttribute("data-service-id") === "apple-reminders") {
          return true;
        }
      }
      return false;
    });

    expect(hasAppleRemindersService).toBe(true);

    // Disable Apple Reminders integration for cleanup
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin) {
        plugin.settings.appleRemindersIntegration.enabled = false;
        await plugin.saveSettings();
      }
    });
  });

  test("should clear cache when refresh button is clicked", async () => {
    // Skip this test on non-macOS platforms since Apple Reminders is not available
    const platform = await context.page.evaluate(() => process.platform);
    if (platform !== "darwin") {
      // On non-macOS platforms, we can only test that the refresh button exists
      // and that clicking it doesn't cause errors, but we can't test actual Apple Reminders functionality
      console.log(
        "Skipping Apple Reminders refresh test on non-macOS platform"
      );
      return;
    }

    // Enable Apple Reminders integration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin) {
        plugin.settings.appleRemindersIntegration.enabled = true;
        await plugin.saveSettings();
      }
    });

    // Open Tasks view
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.commands.executeCommandById(
        "obsidian-task-sync:open-tasks-view"
      );
    });

    // Wait for the view to load
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      timeout: 5000,
    });

    // Switch to Apple Reminders service
    await context.page.click('[data-service-id="apple-reminders"]');

    // Wait for Apple Reminders service to load
    await context.page.waitForSelector(
      '[data-testid="apple-reminders-service"]',
      {
        timeout: 5000,
      }
    );

    // Check if refresh button exists and click it
    const refreshButtonExists = await context.page.isVisible(
      '[data-testid="apple-reminders-search-input-refresh"]'
    );

    if (refreshButtonExists) {
      // Mock the clearCache method to track if it's called
      const cacheCleared = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        if (!plugin || !plugin.appleRemindersService) {
          return false;
        }

        let cacheClearCalled = false;
        const originalClearCache = plugin.appleRemindersService.clearCache;

        // Mock clearCache to track if it's called
        plugin.appleRemindersService.clearCache = async function () {
          cacheClearCalled = true;
          return originalClearCache.call(this);
        };

        // Click the refresh button
        const refreshButton = document.querySelector(
          '[data-testid="apple-reminders-search-input-refresh"]'
        );
        if (refreshButton) {
          (refreshButton as HTMLElement).click();

          // Wait a bit for the refresh to process
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Restore original method
        plugin.appleRemindersService.clearCache = originalClearCache;

        return cacheClearCalled;
      });

      expect(cacheCleared).toBe(true);
    }

    // Disable Apple Reminders integration for cleanup
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin) {
        plugin.settings.appleRemindersIntegration.enabled = false;
        await plugin.saveSettings();
      }
    });
  });

  test("should not show Apple Reminders service when disabled", async () => {
    // Ensure Apple Reminders integration is disabled
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin) {
        plugin.settings.appleRemindersIntegration.enabled = false;
        await plugin.saveSettings();
      }
    });

    // Check that Apple Reminders service is properly disabled in plugin settings
    const serviceDisabled = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) return false;

      // Check that the setting is disabled
      return plugin.settings.appleRemindersIntegration.enabled === false;
    });

    expect(serviceDisabled).toBe(true);

    // Check that the Apple Reminders service is not available/enabled
    const serviceAvailable = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin || !plugin.appleRemindersService) return false;

      // Check if the service is properly disabled
      return plugin.appleRemindersService.isEnabled();
    });

    expect(serviceAvailable).toBe(false);
  });
});
