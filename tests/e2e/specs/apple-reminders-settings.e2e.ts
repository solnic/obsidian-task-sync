/**
 * E2E tests for Apple Reminders Settings
 * Tests the list selection UI in settings
 */

import { test, expect } from "../helpers/setup";
import {
  openTaskSyncSettings,
  scrollToSettingsSection,
} from "../helpers/global";
import { stubAppleRemindersWithFixtures } from "../helpers/apple-reminders-integration-helpers";

test.describe("Apple Reminders Settings", () => {
  test("should allow selecting reminder lists in settings", async ({
    page,
  }) => {
    // Set up stubs BEFORE opening settings
    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    // Open settings
    await openTaskSyncSettings(page);

    // Navigate to integrations section
    await scrollToSettingsSection(page, "Integrations");

    // Find Apple Reminders integration section
    const appleRemindersSection = page.locator(
      'h3:has-text("Apple Reminders")'
    );
    await expect(appleRemindersSection).toBeVisible();

    // Enable Apple Reminders integration if not already enabled
    const enableToggle = page.locator(
      '.setting-item:has-text("Enable Apple Reminders Integration") input[type="checkbox"]'
    );
    await expect(enableToggle).toBeVisible({ timeout: 10000 });

    const isEnabled = await enableToggle.isChecked();

    if (!isEnabled) {
      await enableToggle.click();
      // Wait for settings to expand
      await page.waitForTimeout(2000);
    }

    // Wait for the Reminder Lists setting to appear
    const reminderListsSetting = page.locator(
      '.setting-item:has-text("Reminder Lists")'
    );
    await expect(reminderListsSetting).toBeVisible({ timeout: 10000 });

    // Find the lists button (should show "All lists" initially or after lists are loaded)
    const listsButton = reminderListsSetting.locator("button").first();
    await expect(listsButton).toBeVisible();

    // Click the button - if lists aren't loaded, this will trigger loading
    await listsButton.click();

    // Wait for lists to load (give it time to fetch)
    await page.waitForTimeout(3000);

    //Check if we need to click again to open dropdown
    const dropdownVisible = await page
      .locator('[data-testid="apple-reminders-lists-dropdown"]')
      .isVisible()
      .catch(() => false);

    if (!dropdownVisible) {
      await listsButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for dropdown to appear
    const dropdown = page.locator(
      '[data-testid="apple-reminders-lists-dropdown"]'
    );
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Verify lists are shown in dropdown
    const workList = dropdown.locator(
      '.task-sync-selector-item:has-text("Work")'
    );
    const personalList = dropdown.locator(
      '.task-sync-selector-item:has-text("Personal")'
    );

    await expect(workList).toBeVisible();
    await expect(personalList).toBeVisible();

    // Select "Work" list
    await workList.click();

    // Wait a moment for the update to process
    await page.waitForTimeout(500);

    // Check button text - should now show "1 list selected"
    const updatedButtonText = await listsButton.textContent();
    expect(updatedButtonText).toContain("1 list");

    // Verify the dropdown is still open (multi-select)
    await expect(dropdown).toBeVisible();

    // Select "Personal" list as well
    await personalList.click();

    // Wait for update
    await page.waitForTimeout(500);

    // Check button text - should now show "2 lists selected"
    const finalButtonText = await listsButton.textContent();
    expect(finalButtonText).toContain("2 list");

    // Close dropdown by clicking outside
    await page.keyboard.press("Escape");

    // Verify dropdown is closed
    await expect(dropdown).not.toBeVisible();

    // Verify settings were saved by checking plugin settings
    const savedLists = await page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.integrations.appleReminders.reminderLists;
    });

    expect(savedLists).toEqual(["Work", "Personal"]);

    // Close settings
    await page.keyboard.press("Escape");
  });

  test("should deselect lists when clicked again", async ({ page }) => {
    // Set up stubs
    await stubAppleRemindersWithFixtures(page, {
      permissions: "permissions-authorized",
      lists: "lists-basic",
      reminders: "reminders-basic",
    });

    // Open settings and navigate to Apple Reminders
    await openTaskSyncSettings(page);
    await scrollToSettingsSection(page, "Integrations");

    // Enable if needed
    const enableToggle = page.locator(
      '.setting-item:has-text("Enable Apple Reminders Integration") input[type="checkbox"]'
    );
    const isEnabled = await enableToggle.isChecked();
    if (!isEnabled) {
      await enableToggle.click();
      await page.waitForTimeout(500);
    }

    // Find lists button
    const reminderListsSetting = page.locator(
      '.setting-item:has-text("Reminder Lists")'
    );
    const listsButton = reminderListsSetting.locator("button").first();

    // Open dropdown
    await listsButton.click();
    const dropdown = page.locator(
      '[data-testid="apple-reminders-lists-dropdown"]'
    );
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Select Work list
    const workList = dropdown.locator(
      '.task-sync-selector-item:has-text("Work")'
    );
    await workList.click();
    await page.waitForTimeout(500);

    // Verify 1 list selected
    let buttonText = await listsButton.textContent();
    expect(buttonText).toContain("1 list");

    // Deselect by clicking again
    await workList.click();
    await page.waitForTimeout(500);

    // Verify back to "All lists"
    buttonText = await listsButton.textContent();
    expect(buttonText).toContain("All lists");

    // Verify settings
    const savedLists = await page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.integrations.appleReminders.reminderLists;
    });

    expect(savedLists).toEqual([]);

    // Close
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });
});
