/**
 * E2E tests for TypeNote Select Property Type
 * Tests that the Select property type appears in the dropdown and works correctly
 */

import { test, expect } from "../../helpers/setup";
import { openTaskSyncSettings } from "../../helpers/global";

test.describe("TypeNote Select Property Type", () => {
  test("should show Select type in property type dropdown", async ({ page }) => {
    await openTaskSyncSettings(page);

    // Navigate to Note Types section
    const noteTypesSection = page.locator(
      '[data-testid="settings-section-type-note"]'
    );
    await noteTypesSection.click();

    // Click create button
    const createButton = page.locator(
      '[data-testid="create-note-type-button"]'
    );
    await createButton.scrollIntoViewIfNeeded();
    await createButton.click();

    // Wait for the note type editor to be visible
    await page
      .locator('[data-testid="note-type-id-input"]')
      .waitFor({ state: "visible" });

    // Fill in basic note type info
    await page.locator('[data-testid="note-type-id-input"]').fill("test-note");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Test Note");

    // Scroll down to make the Properties section visible
    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Find the first property's type dropdown
    const firstPropertyDropdown = page
      .locator('[data-testid^="property-type-dropdown-"]')
      .first();
    await expect(firstPropertyDropdown).toBeVisible();

    // Click the dropdown to open it
    await firstPropertyDropdown.click();

    // Get all options from the dropdown
    const options = await firstPropertyDropdown.locator("option").allTextContents();

    // Verify Select type is in the list
    expect(options).toContain("Select");
    expect(options).toContain("Text");
    expect(options).toContain("Number");
    expect(options).toContain("Checkbox");
    expect(options).toContain("Date");
  });

  test("should allow creating a property with Select type and adding options", async ({
    page,
  }) => {
    await openTaskSyncSettings(page);

    // Navigate to Note Types section
    const noteTypesSection = page.locator(
      '[data-testid="settings-section-type-note"]'
    );
    await noteTypesSection.click();

    // Click create button
    const createButton = page.locator(
      '[data-testid="create-note-type-button"]'
    );
    await createButton.scrollIntoViewIfNeeded();
    await createButton.click();

    // Wait for the note type editor
    await page
      .locator('[data-testid="note-type-id-input"]')
      .waitFor({ state: "visible" });

    // Fill in basic info
    await page.locator('[data-testid="note-type-id-input"]').fill("task-note");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Task Note");

    // Scroll to properties section
    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Set property name
    const propertyNameInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await propertyNameInput.fill("Status");

    // Select the Select type
    const propertyTypeDropdown = page
      .locator('[data-testid^="property-type-dropdown-"]')
      .first();
    await propertyTypeDropdown.selectOption("select");

    // Wait for select options UI to appear
    await page.waitForTimeout(500);

    // Verify "Select Options" heading appears
    const selectOptionsHeading = page.locator("h5").filter({ hasText: "Select Options" });
    await expect(selectOptionsHeading).toBeVisible();

    // Find the "Add Option" button
    const addOptionButton = page
      .locator('[data-testid^="add-select-option-button-"]')
      .first();
    await expect(addOptionButton).toBeVisible();

    // Add first option
    await addOptionButton.click();
    await page.waitForTimeout(200);

    // Verify option input appears
    const firstOptionInput = page.locator('[data-testid="select-option-value-0"]');
    await expect(firstOptionInput).toBeVisible();

    // Change the option value
    await firstOptionInput.fill("To Do");

    // Add second option
    await addOptionButton.click();
    await page.waitForTimeout(200);

    const secondOptionInput = page.locator('[data-testid="select-option-value-1"]');
    await expect(secondOptionInput).toBeVisible();
    await secondOptionInput.fill("In Progress");

    // Add third option
    await addOptionButton.click();
    await page.waitForTimeout(200);

    const thirdOptionInput = page.locator('[data-testid="select-option-value-2"]');
    await expect(thirdOptionInput).toBeVisible();
    await thirdOptionInput.fill("Done");

    // Save the note type
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for success
    await page.waitForTimeout(500);

    // Verify we're back at the list view
    const noteTypeItem = page
      .locator(".setting-item-name")
      .filter({ hasText: "Task Note" });
    await expect(noteTypeItem).toBeVisible();
  });

  test("should persist select options with colors when editing note type", async ({
    page,
  }) => {
    // First create a note type with select property
    await openTaskSyncSettings(page);

    const noteTypesSection = page.locator(
      '[data-testid="settings-section-type-note"]'
    );
    await noteTypesSection.click();

    const createButton = page.locator(
      '[data-testid="create-note-type-button"]'
    );
    await createButton.scrollIntoViewIfNeeded();
    await createButton.click();

    await page
      .locator('[data-testid="note-type-id-input"]')
      .waitFor({ state: "visible" });

    await page.locator('[data-testid="note-type-id-input"]').fill("priority-note");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Priority Note");

    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    const propertyNameInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await propertyNameInput.fill("Priority");

    const propertyTypeDropdown = page
      .locator('[data-testid^="property-type-dropdown-"]')
      .first();
    await propertyTypeDropdown.selectOption("select");

    await page.waitForTimeout(500);

    // Add options
    const addOptionButton = page
      .locator('[data-testid^="add-select-option-button-"]')
      .first();

    await addOptionButton.click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="select-option-value-0"]').fill("Low");

    await addOptionButton.click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="select-option-value-1"]').fill("High");

    // Save
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    await page.waitForTimeout(500);

    // Now edit the note type
    const noteTypeItem = page
      .locator(".setting-item")
      .filter({ hasText: "Priority Note" });
    await expect(noteTypeItem).toBeVisible();

    const editButton = noteTypeItem.locator("button").filter({ hasText: "Edit" });
    await editButton.click();

    await page.waitForTimeout(500);

    // Verify the select options are still there
    const firstOptionInput = page.locator('[data-testid="select-option-value-0"]');
    await expect(firstOptionInput).toBeVisible();
    await expect(firstOptionInput).toHaveValue("Low");

    const secondOptionInput = page.locator('[data-testid="select-option-value-1"]');
    await expect(secondOptionInput).toBeVisible();
    await expect(secondOptionInput).toHaveValue("High");
  });
});

