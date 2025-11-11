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

  // Stub Apple Reminders APIs by intercepting AppleScript execution
  await page.route("**", async (route) => {
    const request = route.request();
    
    // Only intercept requests that would trigger AppleScript execution
    if (request.url().includes("apple-reminders") || 
        request.method() === "POST" && request.postData()?.includes("osascript")) {
      
      const postData = request.postData();
      
      // Check permissions request
      if (postData?.includes("authorization status")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: permissionsData }),
        });
        return;
      }
      
      // Check lists request
      if (postData?.includes("get every list")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: listsData }),
        });
        return;
      }
      
      // Check reminders request
      if (postData?.includes("get every reminder")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: remindersData }),
        });
        return;
      }
    }
    
    // Continue with original request for non-Apple Reminders requests
    await route.continue();
  });

  // Mock the node-osascript module at the extension level
  await page.addInitScript(() => {
    // Mock the AppleScript execution in the extension
    (window as any).__mockAppleScript = {
      permissions: permissionsData,
      lists: listsData,
      reminders: remindersData,
    };
  });
}

/**
 * Click the import button for a specific reminder
 */
export async function clickReminderImportButton(
  page: Page,
  reminderTitle: string
): Promise<void> {
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
      const reminderItem = document.querySelector(
        `[data-testid="apple-reminder-item"]:has-text("${title}")`
      );
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
  // Wait a bit for notices to appear
  await page.waitForTimeout(100);

  // Click on any visible notices to dismiss them
  const notices = page.locator(".notice-container .notice");
  const noticeCount = await notices.count();

  if (noticeCount > 0) {
    for (let i = 0; i < noticeCount; i++) {
      try {
        const notice = notices.nth(i);
        if (await notice.isVisible()) {
          await notice.click();
          await page.waitForTimeout(100);
        }
      } catch (error) {
        // Ignore errors when dismissing notices
      }
    }
  }

  // Wait for notices to disappear
  await page.waitForTimeout(300);
}
