import type { Page } from "playwright";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Apple Reminders Integration helpers for e2e tests
 * Provides reusable functions for Apple Reminders integration testing
 */

/**
 * Fixture configuration for Apple Reminders stubbing
 */
interface AppleRemindersFixtures {
  permissions: string;
  lists: string;
  reminders: string;
}

/**
 * Stub Apple Reminders APIs with fixture data
 */
export async function stubAppleRemindersWithFixtures(
  page: Page,
  fixtures: AppleRemindersFixtures
): Promise<void> {
  const fixturesPath = join(__dirname, "../fixtures/apple-reminders");

  // Load fixture data
  const permissionsData = readFileSync(
    join(fixturesPath, `${fixtures.permissions}.json`),
    "utf-8"
  ).trim();

  const listsData = JSON.parse(
    readFileSync(join(fixturesPath, `${fixtures.lists}.json`), "utf-8")
  );

  const remindersData = JSON.parse(
    readFileSync(join(fixturesPath, `${fixtures.reminders}.json`), "utf-8")
  );

  // Set up stubs using page.evaluate instead of addInitScript
  await page.evaluate((fixtureData) => {
    console.log("🔧 Setting up Apple Reminders stub data...");

    // Store fixture data globally
    (window as any).__appleRemindersApiStubs = fixtureData;

    // Create a global stub installer that can be called after plugin reloads
    (window as any).__installAppleRemindersStubs = () => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

      // Access Apple Reminders extension through the new architecture
      const appleRemindersExtension = plugin?.taskSyncApp?.appleRemindersExtension;
      if (!appleRemindersExtension) {
        console.log("🔧 Apple Reminders extension not found for stubbing");
        return false;
      }

      console.log("🔧 Found Apple Reminders extension, installing stubs");

      // Stub platform check to always return true for testing
      if (!appleRemindersExtension.__originalIsPlatformSupported) {
        appleRemindersExtension.__originalIsPlatformSupported = appleRemindersExtension.isPlatformSupported;
        appleRemindersExtension.isPlatformSupported = () => true;

        // Also stub isEnabled to return true for testing
        if (!appleRemindersExtension.__originalIsEnabled) {
          appleRemindersExtension.__originalIsEnabled = appleRemindersExtension.isEnabled;
          appleRemindersExtension.isEnabled = () => true;
        }
      }

      // Only stub if not already stubbed
      if (appleRemindersExtension.__isStubbed) {
        return true;
      }

      // Store originals
      appleRemindersExtension.__originals = {
        executeAppleScript: appleRemindersExtension.executeAppleScript,
        fetchReminders: appleRemindersExtension.fetchReminders,
        fetchLists: appleRemindersExtension.fetchLists,
        checkPermissions: appleRemindersExtension.checkPermissions,
        clearCache: appleRemindersExtension.clearCache,
      };

      // Note: The stub logic is now in AppleRemindersExtension.executeAppleScript
      // We just need to ensure the stub data is available on window
      console.log("🔧 Apple Reminders stub data installed on window.__appleRemindersApiStubs");

      // Mark as stubbed
      appleRemindersExtension.__isStubbed = true;
      console.log("🔧 Apple Reminders stubs installed successfully");
      return true;
    };

    console.log("🔧 Apple Reminders stub data and installer set up successfully");
  }, {
    permissions: permissionsData,
    lists: listsData,
    reminders: remindersData,
  });
}

/**
 * Click the import button for a specific reminder
 */
export async function clickReminderImportButton(
  page: Page,
  reminderTitle: string
): Promise<void> {
  // First, find and hover over the reminder item to show the action overlay
  const reminderItem = page.locator(
    `[data-testid="apple-reminder-item"]:has-text("${reminderTitle}")`
  );

  await reminderItem.waitFor({ state: "visible", timeout: 5000 });
  await reminderItem.hover();

  // Wait for the import button to appear after hover
  const importButton = page.locator(
    `[data-testid="apple-reminder-item"]:has-text("${reminderTitle}") [data-testid="import-reminder-button"]`
  );

  await importButton.waitFor({ state: "visible", timeout: 5000 });
  await importButton.click();
}

/**
 * Wait for reminder import to complete
 */
export async function waitForReminderImportComplete(
  page: Page,
  reminderTitle: string
): Promise<void> {
  // Wait for the import button to show "Imported" state or disappear
  await page.waitForFunction(
    (title) => {
      // Find all reminder items and check their text content
      const reminderItems = document.querySelectorAll(
        '[data-testid="apple-reminder-item"]'
      );
      let reminderItem = null;

      for (const item of reminderItems) {
        if (item.textContent && item.textContent.includes(title)) {
          reminderItem = item;
          break;
        }
      }

      if (!reminderItem) return false;

      const importButton = reminderItem.querySelector(
        '[data-testid="import-reminder-button"]'
      );

      // Button should either be disabled with "Imported" text or not visible
      return (
        !importButton ||
        importButton.textContent?.includes("Imported") ||
        (importButton as HTMLButtonElement).disabled
      );
    },
    reminderTitle,
    { timeout: 10000 }
  );
}

/**
 * Dismiss any visible notices that might block UI interactions
 */
export async function dismissNotices(page: Page): Promise<void> {
  // Wait for any notices to appear using Playwright's auto-waiting
  const notices = page.locator(".notice-container .notice");

  // Check if any notices are visible
  const noticeCount = await notices.count();

  if (noticeCount > 0) {
    for (let i = 0; i < noticeCount; i++) {
      try {
        const notice = notices.nth(i);
        if (await notice.isVisible()) {
          await notice.click();
        }
      } catch (error) {
        // Ignore errors when dismissing notices
      }
    }
  }

  // Wait for all notices to be gone
  await page
    .waitForSelector(".notice-container .notice", {
      state: "hidden",
      timeout: 3000,
    })
    .catch(() => {
      // Ignore timeout - notices may have already disappeared
    });
}
