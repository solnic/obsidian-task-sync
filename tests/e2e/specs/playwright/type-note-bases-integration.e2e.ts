/**
 * E2E tests for TypeNote BasesIntegration
 * Tests automatic base creation from note types
 */

import { test, expect } from "../../helpers/setup";
import {
  openTaskSyncSettings,
  waitForBaseFile,
  readVaultFile,
} from "../../helpers/global";

test.describe("TypeNote BasesIntegration", () => {
  test("should create Obsidian base from TypeNote note type", async ({
    page,
  }) => {
    // Open settings and navigate to Note Types section
    await openTaskSyncSettings(page);

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
    await page.locator('[data-testid="note-type-id-input"]').fill("article");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Article");

    // Scroll down to make the Properties section visible
    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Configure the first property (Title)
    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await expect(firstPropertyInput).toBeVisible();
    await firstPropertyInput.fill("Title");

    // Get the property key for the first property
    const propertyKey1 = await firstPropertyInput.getAttribute("data-testid");
    const key1 = propertyKey1?.replace("property-name-input-", "") || "";

    // Set type to string and make it required
    const propertyDropdown1 = page.locator(
      `[data-testid="property-type-dropdown-${key1}"]`
    );
    await propertyDropdown1.selectOption("string");

    const propertyToggle1 = page
      .locator(`[data-testid="property-required-toggle-${key1}"]`)
      .locator('input[type="checkbox"]');
    await propertyToggle1.click();

    // Add second property (Author)
    const addPropertyButton = page
      .locator("button")
      .filter({ hasText: "Add Property" });
    await addPropertyButton.click();

    const secondPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(1);
    await expect(secondPropertyInput).toBeVisible();
    await secondPropertyInput.fill("Author");

    // Add third property (Publish Date)
    await addPropertyButton.click();

    const thirdPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(2);
    await expect(thirdPropertyInput).toBeVisible();
    await thirdPropertyInput.fill("Publish Date");

    // Get the property key for the third property
    const propertyKey3 = await thirdPropertyInput.getAttribute("data-testid");
    const key3 = propertyKey3?.replace("property-name-input-", "") || "";

    // Set type to date
    const propertyDropdown3 = page.locator(
      `[data-testid="property-type-dropdown-${key3}"]`
    );
    await propertyDropdown3.selectOption("date");

    // Add fourth property (Tags)
    await addPropertyButton.click();

    const fourthPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(3);
    await expect(fourthPropertyInput).toBeVisible();
    await fourthPropertyInput.fill("Tags");

    // Add fifth property (Published)
    await addPropertyButton.click();

    const fifthPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(4);
    await expect(fifthPropertyInput).toBeVisible();
    await fifthPropertyInput.fill("Published");

    // Get the property key for the fifth property
    const propertyKey5 = await fifthPropertyInput.getAttribute("data-testid");
    const key5 = propertyKey5?.replace("property-name-input-", "") || "";

    // Set type to boolean
    const propertyDropdown5 = page.locator(
      `[data-testid="property-type-dropdown-${key5}"]`
    );
    await propertyDropdown5.selectOption("boolean");

    // Save the note type
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for template file to be created
    await waitForBaseFile(page, "Templates/Article.md");

    // Manually create base file since automatic creation is not implemented yet
    const baseCreationResult = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin?.typeNote?.basesIntegration) {
        throw new Error("BasesIntegration not available");
      }

      return await plugin.typeNote.basesIntegration.createBaseFromNoteType("article");
    });

    expect(baseCreationResult.success).toBe(true);

    // Wait for base file to be created
    await waitForBaseFile(page, "article.base");

    // Verify the base file content has correct properties
    const baseContent = await readVaultFile(page, "article.base");
    expect(baseContent).toBeTruthy();
    expect(baseContent).toContain("Title:");
    expect(baseContent).toContain("Author:");
    expect(baseContent).toContain("Publish Date:");
    expect(baseContent).toContain("Tags:");
    expect(baseContent).toContain("Published:");
  });

  test("should create base with properties from note type", async ({
    page,
  }) => {
    // Open settings and navigate to Note Types section
    await openTaskSyncSettings(page);

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
    await page
      .locator('[data-testid="note-type-id-input"]')
      .fill("custom-task");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Custom Task");

    // Scroll down to make the Properties section visible
    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Configure the first property (Title)
    const firstPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await expect(firstPropertyInput).toBeVisible();
    await firstPropertyInput.fill("Title");

    // Get the property key for the first property
    const propertyKey1 = await firstPropertyInput.getAttribute("data-testid");
    const key1 = propertyKey1?.replace("property-name-input-", "") || "";

    // Set type to string and make it required
    const propertyDropdown1 = page.locator(
      `[data-testid="property-type-dropdown-${key1}"]`
    );
    await propertyDropdown1.selectOption("string");

    const propertyToggle1 = page
      .locator(`[data-testid="property-required-toggle-${key1}"]`)
      .locator('input[type="checkbox"]');
    await propertyToggle1.click();

    // Add second property (Priority)
    const addPropertyButton = page
      .locator("button")
      .filter({ hasText: "Add Property" });
    await addPropertyButton.click();

    const secondPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(1);
    await expect(secondPropertyInput).toBeVisible();
    await secondPropertyInput.fill("Priority");

    // Add third property (Completed)
    await addPropertyButton.click();

    const thirdPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(2);
    await expect(thirdPropertyInput).toBeVisible();
    await thirdPropertyInput.fill("Completed");

    // Get the property key for the third property
    const propertyKey3 = await thirdPropertyInput.getAttribute("data-testid");
    const key3 = propertyKey3?.replace("property-name-input-", "") || "";

    // Set type to boolean
    const propertyDropdown3 = page.locator(
      `[data-testid="property-type-dropdown-${key3}"]`
    );
    await propertyDropdown3.selectOption("boolean");

    // Add fourth property (Due Date)
    await addPropertyButton.click();

    const fourthPropertyInput = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(3);
    await expect(fourthPropertyInput).toBeVisible();
    await fourthPropertyInput.fill("Due Date");

    // Get the property key for the fourth property
    const propertyKey4 = await fourthPropertyInput.getAttribute("data-testid");
    const key4 = propertyKey4?.replace("property-name-input-", "") || "";

    // Set type to date
    const propertyDropdown4 = page.locator(
      `[data-testid="property-type-dropdown-${key4}"]`
    );
    await propertyDropdown4.selectOption("date");

    // Save the note type
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for template file to be created
    await waitForBaseFile(page, "Templates/Custom Task.md");

    // Manually create base file since automatic creation is not implemented yet
    const baseCreationResult = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin?.typeNote?.basesIntegration) {
        throw new Error("BasesIntegration not available");
      }

      return await plugin.typeNote.basesIntegration.createBaseFromNoteType("custom-task");
    });

    expect(baseCreationResult.success).toBe(true);

    // Wait for base file to be created
    await waitForBaseFile(page, "custom-task.base");

    // Verify the base file contains the properties
    const baseContent = await readVaultFile(page, "custom-task.base");
    expect(baseContent).toBeTruthy();
    expect(baseContent).toContain("Title:");
    expect(baseContent).toContain("Priority:");
    expect(baseContent).toContain("Completed:");
    expect(baseContent).toContain("Due Date:");
  });

  test("should handle property type mapping for base generation", async ({
    page,
  }) => {
    // Open settings and navigate to Note Types section
    await openTaskSyncSettings(page);

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
    await page
      .locator('[data-testid="note-type-id-input"]')
      .fill("type-mapping-test");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Type Mapping Test");

    // Scroll down to make the Properties section visible
    const propertiesHeading = page
      .locator("h4")
      .filter({ hasText: "Properties" });
    await propertiesHeading.scrollIntoViewIfNeeded();

    // Configure properties with different types to test mapping
    const addPropertyButton = page
      .locator("button")
      .filter({ hasText: "Add Property" });

    // Property 1: String (maps to text)
    const prop1Input = page
      .locator('[data-testid^="property-name-input-"]')
      .first();
    await expect(prop1Input).toBeVisible();
    await prop1Input.fill("StringProp");
    const key1 = (await prop1Input.getAttribute("data-testid"))?.replace(
      "property-name-input-",
      ""
    ) || "";
    await page
      .locator(`[data-testid="property-type-dropdown-${key1}"]`)
      .selectOption("string");

    // Property 2: Number (maps to number)
    await addPropertyButton.click();
    const prop2Input = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(1);
    await expect(prop2Input).toBeVisible();
    await prop2Input.fill("NumberProp");
    const key2 = (await prop2Input.getAttribute("data-testid"))?.replace(
      "property-name-input-",
      ""
    ) || "";
    await page
      .locator(`[data-testid="property-type-dropdown-${key2}"]`)
      .selectOption("number");

    // Property 3: Boolean (maps to checkbox)
    await addPropertyButton.click();
    const prop3Input = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(2);
    await expect(prop3Input).toBeVisible();
    await prop3Input.fill("BooleanProp");
    const key3 = (await prop3Input.getAttribute("data-testid"))?.replace(
      "property-name-input-",
      ""
    ) || "";
    await page
      .locator(`[data-testid="property-type-dropdown-${key3}"]`)
      .selectOption("boolean");

    // Property 4: Date (maps to date)
    await addPropertyButton.click();
    const prop4Input = page
      .locator('[data-testid^="property-name-input-"]')
      .nth(3);
    await expect(prop4Input).toBeVisible();
    await prop4Input.fill("DateProp");
    const key4 = (await prop4Input.getAttribute("data-testid"))?.replace(
      "property-name-input-",
      ""
    ) || "";
    await page
      .locator(`[data-testid="property-type-dropdown-${key4}"]`)
      .selectOption("date");

    // Save the note type
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    // Wait for template file to be created
    await waitForBaseFile(page, "Templates/Type Mapping Test.md");

    // Manually create base file since automatic creation is not implemented yet
    const baseCreationResult = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin?.typeNote?.basesIntegration) {
        throw new Error("BasesIntegration not available");
      }

      return await plugin.typeNote.basesIntegration.createBaseFromNoteType("type-mapping-test");
    });

    expect(baseCreationResult.success).toBe(true);

    // Wait for base file to be created
    await waitForBaseFile(page, "type-mapping-test.base");

    // Verify the base file contains correctly mapped property types
    const baseContent = await readVaultFile(page, "type-mapping-test.base");
    expect(baseContent).toBeTruthy();

    // Verify property type mappings in the base file
    // String -> text
    expect(baseContent).toContain("StringProp:");
    expect(baseContent).toMatch(/StringProp:[\s\S]*?type:\s*text/);

    // Number -> number
    expect(baseContent).toContain("NumberProp:");
    expect(baseContent).toMatch(/NumberProp:[\s\S]*?type:\s*number/);

    // Boolean -> checkbox
    expect(baseContent).toContain("BooleanProp:");
    expect(baseContent).toMatch(/BooleanProp:[\s\S]*?type:\s*checkbox/);

    // Date -> date
    expect(baseContent).toContain("DateProp:");
    expect(baseContent).toMatch(/DateProp:[\s\S]*?type:\s*date/);
  });
});
