import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
} from "../../helpers/global";
import { stubAppleRemindersWithFixtures } from "../../helpers/apple-reminders-integration-helpers";

test.describe("Apple Reminders Minimal Test", () => {
  test("should switch to Apple Reminders service without crashing", async ({ page }) => {
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

    // Wait a bit for data to load and button to be enabled
    await page.waitForTimeout(2000);

    // Now wait for it to be enabled
    await page.waitForSelector(
      '[data-testid="service-apple-reminders"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    // Switch to Apple Reminders service
    await switchToTaskService(page, "apple-reminders");

    // Wait for the service to load
    await page.waitForTimeout(3000);

    // Check if the page is still responsive
    const isVisible = await page.isVisible('[data-testid="service-content-apple-reminders"]');
    expect(isVisible).toBe(true);

    // Check what elements are present in the Apple Reminders service
    const elements = await page.evaluate(() => {
      const serviceContent = document.querySelector('[data-testid="service-content-apple-reminders"]');
      if (!serviceContent) return { error: "Service content not found" };

      const dropdowns = Array.from(serviceContent.querySelectorAll('[data-testid*="dropdown"]')).map(el => ({
        testId: el.getAttribute('data-testid'),
        visible: el.offsetParent !== null,
        text: el.textContent?.trim()
      }));

      const buttons = Array.from(serviceContent.querySelectorAll('button')).map(el => ({
        testId: el.getAttribute('data-testid'),
        visible: el.offsetParent !== null,
        text: el.textContent?.trim(),
        disabled: el.disabled
      }));

      const reminderItems = Array.from(serviceContent.querySelectorAll('[data-testid="apple-reminder-item"]')).map(el => ({
        testId: el.getAttribute('data-testid'),
        visible: el.offsetParent !== null,
        text: el.textContent?.trim()
      }));

      return {
        dropdowns,
        buttons,
        reminderItems,
        totalElements: serviceContent.children.length
      };
    });

    console.log("🔍 Apple Reminders service elements:", JSON.stringify(elements, null, 2));

    console.log("✅ Successfully switched to Apple Reminders service without crashing");
  });
});
