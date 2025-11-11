/**
 * Debug test for Apple Reminders Integration
 * Tests Apple Reminders extension initialization and service visibility
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
} from "../../helpers/global";
import {
  stubAppleRemindersWithFixtures,
} from "../../helpers/apple-reminders-integration-helpers";

test.describe("Apple Reminders Debug", () => {
  test("should debug Apple Reminders extension initialization", async ({ page }) => {
    await openView(page, "task-sync-main");

    // Check platform before stubbing
    const platformBefore = await page.evaluate(() => process.platform);
    console.log("Platform before stubbing:", platformBefore);

    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    // Check platform after stubbing
    const platformAfter = await page.evaluate(() => process.platform);
    console.log("Platform after stubbing:", platformAfter);

    await enableIntegration(page, "appleReminders");

    // Check what methods are available on the app object
    const appMethodsResult = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin?.app) {
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(plugin.app))
          .filter(name => typeof plugin.app[name] === 'function');

        return {
          success: true,
          methods,
          initialized: plugin.app.initialized,
          loaded: plugin.app.loaded,
          hasAppleRemindersExtension: !!plugin.app.appleRemindersExtension,
        };
      }
      return { success: false, error: "No plugin app found" };
    });

    console.log("App methods result:", JSON.stringify(appMethodsResult, null, 2));

    // Debug: Check if Apple Reminders extension exists
    const debugInfo = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Our custom App class should be accessible via plugin.host.getApp()
      const customApp = plugin?.host?.getApp?.();

      return {
        pluginExists: !!plugin,
        hasObsidianApp: !!plugin?.app,
        hasCustomApp: !!customApp,
        hasAppleRemindersExtension: !!customApp?.appleRemindersExtension,
        appleRemindersExtensionId: customApp?.appleRemindersExtension?.id,
        appleRemindersExtensionEnabled: customApp?.appleRemindersExtension?.isEnabled?.(),
        appleRemindersExtensionPlatformSupported: customApp?.appleRemindersExtension?.isPlatformSupported?.(),
        settings: plugin?.settings?.integrations?.appleReminders,
        platform: process.platform,
        testMode: (window as any).__APPLE_REMINDERS_TEST_MODE,
        // Check if the extension was ever created
        extensionRegistry: Object.keys((window as any).extensionRegistry?.extensions || {}),
        // Check app initialization status
        customAppInitialized: customApp?.initialized,
        customAppLoaded: customApp?.loaded,
      };
    });

    console.log("Debug info:", JSON.stringify(debugInfo, null, 2));

    // Try to manually trigger Apple Reminders extension initialization
    const manualInitResult = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const customApp = plugin?.host?.getApp?.();

      if (customApp) {
        try {
          // Check if the method exists
          const hasMethod = typeof customApp.initializeAppleRemindersExtension === 'function';
          console.log("🔧 Has initializeAppleRemindersExtension method:", hasMethod);

          if (hasMethod) {
            // Try to manually call the initialization method
            console.log("🔧 Calling initializeAppleRemindersExtension manually");
            await customApp.initializeAppleRemindersExtension();
            console.log("🔧 Manual initialization completed");
          } else {
            // Try to create the extension manually for testing
            console.log("🔧 Creating Apple Reminders extension manually for testing");
            const AppleRemindersExtension = (window as any).AppleRemindersExtension;
            if (AppleRemindersExtension) {
              const obsidianApp = (window as any).app;
              const plugin = obsidianApp.plugins.plugins["obsidian-task-sync"];

              customApp.appleRemindersExtension = new AppleRemindersExtension(
                plugin,
                plugin.settings
              );

              // Stub the platform check directly on the instance
              customApp.appleRemindersExtension.isPlatformSupported = () => true;
              customApp.appleRemindersExtension.isEnabled = () => true;

              await customApp.appleRemindersExtension.initialize();
              console.log("🔧 Manual extension creation completed");
            }
          }

          return {
            success: true,
            hasMethod,
            hasExtensionAfterInit: !!customApp.appleRemindersExtension,
            extensionId: customApp.appleRemindersExtension?.id,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      }
      return { success: false, error: "No custom app found" };
    });

    console.log("Manual init result:", JSON.stringify(manualInitResult, null, 2));

    // Check if services array includes Apple Reminders
    const servicesInfo = await page.evaluate(() => {
      // Try to access the TasksView component and its services
      const tasksViewElement = document.querySelector('[data-testid="tasks-view"]');
      const serviceButtons = Array.from(document.querySelectorAll('[data-testid^="service-"]'));

      return {
        tasksViewExists: !!tasksViewElement,
        serviceButtons: serviceButtons.map(btn => ({
          testId: btn.getAttribute('data-testid'),
          disabled: btn.hasAttribute('disabled'),
          visible: !btn.classList.contains('hidden'),
        })),
      };
    });

    console.log("Services info:", JSON.stringify(servicesInfo, null, 2));

    // Wait a bit to see if the service appears
    await page.waitForTimeout(2000);

    // Check again after waiting
    const servicesInfoAfterWait = await page.evaluate(() => {
      const serviceButtons = Array.from(document.querySelectorAll('[data-testid^="service-"]'));

      return {
        serviceButtons: serviceButtons.map(btn => ({
          testId: btn.getAttribute('data-testid'),
          disabled: btn.hasAttribute('disabled'),
          visible: !btn.classList.contains('hidden'),
        })),
      };
    });

    console.log("Services info after wait:", JSON.stringify(servicesInfoAfterWait, null, 2));

    // This test is just for debugging, so we'll pass it
    expect(true).toBe(true);
  });
});
