/**
 * E2E tests for TypeNote Modal Components
 * Tests the complete modal system for note type management and creation
 */

import { test, expect } from "../../helpers/setup";
import { openTaskSyncSettings } from "../../helpers/global";

test.describe("TypeNote Modal System", () => {
  test.describe("Note Type Creation Form", () => {
    test("should open note type creation form", async ({ page }) => {
      await openTaskSyncSettings(page);

      // Navigate to Note Types section
      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      // Click create button
      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Verify form is displayed
      const formHeader = page.locator(".form-header h3");
      await expect(formHeader).toContainText("Create Note Type");

      // Verify form fields are present
      await expect(
        page.locator('[data-testid="note-type-id-input"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="note-type-name-input"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="note-type-version-input"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="note-type-category-input"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="note-type-description-input"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="template-content-input"]')
      ).toBeVisible();

      // Verify action buttons
      await expect(
        page.locator('[data-testid="save-note-type-button"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="cancel-form-button"]')
      ).toBeVisible();

      await page.keyboard.press("Escape");
    });

    test("should fill out basic note type information", async ({ page }) => {
      await openTaskSyncSettings(page);

      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Fill out form fields
      await page.locator('[data-testid="note-type-id-input"]').fill("meeting");
      await page
        .locator('[data-testid="note-type-name-input"]')
        .fill("Meeting Notes");
      await page
        .locator('[data-testid="note-type-version-input"]')
        .fill("1.0.0");
      await page
        .locator('[data-testid="note-type-category-input"]')
        .fill("Planning");
      await page
        .locator('[data-testid="note-type-description-input"]')
        .fill("Template for meeting notes with agenda and action items");

      // Verify values are entered correctly
      await expect(
        page.locator('[data-testid="note-type-id-input"]')
      ).toHaveValue("meeting");
      await expect(
        page.locator('[data-testid="note-type-name-input"]')
      ).toHaveValue("Meeting Notes");
      await expect(
        page.locator('[data-testid="note-type-version-input"]')
      ).toHaveValue("1.0.0");
      await expect(
        page.locator('[data-testid="note-type-category-input"]')
      ).toHaveValue("Planning");
      await expect(
        page.locator('[data-testid="note-type-description-input"]')
      ).toHaveValue("Template for meeting notes with agenda and action items");

      await page.keyboard.press("Escape");
    });

    test("should fill out template content", async ({ page }) => {
      await openTaskSyncSettings(page);

      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Fill template content
      const templateContent = `# Meeting: {{title}}

**Date:** {{date}}
**Description:** {{description}}

## Agenda
-

## Notes
-

## Action Items
- [ ]

## Next Steps
- `;

      await page
        .locator('[data-testid="template-content-input"]')
        .fill(templateContent);

      // Verify template content is entered
      await expect(
        page.locator('[data-testid="template-content-input"]')
      ).toHaveValue(templateContent);

      await page.keyboard.press("Escape");
    });

    test("should cancel form and return to list", async ({ page }) => {
      await openTaskSyncSettings(page);

      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Fill some data
      await page.locator('[data-testid="note-type-id-input"]').fill("test");

      // Cancel form
      const cancelButton = page.locator('[data-testid="cancel-form-button"]');
      await cancelButton.click();

      // Verify we're back to the list view
      await expect(page.locator(".form-header")).not.toBeVisible();
      await expect(
        page.locator('[data-testid="create-note-type-button"]')
      ).toBeVisible();

      await page.keyboard.press("Escape");
    });
  });

  test.describe("Form Validation", () => {
    test("should show placeholder text in form fields", async ({ page }) => {
      await openTaskSyncSettings(page);

      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Verify placeholder text
      await expect(
        page.locator('[data-testid="note-type-id-input"]')
      ).toHaveAttribute("placeholder", "e.g., article, meeting, task");
      await expect(
        page.locator('[data-testid="note-type-name-input"]')
      ).toHaveAttribute("placeholder", "e.g., Article, Meeting Notes, Task");
      await expect(
        page.locator('[data-testid="note-type-category-input"]')
      ).toHaveAttribute("placeholder", "e.g., Documentation, Planning");
      await expect(
        page.locator('[data-testid="note-type-description-input"]')
      ).toHaveAttribute(
        "placeholder",
        "Describe what this note type is used for..."
      );

      // Verify template placeholder contains guidance
      const templatePlaceholder = await page
        .locator('[data-testid="template-content-input"]')
        .getAttribute("placeholder");
      expect(templatePlaceholder).toContain("Enter your template content here");
      expect(templatePlaceholder).toContain(
        "Use double curly braces for variables"
      );

      await page.keyboard.press("Escape");
    });

    test("should have default version value", async ({ page }) => {
      await openTaskSyncSettings(page);

      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Verify default version
      await expect(
        page.locator('[data-testid="note-type-version-input"]')
      ).toHaveValue("1.0.0");

      await page.keyboard.press("Escape");
    });
  });

  test.describe("Form Sections", () => {
    test("should display all form sections with proper headings", async ({
      page,
    }) => {
      await openTaskSyncSettings(page);

      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Verify section headings
      const sections = page.locator(".form-section h4");
      await expect(sections.nth(0)).toContainText("Basic Information");
      await expect(sections.nth(1)).toContainText("Properties");
      await expect(sections.nth(2)).toContainText("Template");

      // Verify section notes about future implementation
      const propertiesNote = page
        .locator(".form-section")
        .nth(1)
        .locator(".section-note");
      await expect(propertiesNote).toContainText(
        "Property definition interface with schema builder is available as a separate component"
      );

      const templateNote = page
        .locator(".form-section")
        .nth(2)
        .locator(".section-note");
      await expect(templateNote).toContainText(
        "Template editor with syntax highlighting is available as a separate component"
      );

      await page.keyboard.press("Escape");
    });

    test("should have proper form layout and styling", async ({ page }) => {
      await openTaskSyncSettings(page);

      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Verify form grid layout for basic information
      const formGrid = page.locator(".form-grid");
      await expect(formGrid).toBeVisible();

      // Verify form fields are properly arranged
      const formFields = formGrid.locator(".form-field");
      await expect(formFields).toHaveCount(4); // ID, Name, Version, Category

      // Verify labels are present
      await expect(page.locator('label[for="note-type-id"]')).toContainText(
        "ID *"
      );
      await expect(page.locator('label[for="note-type-name"]')).toContainText(
        "Name *"
      );
      await expect(
        page.locator('label[for="note-type-version"]')
      ).toContainText("Version");
      await expect(
        page.locator('label[for="note-type-category"]')
      ).toContainText("Category");
      await expect(
        page.locator('label[for="note-type-description"]')
      ).toContainText("Description");
      await expect(page.locator('label[for="template-content"]')).toContainText(
        "Template Content"
      );

      await page.keyboard.press("Escape");
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("should support keyboard navigation and shortcuts", async ({
      page,
    }) => {
      await openTaskSyncSettings(page);

      const noteTypesSection = page.locator(
        '[data-testid="settings-section-note-types"]'
      );
      await noteTypesSection.click();

      const createButton = page.locator(
        '[data-testid="create-note-type-button"]'
      );
      await createButton.click();

      // Test tab navigation through form fields
      await page.keyboard.press("Tab");
      await expect(
        page.locator('[data-testid="note-type-id-input"]')
      ).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(
        page.locator('[data-testid="note-type-name-input"]')
      ).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(
        page.locator('[data-testid="note-type-version-input"]')
      ).toBeFocused();

      // Test escape to close
      await page.keyboard.press("Escape");
      await expect(page.locator(".form-header")).not.toBeVisible();
    });
  });
});
