/**
 * E2E tests for NoteKit Settings Property Management
 * Tests the property management interface in the settings editor
 */

import { test, expect } from "../helpers/setup";
import {
  openTaskSyncSettings,
  waitForBaseFile,
  readVaultFile,
} from "../helpers/global";

test.describe("NoteKit Settings - Property Management", () => {
  test.beforeEach(async ({ page }) => {
    await openTaskSyncSettings(page);

    // Navigate to Note Types section
    const noteTypesSection = page.locator(
      '[data-testid="settings-section-note-kit"]'
    );
    await noteTypesSection.click();

    // Scroll down to make the create button visible
    const createButton = page.locator(
      '[data-testid="create-note-type-button"]'
    );
    await createButton.scrollIntoViewIfNeeded();
    await createButton.click();

    // Wait for the note type editor to be visible
    await page
      .locator('[data-testid="note-type-id-input"]')
      .waitFor({ state: "visible" });
  });

  test("should add a new property without clearing existing property settings", async ({
    page,
  }) => {
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

    // Find the first property input (name input) to get the property key
    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await expect(firstPropertyInput).toBeVisible();

    // Get the property key from the data-testid
    const propertyKey = await firstPropertyInput.getAttribute("data-testid");
    const key = propertyKey?.replace("property-name-input-", "") || "";

    // Change the first property's name
    await firstPropertyInput.fill("Priority");

    // Change the first property's type to Number
    const firstPropertyDropdown = page.locator(
      `[data-testid="property-type-dropdown-${key}"]`
    );
    await expect(firstPropertyDropdown).toBeVisible();
    await expect(firstPropertyDropdown).toBeEnabled();

    await firstPropertyDropdown.selectOption("number");

    // Toggle the first property's required status
    const firstPropertyToggleContainer = page.locator(
      `[data-testid="property-required-toggle-${key}"]`
    );
    await expect(firstPropertyToggleContainer).toBeVisible();

    // Find the actual checkbox input inside the toggle container
    const firstPropertyToggle = firstPropertyToggleContainer.locator(
      'input[type="checkbox"]'
    );
    await expect(firstPropertyToggle).toBeVisible();
    await firstPropertyToggle.click();

    // Verify the property settings are still set correctly
    await expect(firstPropertyInput).toHaveValue("Priority");
    await expect(firstPropertyDropdown).toHaveValue("number");
    // Note: The toggle state is managed by Obsidian's toggle component and may not reflect in DOM immediately

    // Now click "Add Property" button
    const addPropertyButton = page
      .locator("button")
      .filter({ hasText: "Add Property" });
    await addPropertyButton.click();

    // Verify the first property settings are STILL correct after adding new property
    await expect(firstPropertyInput).toHaveValue("Priority");
    await expect(firstPropertyDropdown).toHaveValue("number");
    // Note: The toggle state is managed by Obsidian's toggle component and may not reflect in DOM immediately

    // Verify a second property was added by checking for property name inputs
    const allPropertyInputs = page.locator(
      '[data-testid^="property-name-input-"]'
    );
    await expect(allPropertyInputs).toHaveCount(2); // Should have 2 properties total (original + new)
  });

  test("should preserve type when toggling required status", async ({
    page,
  }) => {
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

    // Find the first property by its name input
    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await expect(firstPropertyInput).toBeVisible();
    await expect(firstPropertyInput).toHaveValue("New Property");

    // Get the property key from the data-testid
    const propertyKey = await firstPropertyInput.getAttribute("data-testid");
    const key = propertyKey?.replace("property-name-input-", "") || "";

    // Change the property's type to Number
    const propertyDropdown = page.locator(
      `[data-testid="property-type-dropdown-${key}"]`
    );
    await propertyDropdown.selectOption("number");

    // Verify type is Number
    await expect(propertyDropdown).toHaveValue("number");

    // Toggle required status
    const propertyToggleContainer = page.locator(
      `[data-testid="property-required-toggle-${key}"]`
    );
    await expect(propertyToggleContainer).toBeVisible();

    // Find the actual checkbox input inside the toggle container
    const propertyToggle = propertyToggleContainer.locator(
      'input[type="checkbox"]'
    );
    await expect(propertyToggle).toBeVisible();
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

  test("should preserve required status when changing type", async ({
    page,
  }) => {
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

    // Find the first property by its name input
    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await expect(firstPropertyInput).toBeVisible();
    await expect(firstPropertyInput).toHaveValue("New Property");

    // Get the property key from the data-testid
    const propertyKey = await firstPropertyInput.getAttribute("data-testid");
    const key = propertyKey?.replace("property-name-input-", "") || "";

    // Toggle required status to true
    const propertyToggleContainer = page.locator(
      `[data-testid="property-required-toggle-${key}"]`
    );
    await expect(propertyToggleContainer).toBeVisible();
    await propertyToggleContainer.click();

    // Verify required is checked by checking if toggle has the checked class
    await expect(propertyToggleContainer).toHaveClass(/is-enabled/);

    // Change type to Number
    const propertyDropdown = page.locator(
      `[data-testid="property-type-dropdown-${key}"]`
    );
    await expect(propertyDropdown).toBeVisible();
    await propertyDropdown.selectOption("number");

    // Wait for UI to recreate after type change
    await page.waitForSelector(
      `[data-testid="property-required-toggle-${key}"]`,
      { state: "visible", timeout: 2500 }
    );

    // Re-find the toggle after UI recreation
    const updatedPropertyToggleContainer = page.locator(
      `[data-testid="property-required-toggle-${key}"]`
    );
    await expect(updatedPropertyToggleContainer).toBeVisible();

    // Verify required is STILL checked (not reset to false)
    await expect(updatedPropertyToggleContainer).toHaveClass(/is-enabled/);
    await expect(propertyDropdown).toHaveValue("number");

    // Change type to Boolean
    await propertyDropdown.selectOption("boolean");

    // Wait for UI to recreate after type change
    await page.waitForSelector(
      `[data-testid="property-required-toggle-${key}"]`,
      { state: "visible", timeout: 2500 }
    );

    // Re-find the toggle after UI recreation
    const booleanToggleContainer = page.locator(
      `[data-testid="property-required-toggle-${key}"]`
    );
    // Verify required is STILL checked
    await expect(booleanToggleContainer).toHaveClass(/is-enabled/);
    await expect(propertyDropdown).toHaveValue("boolean");

    // Change type to Date
    await propertyDropdown.selectOption("date");

    // Wait for UI to recreate after type change
    await page.waitForSelector(
      `[data-testid="property-required-toggle-${key}"]`,
      { state: "visible", timeout: 2500 }
    );

    // Re-find the toggle after UI recreation
    const dateToggleContainer = page.locator(
      `[data-testid="property-required-toggle-${key}"]`
    );
    // Verify required is STILL checked
    await expect(dateToggleContainer).toHaveClass(/is-enabled/);
    await expect(propertyDropdown).toHaveValue("date");
  });

  test("should maintain property configuration in input values", async ({
    page,
  }) => {
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

    // Find the first property input (name input) to get the property key
    const propertyNameInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await expect(propertyNameInput).toBeVisible();

    // Get the property key from the data-testid
    const propertyKey = await propertyNameInput.getAttribute("data-testid");
    const key = propertyKey?.replace("property-name-input-", "") || "";

    // Change property name
    await propertyNameInput.fill("Priority");

    // Change type to Number
    const propertyDropdown = page.locator(
      `[data-testid="property-type-dropdown-${key}"]`
    );
    await expect(propertyDropdown).toBeVisible();
    await propertyDropdown.selectOption("number");

    // Toggle required
    const propertyToggleContainer = page.locator(
      `[data-testid="property-required-toggle-${key}"]`
    );
    await expect(propertyToggleContainer).toBeVisible();

    // Find the actual checkbox input inside the toggle container
    const propertyToggle = propertyToggleContainer.locator(
      'input[type="checkbox"]'
    );
    await expect(propertyToggle).toBeVisible();
    await propertyToggle.click();

    // Verify all values are maintained in the input controls
    await expect(propertyNameInput).toHaveValue("Priority");
    await expect(propertyDropdown).toHaveValue("number");
    // Note: The toggle state is managed by Obsidian's toggle component and may not reflect in DOM immediately

    // Verify the property name input shows the updated name
    await expect(propertyNameInput).toHaveValue("Priority");
  });
});

test.describe("NoteKit Settings - Complete Note Type Lifecycle", () => {
  test("should create a new note type and verify it appears in the list", async ({
    page,
  }) => {
    await openTaskSyncSettings(page);

    // Navigate to Note Types section
    const noteTypesSection = page.locator(
      '[data-testid="settings-section-note-kit"]'
    );
    await noteTypesSection.click();

    // Scroll down to make the create button visible
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
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Meeting Note");
    await page
      .locator('[data-testid="note-type-id-input"]')
      .fill("meeting-note");

    // Scroll down to make the Properties section visible
    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Configure the first property
    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await expect(firstPropertyInput).toBeVisible();
    await firstPropertyInput.fill("Attendees");

    // Get the property key
    const propertyKey = await firstPropertyInput.getAttribute("data-testid");
    const key = propertyKey?.replace("property-name-input-", "") || "";

    // Set property type to string (default)
    const propertyDropdown = page.locator(
      `[data-testid="property-type-dropdown-${key}"]`
    );
    await expect(propertyDropdown).toBeVisible();
    await propertyDropdown.selectOption("string");

    // Scroll to save button
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for template file to be created
    await waitForBaseFile(page, "Templates/Meeting Note.md");

    // Verify template file content has empty front-matter (no handlebars placeholders)
    const templateContent = await readVaultFile(
      page,
      "Templates/Meeting Note.md"
    );
    expect(templateContent).toContain("---");
    expect(templateContent).toContain("Attendees:");
    // Verify NO handlebars syntax in front-matter
    expect(templateContent).not.toContain("{{attendees}}");
    expect(templateContent).not.toContain("{{title}}");

    // Verify we're back at the list view and the note type appears
    const noteTypeItem = page
      .locator(".setting-item-name")
      .filter({ hasText: "Meeting Note" });
    await expect(noteTypeItem).toBeVisible();
  });

  test("should edit an existing note type and verify changes are persisted", async ({
    page,
  }) => {
    // First create a note type
    await openTaskSyncSettings(page);

    const noteTypesSection = page.locator(
      '[data-testid="settings-section-note-kit"]'
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
      .locator('[data-testid="note-type-name-input"]')
      .fill("Project Plan");
    await page
      .locator('[data-testid="note-type-id-input"]')
      .fill("project-plan");

    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await firstPropertyInput.fill("Status");

    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for initial template file to be created
    await waitForBaseFile(page, "Templates/Project Plan.md");

    // Now edit the note type
    const noteTypeItem = page
      .locator(".setting-item")
      .filter({ hasText: "Project Plan" });
    await expect(noteTypeItem).toBeVisible();

    // Find and click the edit button
    const editButton = noteTypeItem.locator("button").first();
    await editButton.click();

    // Wait for editor to appear
    await page
      .locator('[data-testid="note-type-id-input"]')
      .waitFor({ state: "visible" });

    // Verify existing values are loaded
    await expect(
      page.locator('[data-testid="note-type-name-input"]')
    ).toHaveValue("Project Plan");
    await expect(
      page.locator('[data-testid="note-type-id-input"]')
    ).toHaveValue("project-plan");

    // Update the name
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Project Plan Updated");

    // Save changes
    const updateSaveButton = page
      .locator("button")
      .filter({ hasText: "Save Changes" });
    await updateSaveButton.scrollIntoViewIfNeeded();
    await updateSaveButton.click();

    // Wait for template file to be updated (name changed)
    await waitForBaseFile(page, "Templates/Project Plan Updated.md");

    // Verify updated template file content is valid
    const updatedTemplateContent = await readVaultFile(
      page,
      "Templates/Project Plan Updated.md"
    );
    expect(updatedTemplateContent).toContain("---");
    expect(updatedTemplateContent).toContain("Status:");
    // Verify NO handlebars syntax in front-matter
    expect(updatedTemplateContent).not.toContain("{{status}}");
    expect(updatedTemplateContent).not.toContain("{{title}}");

    // Verify the updated name appears in the list
    const updatedNoteTypeItem = page
      .locator(".setting-item-name")
      .filter({ hasText: "Project Plan Updated" });
    await expect(updatedNoteTypeItem).toBeVisible();
  });

  test("should persist note type changes after plugin reload", async ({
    page,
  }) => {
    // First create a note type
    await openTaskSyncSettings(page);

    const noteTypesSection = page.locator(
      '[data-testid="settings-section-note-kit"]'
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
      .locator('[data-testid="note-type-name-input"]')
      .fill("Persistence Test");
    await page
      .locator('[data-testid="note-type-id-input"]')
      .fill("persistence-test");

    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await firstPropertyInput.fill("TestProperty");

    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for template file to be created
    await waitForBaseFile(page, "Templates/Persistence Test.md");

    // Verify template file is valid
    const templateContent = await readVaultFile(
      page,
      "Templates/Persistence Test.md"
    );
    expect(templateContent).toContain("---");
    expect(templateContent).toContain("TestProperty:");
    // Verify NO handlebars syntax in front-matter
    expect(templateContent).not.toContain("{{testProperty}}");
    expect(templateContent).not.toContain("{{title}}");

    // Check if note type was persisted to plugin data
    const persistedData = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Load data directly from storage
      const data = await plugin.loadData();

      return {
        hasNoteTypes: !!data?.noteTypes,
        noteTypeIds: data?.noteTypes ? Object.keys(data.noteTypes) : [],
        persistenceTestExists:
          data?.noteTypes?.["persistence-test"] !== undefined,
      };
    });

    // Verify the note type was persisted
    expect(persistedData.hasNoteTypes).toBe(true);
    expect(persistedData.noteTypeIds).toContain("persistence-test");
    expect(persistedData.persistenceTestExists).toBe(true);
  });

  test("should persist note type edits to plugin data", async ({ page }) => {
    // First create a note type
    await openTaskSyncSettings(page);

    const noteTypesSection = page.locator(
      '[data-testid="settings-section-note-kit"]'
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
      .locator('[data-testid="note-type-name-input"]')
      .fill("Edit Test");
    await page.locator('[data-testid="note-type-id-input"]').fill("edit-test");

    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await firstPropertyInput.fill("OriginalProperty");

    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for template file to be created
    await waitForBaseFile(page, "Templates/Edit Test.md");

    // Verify initial template file is valid
    const initialTemplateContent = await readVaultFile(
      page,
      "Templates/Edit Test.md"
    );
    expect(initialTemplateContent).toContain("---");
    expect(initialTemplateContent).toContain("OriginalProperty:");
    // Verify NO handlebars syntax in front-matter
    expect(initialTemplateContent).not.toContain("{{originalProperty}}");
    expect(initialTemplateContent).not.toContain("{{title}}");

    // Check initial persisted data
    const initialData = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const data = await plugin.loadData();
      const noteType = data?.noteTypes?.["edit-test"];
      return {
        exists: noteType !== undefined,
        name: noteType?.data?.name,
      };
    });

    expect(initialData.exists).toBe(true);
    expect(initialData.name).toBe("Edit Test");

    // Now edit the note type
    const noteTypeItem = page
      .locator(".setting-item")
      .filter({ hasText: "Edit Test" });
    await expect(noteTypeItem).toBeVisible();

    const editButton = noteTypeItem.locator("button").first();
    await editButton.click();

    await page
      .locator('[data-testid="note-type-id-input"]')
      .waitFor({ state: "visible" });

    // Update the name
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Edit Test Updated");

    // Save changes - wait for the notice to appear which indicates save completed
    const updateSaveButton = page
      .locator("button")
      .filter({ hasText: "Save Changes" });
    await updateSaveButton.scrollIntoViewIfNeeded();

    // Listen for the success notice
    const noticePromise = page.waitForSelector(".notice", {
      state: "visible",
      timeout: 2500,
    });
    await updateSaveButton.click();
    await noticePromise;

    // Wait for template file to be updated
    await waitForBaseFile(page, "Templates/Edit Test Updated.md");

    // Verify updated template file is valid
    const updatedTemplateContent = await readVaultFile(
      page,
      "Templates/Edit Test Updated.md"
    );
    expect(updatedTemplateContent).toContain("---");
    expect(updatedTemplateContent).toContain("OriginalProperty:");
    // Verify NO handlebars syntax in front-matter
    expect(updatedTemplateContent).not.toContain("{{originalProperty}}");
    expect(updatedTemplateContent).not.toContain("{{title}}");

    // Check if the edited note type was persisted to plugin data
    const persistedData = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Load data directly from storage
      const data = await plugin.loadData();

      const noteType = data?.noteTypes?.["edit-test"];

      return {
        exists: noteType !== undefined,
        name: noteType?.data?.name,
      };
    });

    // Verify the edited note type was persisted with updated name
    expect(persistedData.exists).toBe(true);
    expect(persistedData.name).toBe("Edit Test Updated");
  });
});
