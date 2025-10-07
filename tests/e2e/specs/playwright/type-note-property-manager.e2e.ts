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
  test("should register TypeNote properties with Obsidian property system", async ({
    page,
  }) => {
    // Create a simple note type with basic properties
    const noteTypeDefinition = {
      id: "test-article",
      name: "Test Article",
      version: "1.0.0",
      properties: {
        title: {
          key: "title",
          name: "Title",
          schema: { type: "string" },
          frontMatterKey: "title",
          required: true,
        },
        publishDate: {
          key: "publishDate", 
          name: "Publish Date",
          schema: { type: "date" },
          frontMatterKey: "publish_date",
          required: false,
        },
        tags: {
          key: "tags",
          name: "Tags", 
          schema: { type: "array" },
          frontMatterKey: "tags",
          required: false,
        },
      },
      template: {
        version: "1.0.0",
        content: "# {{title}}\n\nPublished: {{publishDate}}\nTags: {{tags}}",
        variables: {},
      },
    };

    // Register the note type through the TypeNote system
    await page.evaluate(async (noteType) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      
      // Access TypeNote registry (this will fail until we implement it)
      const typeRegistry = plugin.typeNoteRegistry;
      if (!typeRegistry) {
        throw new Error("TypeNote registry not available");
      }
      
      // Register the note type
      const result = typeRegistry.register(noteType);
      if (!result.valid) {
        throw new Error(`Failed to register note type: ${result.errors[0].message}`);
      }
    }, noteTypeDefinition);

    // Verify that Obsidian's property system recognizes the TypeNote properties
    const obsidianProperties = await page.evaluate(async () => {
      const app = (window as any).app;
      
      // Check if properties are registered in Obsidian's property registry
      const propertyRegistry = app.metadataTypeManager;
      if (!propertyRegistry) {
        return null;
      }
      
      // Get registered properties
      const registeredProperties = [];
      const properties = ["title", "publish_date", "tags"];
      
      for (const prop of properties) {
        const propInfo = propertyRegistry.getPropertyInfo(prop);
        if (propInfo) {
          registeredProperties.push({
            name: prop,
            type: propInfo.type,
          });
        }
      }
      
      return registeredProperties;
    });

    // Verify properties are properly registered
    expect(obsidianProperties).toBeTruthy();
    expect(obsidianProperties.length).toBeGreaterThan(0);
    
    // Check specific property types
    const titleProp = obsidianProperties.find(p => p.name === "title");
    expect(titleProp).toBeTruthy();
    expect(titleProp.type).toBe("text");
    
    const dateProp = obsidianProperties.find(p => p.name === "publish_date");
    expect(dateProp).toBeTruthy();
    expect(dateProp.type).toBe("date");
    
    const tagsProp = obsidianProperties.find(p => p.name === "tags");
    expect(tagsProp).toBeTruthy();
    expect(tagsProp.type).toBe("multitext");
  });

  test("should create typed note with proper Obsidian property validation", async ({
    page,
  }) => {
    // This test will verify that when we create a note using TypeNote,
    // the properties are properly validated by both TypeNote and Obsidian
    
    // Create a note file with TypeNote properties
    const noteContent = `---
title: "My Test Article"
publish_date: 2024-01-15
tags: ["typescript", "testing"]
type: "test-article"
---

# My Test Article

This is a test article created through TypeNote.
`;

    const filePath = "Test Article.md";
    await createFile(page, filePath, {}, noteContent);
    
    // Process the note through TypeNote system
    const processingResult = await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      
      // Access TypeNote processor (this will fail until we implement it)
      const noteProcessor = plugin.typeNoteProcessor;
      if (!noteProcessor) {
        throw new Error("TypeNote processor not available");
      }
      
      // Read file content
      const file = app.vault.getAbstractFileByPath(filePath);
      const content = await app.vault.read(file);
      
      // Process the note
      const result = noteProcessor.processNote(content, filePath);
      
      return {
        valid: result.valid,
        noteType: result.noteType?.id,
        properties: result.properties,
        errors: result.errors?.map(e => e.message) || [],
      };
    }, filePath);

    // Verify TypeNote processing succeeded
    expect(processingResult.valid).toBe(true);
    expect(processingResult.noteType).toBe("test-article");
    expect(processingResult.properties.title).toBe("My Test Article");
    expect(processingResult.properties.publish_date).toBe("2024-01-15");
    expect(processingResult.properties.tags).toEqual(["typescript", "testing"]);

    // Verify Obsidian's property system also recognizes the properties
    const obsidianMetadata = await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      
      // Get metadata from Obsidian's cache
      const cache = app.metadataCache.getFileCache(file);
      return cache?.frontmatter || {};
    }, filePath);

    expect(obsidianMetadata.title).toBe("My Test Article");
    expect(obsidianMetadata.publish_date).toBe("2024-01-15");
    expect(obsidianMetadata.tags).toEqual(["typescript", "testing"]);
  });

  test("should handle property type mapping between TypeNote and Obsidian", async ({
    page,
  }) => {
    // Test that TypeNote property types are correctly mapped to Obsidian property types
    const typeMappingTests = [
      { typeNoteType: "string", obsidianType: "text", value: "Hello World" },
      { typeNoteType: "number", obsidianType: "number", value: 42 },
      { typeNoteType: "boolean", obsidianType: "checkbox", value: true },
      { typeNoteType: "date", obsidianType: "date", value: "2024-01-15" },
      { typeNoteType: "array", obsidianType: "multitext", value: ["tag1", "tag2"] },
    ];

    for (const testCase of typeMappingTests) {
      const mappedType = await page.evaluate(async (typeNoteType) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        
        // Access ObsidianPropertyManager (this will fail until we implement it)
        const propertyManager = plugin.obsidianPropertyManager;
        if (!propertyManager) {
          throw new Error("ObsidianPropertyManager not available");
        }
        
        // Test type mapping
        return propertyManager.mapTypeNoteTypeToObsidian(typeNoteType);
      }, testCase.typeNoteType);

      expect(mappedType).toBe(testCase.obsidianType);
    }
  });
});
