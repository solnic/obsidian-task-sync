/**
 * E2E tests for TypeNote Settings Property Management
 * Tests the property management interface in the settings editor
 */

import { test, expect } from "../../helpers/setup";
import { openTaskSyncSettings } from "../../helpers/global";

test.describe("TypeNote Settings - Property Management", () => {
  test.beforeEach(async ({ page }) => {
    await openTaskSyncSettings(page);

    // Navigate to Note Types section
    const noteTypesSection = page.locator(
      '[data-testid="settings-section-note-types"]'
    );
    await noteTypesSection.click();

    // Click create button to open the editor
    const createButton = page.locator(
      '[data-testid="create-note-type-button"]'
    );
    await createButton.click();
  });

  test("should add a new property without clearing existing property settings", async ({
    page,
  }) => {
    // Fill in basic note type info
    await page.locator('[data-testid="note-type-id-input"]').fill("test-note");
    await page.locator('[data-testid="note-type-name-input"]').fill("Test Note");

    // Find the first property (should be "New Property" by default)
    const firstPropertyName = page.locator('.setting-item-name').filter({ hasText: 'New Property' }).first();
    await expect(firstPropertyName).toBeVisible();

    // Change the first property's name
    const firstPropertyInput = page.locator('.setting-item').filter({ has: firstPropertyName }).locator('input[type="text"]').first();
    await firstPropertyInput.fill("Priority");

    // Change the first property's type to Number
    const firstPropertyDropdown = page.locator('.setting-item').filter({ has: firstPropertyName }).locator('select').first();
    await firstPropertyDropdown.selectOption("number");

    // Toggle the first property's required status
    const firstPropertyToggle = page.locator('.setting-item').filter({ has: firstPropertyName }).locator('input[type="checkbox"]').first();
    await firstPropertyToggle.click();

    // Verify the property settings are still set correctly
    await expect(firstPropertyInput).toHaveValue("Priority");
    await expect(firstPropertyDropdown).toHaveValue("number");
    await expect(firstPropertyToggle).toBeChecked();

    // Now click "Add Property" button
    const addPropertyButton = page.locator('button').filter({ hasText: 'Add Property' });
    await addPropertyButton.click();

    // Verify the first property settings are STILL correct after adding new property
    await expect(firstPropertyInput).toHaveValue("Priority");
    await expect(firstPropertyDropdown).toHaveValue("number");
    await expect(firstPropertyToggle).toBeChecked();

    // Verify a second property was added
    const allPropertySettings = page.locator('.setting-item-name').filter({ hasText: 'New Property' });
    await expect(allPropertySettings).toHaveCount(1); // One new property should exist
  });

  test("should preserve type when toggling required status", async ({ page }) => {
    // Fill in basic note type info
    await page.locator('[data-testid="note-type-id-input"]').fill("test-note");
    await page.locator('[data-testid="note-type-name-input"]').fill("Test Note");

    // Find the first property
    const firstPropertyName = page.locator('.setting-item-name').filter({ hasText: 'New Property' }).first();
    await expect(firstPropertyName).toBeVisible();

    // Change the property's type to Number
    const propertyDropdown = page.locator('.setting-item').filter({ has: firstPropertyName }).locator('select').first();
    await propertyDropdown.selectOption("number");

    // Verify type is Number
    await expect(propertyDropdown).toHaveValue("number");

    // Toggle required status
    const propertyToggle = page.locator('.setting-item').filter({ has: firstPropertyName }).locator('input[type="checkbox"]').first();
    await propertyToggle.click();

    // Verify type is STILL Number (not reset to Text)
    await expect(propertyDropdown).toHaveValue("number");
    await expect(propertyToggle).toBeChecked();

    // Toggle required status again
    await propertyToggle.click();

    // Verify type is STILL Number
    await expect(propertyDropdown).toHaveValue("number");
    await expect(propertyToggle).not.toBeChecked();
  });

  test("should preserve required status when changing type", async ({ page }) => {
    // Fill in basic note type info
    await page.locator('[data-testid="note-type-id-input"]').fill("test-note");
    await page.locator('[data-testid="note-type-name-input"]').fill("Test Note");

    // Find the first property
    const firstPropertyName = page.locator('.setting-item-name').filter({ hasText: 'New Property' }).first();
    await expect(firstPropertyName).toBeVisible();

    // Toggle required status to true
    const propertyToggle = page.locator('.setting-item').filter({ has: firstPropertyName }).locator('input[type="checkbox"]').first();
    await propertyToggle.click();

    // Verify required is checked
    await expect(propertyToggle).toBeChecked();

    // Change type to Number
    const propertyDropdown = page.locator('.setting-item').filter({ has: firstPropertyName }).locator('select').first();
    await propertyDropdown.selectOption("number");

    // Verify required is STILL checked (not reset to false)
    await expect(propertyToggle).toBeChecked();
    await expect(propertyDropdown).toHaveValue("number");

    // Change type to Boolean
    await propertyDropdown.selectOption("boolean");

    // Verify required is STILL checked
    await expect(propertyToggle).toBeChecked();
    await expect(propertyDropdown).toHaveValue("boolean");

    // Change type to Date
    await propertyDropdown.selectOption("date");

    // Verify required is STILL checked
    await expect(propertyToggle).toBeChecked();
    await expect(propertyDropdown).toHaveValue("date");
  });

  test("should update description text when changing property settings", async ({ page }) => {
    // Fill in basic note type info
    await page.locator('[data-testid="note-type-id-input"]').fill("test-note");
    await page.locator('[data-testid="note-type-name-input"]').fill("Test Note");

    // Find the first property
    const firstPropertyName = page.locator('.setting-item-name').filter({ hasText: 'New Property' }).first();
    const propertyItem = page.locator('.setting-item').filter({ has: firstPropertyName });
    const propertyDesc = propertyItem.locator('.setting-item-description');

    // Initial description should show "Type: Text | Required: No"
    await expect(propertyDesc).toContainText("Type: Text");
    await expect(propertyDesc).toContainText("Required: No");

    // Change type to Number
    const propertyDropdown = propertyItem.locator('select').first();
    await propertyDropdown.selectOption("number");

    // Description should update to show "Type: Number | Required: No"
    await expect(propertyDesc).toContainText("Type: Number");
    await expect(propertyDesc).toContainText("Required: No");

    // Toggle required
    const propertyToggle = propertyItem.locator('input[type="checkbox"]').first();
    await propertyToggle.click();

    // Description should update to show "Type: Number | Required: Yes"
    await expect(propertyDesc).toContainText("Type: Number");
    await expect(propertyDesc).toContainText("Required: Yes");
  });
});

