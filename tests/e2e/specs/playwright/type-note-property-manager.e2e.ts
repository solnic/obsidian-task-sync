/**
 * E2E tests for TypeNote Phase 3: ObsidianPropertyManager
 * Tests property system integration between TypeNote and Obsidian's property API
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  readVaultFile,
  getFrontMatter,
  expectNotice,
  createFile,
  getObsidianApp,
} from "../../helpers/global";

test.describe("TypeNote ObsidianPropertyManager", () => {
  test("should provide property type mapping between TypeNote and Obsidian", async ({
    page,
  }) => {
    // Test the ObsidianPropertyManager type mapping functionality
    const typeMappingTests = [
      { typeNoteType: "string", expectedObsidianType: "text" },
      { typeNoteType: "number", expectedObsidianType: "number" },
      { typeNoteType: "boolean", expectedObsidianType: "checkbox" },
      { typeNoteType: "date", expectedObsidianType: "date" },
      { typeNoteType: "array", expectedObsidianType: "multitext" },
    ];

    for (const testCase of typeMappingTests) {
      const mappedType = await page.evaluate(async (typeNoteType) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Access TypeNote API
        const typeNote = plugin.typeNote;
        if (!typeNote) {
          throw new Error("TypeNote not available");
        }

        // Test type mapping
        return typeNote.obsidianPropertyManager.mapTypeNoteTypeToObsidian(
          typeNoteType
        );
      }, testCase.typeNoteType);

      expect(mappedType).toBe(testCase.expectedObsidianType);
    }
  });

  test("should read existing Obsidian property types", async ({ page }) => {
    // Create a note file with various property types
    const noteContent = `---
title: "My Test Article"
publish_date: 2024-01-15
tags: ["typescript", "testing"]
priority: 5
completed: true
---

# My Test Article

This is a test article to verify property type reading.
`;

    const filePath = "Test Article.md";
    await createFile(page, filePath, {}, noteContent);

    // Wait for Obsidian to process the file and infer property types
    await page.waitForTimeout(1000);

    // Use ObsidianPropertyManager to read property types
    const propertyTypes = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Access TypeNote API
      const typeNote = plugin.typeNote;
      if (!typeNote) {
        throw new Error("TypeNote not available");
      }

      // Get all property types from Obsidian
      return typeNote.obsidianPropertyManager.getAllObsidianPropertyTypes();
    });

    // Verify that we can read property types
    expect(propertyTypes).toBeTruthy();
    expect(typeof propertyTypes).toBe("object");

    // Check if our properties are recognized (they might not be if this is the first time)
    // This test mainly verifies that the API works
    console.log("Property types found:", propertyTypes);
  });

  test("should validate property values against Obsidian types", async ({
    page,
  }) => {
    // Test property value validation
    const validationTests = [
      { propertyName: "title", value: "Hello World", shouldBeValid: true },
      { propertyName: "priority", value: 5, shouldBeValid: true },
      { propertyName: "completed", value: true, shouldBeValid: true },
      { propertyName: "tags", value: ["tag1", "tag2"], shouldBeValid: true },
    ];

    for (const testCase of validationTests) {
      const validationResult = await page.evaluate(async (data) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Access TypeNote API
        const typeNote = plugin.typeNote;
        if (!typeNote) {
          throw new Error("TypeNote not available");
        }

        // Test property validation
        return typeNote.obsidianPropertyManager.validatePropertyValue(
          data.propertyName,
          data.value
        );
      }, testCase);

      expect(validationResult.valid).toBe(testCase.shouldBeValid);
    }
  });
});
