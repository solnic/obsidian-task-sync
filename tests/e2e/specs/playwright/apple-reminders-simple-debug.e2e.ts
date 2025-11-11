import { test } from "../../helpers/setup";
import { openView, enableIntegration } from "../../helpers/global";
import { stubAppleRemindersWithFixtures } from "../../helpers/apple-reminders-integration-helpers";

test.describe("Apple Reminders Simple Debug", () => {
  test("should enable Apple Reminders and check service button", async ({ page }) => {
    // Set up Apple Reminders stubs BEFORE opening the view
    console.log("Setting up Apple Reminders stubs...");
    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    // Verify that stub data is set up
    const stubDataExists = await page.evaluate(() => {
      return !!(window as any).__appleRemindersApiStubs;
    });
    console.log("Stub data exists:", stubDataExists);

    // Open the Task Sync view using the proper helper
    await openView(page, "task-sync-main");

    console.log("Enabling Apple Reminders integration...");
    try {
      await enableIntegration(page, "appleReminders");
      console.log("Apple Reminders integration enabled successfully");
    } catch (error) {
      console.error("Failed to enable Apple Reminders integration:", error);
    }

    // Wait a bit for the UI to update
    await page.waitForTimeout(2000);

    // Check if service buttons appear
    const serviceButtons = await page.locator('[data-testid^="service-"]').all();
    console.log("Service buttons found:", serviceButtons.length);

    for (const button of serviceButtons) {
      const testId = await button.getAttribute('data-testid');
      console.log("Service button:", testId);
    }

    // Specifically check for Apple Reminders service button
    const appleRemindersButton = page.locator('[data-testid="service-apple-reminders"]');
    const appleRemindersExists = await appleRemindersButton.count() > 0;
    console.log("Apple Reminders service button exists:", appleRemindersExists);

    if (appleRemindersExists) {
      const isVisible = await appleRemindersButton.isVisible();
      console.log("Apple Reminders service button visible:", isVisible);
    }

    // Check if Apple Reminders extension exists in the app
    const hasAppleRemindersExtension = await page.evaluate(() => {
      const obsidianApp = (window as any).app;
      const plugin = obsidianApp.plugins.plugins["obsidian-task-sync"];
      const customApp = plugin.host.getApp();
      return !!customApp.appleRemindersExtension;
    });
    console.log("hasAppleRemindersExtension:", hasAppleRemindersExtension);

    if (hasAppleRemindersExtension) {
      const extensionInitialized = await page.evaluate(() => {
        const obsidianApp = (window as any).app;
        const plugin = obsidianApp.plugins.plugins["obsidian-task-sync"];
        const customApp = plugin.host.getApp();
        return customApp.appleRemindersExtension.initialized;
      });
      console.log("extensionInitialized:", extensionInitialized);
    }
  });
});
