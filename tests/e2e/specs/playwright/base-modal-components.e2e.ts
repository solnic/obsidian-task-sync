/**
 * E2E tests for Base Modal Components
 * Tests the reusable modal components that follow TaskSync patterns
 */

import { test, expect } from "../../helpers/setup";
import { openTaskSyncSettings } from "../../helpers/global";

test.describe("Base Modal Components", () => {
  test.describe("BaseModal Functionality", () => {
    test("should display modal with proper structure", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      // Navigate to Note Types and open create form (which uses BaseFormModal)
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Verify modal structure
      const modal = page.locator('.note-type-form');
      await expect(modal).toBeVisible();

      // Verify header structure
      const header = page.locator('.form-header');
      await expect(header).toBeVisible();
      await expect(header.locator('h3')).toContainText('Create Note Type');
      await expect(header.locator('[data-testid="cancel-form-button"]')).toBeVisible();

      // Verify content area
      const content = page.locator('.note-type-definition-form');
      await expect(content).toBeVisible();

      // Verify footer with actions
      const actions = page.locator('.form-actions');
      await expect(actions).toBeVisible();
      await expect(actions.locator('[data-testid="save-note-type-button"]')).toBeVisible();
      await expect(actions.locator('.cancel-button')).toBeVisible();

      await page.keyboard.press("Escape");
    });

    test("should handle modal close actions", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Test header cancel button
      const headerCancelButton = page.locator('[data-testid="cancel-form-button"]');
      await headerCancelButton.click();

      // Verify modal is closed
      await expect(page.locator('.note-type-form')).not.toBeVisible();
      await expect(page.locator('[data-testid="create-note-type-button"]')).toBeVisible();

      // Open again to test footer cancel
      await createButton.click();
      const footerCancelButton = page.locator('.form-actions .cancel-button');
      await footerCancelButton.click();

      // Verify modal is closed again
      await expect(page.locator('.note-type-form')).not.toBeVisible();

      await page.keyboard.press("Escape");
    });

    test("should support escape key to close", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Verify modal is open
      await expect(page.locator('.note-type-form')).toBeVisible();

      // Press escape to close
      await page.keyboard.press('Escape');

      // Verify modal is closed
      await expect(page.locator('.note-type-form')).not.toBeVisible();

      await page.keyboard.press("Escape"); // Close settings
    });
  });

  test.describe("Form Field Components", () => {
    test("should display form fields with proper labels and styling", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Test form field structure
      const formFields = page.locator('.form-field');
      await expect(formFields.first()).toBeVisible();

      // Verify label styling and association
      const idField = page.locator('.form-field').first();
      const label = idField.locator('label');
      const input = idField.locator('input');

      await expect(label).toBeVisible();
      await expect(label).toContainText('ID *');
      await expect(input).toBeVisible();
      
      // Verify label is properly associated with input
      const labelFor = await label.getAttribute('for');
      const inputId = await input.getAttribute('id');
      expect(labelFor).toBe(inputId);

      await page.keyboard.press("Escape");
    });

    test("should handle form input interactions", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Test input focus and typing
      const idInput = page.locator('[data-testid="note-type-id-input"]');
      await idInput.click();
      await expect(idInput).toBeFocused();

      await idInput.fill('test-note-type');
      await expect(idInput).toHaveValue('test-note-type');

      // Test textarea
      const descriptionTextarea = page.locator('[data-testid="note-type-description-input"]');
      await descriptionTextarea.click();
      await expect(descriptionTextarea).toBeFocused();

      await descriptionTextarea.fill('This is a test description');
      await expect(descriptionTextarea).toHaveValue('This is a test description');

      await page.keyboard.press("Escape");
    });

    test("should display required field indicators", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Verify required field indicators (asterisks)
      await expect(page.locator('label[for="note-type-id"]')).toContainText('*');
      await expect(page.locator('label[for="note-type-name"]')).toContainText('*');
      
      // Verify optional fields don't have asterisks
      const versionLabel = await page.locator('label[for="note-type-version"]').textContent();
      const categoryLabel = await page.locator('label[for="note-type-category"]').textContent();
      const descriptionLabel = await page.locator('label[for="note-type-description"]').textContent();
      
      expect(versionLabel).not.toContain('*');
      expect(categoryLabel).not.toContain('*');
      expect(descriptionLabel).not.toContain('*');

      await page.keyboard.press("Escape");
    });
  });

  test.describe("Form Layout and Responsiveness", () => {
    test("should display form grid layout correctly", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Verify grid layout
      const formGrid = page.locator('.form-grid');
      await expect(formGrid).toBeVisible();

      // Verify grid contains the expected number of fields
      const gridFields = formGrid.locator('.form-field');
      await expect(gridFields).toHaveCount(4); // ID, Name, Version, Category

      // Verify fields are arranged in grid
      const gridStyle = await formGrid.evaluate(el => getComputedStyle(el).display);
      expect(gridStyle).toBe('grid');

      await page.keyboard.press("Escape");
    });

    test("should handle form sections properly", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Verify form sections
      const formSections = page.locator('.form-section');
      await expect(formSections).toHaveCount(3); // Basic Info, Properties, Template

      // Verify each section has proper structure
      for (let i = 0; i < 3; i++) {
        const section = formSections.nth(i);
        await expect(section).toBeVisible();
        
        const heading = section.locator('h4');
        await expect(heading).toBeVisible();
      }

      await page.keyboard.press("Escape");
    });

    test("should display section notes and guidance", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Verify section notes are displayed
      const sectionNotes = page.locator('.section-note');
      await expect(sectionNotes).toHaveCount(2); // Properties and Template sections

      // Verify content of section notes
      await expect(sectionNotes.first()).toContainText('Property definition interface');
      await expect(sectionNotes.last()).toContainText('Template editor with syntax highlighting');

      await page.keyboard.press("Escape");
    });
  });

  test.describe("Button Components", () => {
    test("should display action buttons with proper styling", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Verify action buttons
      const saveButton = page.locator('[data-testid="save-note-type-button"]');
      const cancelButton = page.locator('.form-actions .cancel-button');

      await expect(saveButton).toBeVisible();
      await expect(saveButton).toContainText('Save Note Type');
      await expect(saveButton).toHaveClass(/save-button/);

      await expect(cancelButton).toBeVisible();
      await expect(cancelButton).toContainText('Cancel');
      await expect(cancelButton).toHaveClass(/cancel-button/);

      await page.keyboard.press("Escape");
    });

    test("should handle button interactions", async ({ page }) => {
      await openTaskSyncSettings(page);
      
      const noteTypesSection = page.locator('[data-testid="settings-section-note-types"]');
      await noteTypesSection.click();

      const createButton = page.locator('[data-testid="create-note-type-button"]');
      await createButton.click();

      // Test button hover states (if applicable)
      const saveButton = page.locator('[data-testid="save-note-type-button"]');
      await saveButton.hover();
      
      // Verify button is still visible and clickable
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeEnabled();

      // Test cancel button functionality
      const cancelButton = page.locator('.form-actions .cancel-button');
      await cancelButton.click();

      // Verify form closes
      await expect(page.locator('.note-type-form')).not.toBeVisible();

      await page.keyboard.press("Escape");
    });
  });
});
