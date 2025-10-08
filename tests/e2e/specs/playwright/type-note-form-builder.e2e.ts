/**
 * E2E tests for TypeNote Form Builder improvements
 * Tests property hiding, required/optional separation, and select dropdown rendering
 */

import { test, expect } from "../../helpers/setup";
import { openTaskSyncSettings, executeCommand } from "../../helpers/global";

test.describe("TypeNote Form Builder", () => {
  test("should separate required and optional properties with collapsible section", async ({
    page,
  }) => {
    await openTaskSyncSettings(page);

    // Navigate to Note Types section
    const noteTypesSection = page.locator(
      '[data-testid="settings-section-type-note"]'
    );
    await noteTypesSection.click();

    // Create a note type with both required and optional properties
    const createButton = page.locator(
      '[data-testid="create-note-type-button"]'
    );
    await createButton.scrollIntoViewIfNeeded();
    await createButton.click();

    await page
      .locator('[data-testid="note-type-id-input"]')
      .waitFor({ state: "visible" });

    await page.locator('[data-testid="note-type-id-input"]').fill("test-form");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Test Form");

    // Scroll to properties section
    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Set first property as required
    const firstPropertyName = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await firstPropertyName.fill("Title");

    const firstRequiredToggle = page
      .locator('[data-testid^="property-required-toggle-"]')
      .first();
    await firstRequiredToggle.click(); // Make it required

    // Add a second property (optional)
    const addPropertyButton = page.locator(
      '[data-testid="add-property-button"]'
    );
    await addPropertyButton.click();
    await page.waitForTimeout(300);

    const secondPropertyName = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(1);
    await secondPropertyName.fill("Description");
    // Leave it as optional (don't toggle required)

    // Save the note type
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    await page.waitForTimeout(500);

    // Close settings
    const closeButton = page.locator(".modal-close-button").first();
    await closeButton.click();

    // Open create note modal
    await executeCommand(page, "Task Sync: Create Note");

    await page.waitForTimeout(500);

    // Verify required property is visible
    const titleField = page.locator('[data-testid="property-title"]');
    await expect(titleField).toBeVisible();

    // Verify optional properties section exists
    const optionalSection = page.locator(".optional-properties-toggle");
    await expect(optionalSection).toBeVisible();
    await expect(optionalSection).toContainText("Additional Properties (1)");

    // Optional property should not be visible initially
    const descriptionField = page.locator('[data-testid="property-description"]');
    await expect(descriptionField).not.toBeVisible();

    // Click to expand optional properties
    await optionalSection.click();
    await page.waitForTimeout(200);

    // Now optional property should be visible
    await expect(descriptionField).toBeVisible();
  });

  test("should hide properties marked as hidden in forms", async ({ page }) => {
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

    await page
      .locator('[data-testid="note-type-id-input"]')
      .fill("hidden-prop-test");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Hidden Property Test");

    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Set first property
    const firstPropertyName = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await firstPropertyName.fill("Visible Field");

    // Add second property and hide it
    const addPropertyButton = page.locator(
      '[data-testid="add-property-button"]'
    );
    await addPropertyButton.click();
    await page.waitForTimeout(300);

    const secondPropertyName = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(1);
    await secondPropertyName.fill("Hidden Field");

    // Toggle "Hide in forms"
    const hideInFormsToggle = page
      .locator('[data-testid^="property-hide-in-forms-toggle-"]')
      .nth(1);
    await hideInFormsToggle.click();

    // Save
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    await page.waitForTimeout(500);

    // Close settings
    const closeButton = page.locator(".modal-close-button").first();
    await closeButton.click();

    // Open create note modal
    await executeCommand(page, "Task Sync: Create Note");

    await page.waitForTimeout(500);

    // Verify visible field is shown
    const visibleField = page.locator('[data-testid="property-visibleField"]');
    await expect(visibleField).toBeVisible();

    // Verify hidden field is NOT shown
    const hiddenField = page.locator('[data-testid="property-hiddenField"]');
    await expect(hiddenField).not.toBeVisible();
  });

  test("should render select dropdowns without overflow issues", async ({
    page,
  }) => {
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

    await page
      .locator('[data-testid="note-type-id-input"]')
      .fill("select-test");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Select Test");

    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Create a select property
    const propertyName = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await propertyName.fill("Status");

    const propertyType = page
      .locator('[data-testid^="property-type-dropdown-"]')
      .first();
    await propertyType.selectOption("select");

    await page.waitForTimeout(500);

    // Add select options
    const addOptionButton = page
      .locator('[data-testid^="add-select-option-button-"]')
      .first();

    await addOptionButton.click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="select-option-value-0"]').fill("Active");

    await addOptionButton.click();
    await page.waitForTimeout(200);
    await page
      .locator('[data-testid="select-option-value-1"]')
      .fill("Inactive");

    // Save
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    await page.waitForTimeout(500);

    // Close settings
    const closeButton = page.locator(".modal-close-button").first();
    await closeButton.click();

    // Open create note modal
    await executeCommand(page, "Task Sync: Create Note");

    await page.waitForTimeout(500);

    // Verify select dropdown is visible and functional
    const statusSelect = page.locator('[data-testid="property-status"]');
    await expect(statusSelect).toBeVisible();

    // Check that the select has the correct options
    const options = await statusSelect.locator("option").allTextContents();
    expect(options).toContain("Active");
    expect(options).toContain("Inactive");

    // Verify the select can be interacted with (not clipped)
    await statusSelect.selectOption("Active");
    await expect(statusSelect).toHaveValue("Active");
  });
});

