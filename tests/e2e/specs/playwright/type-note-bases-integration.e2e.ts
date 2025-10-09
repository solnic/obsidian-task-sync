/**
 * E2E tests for TypeNote BasesIntegration
 * Tests automatic base creation from note types
 */

import { test, expect } from "../../helpers/setup";
import { getObsidianApp } from "../../helpers/global";

test.describe("TypeNote BasesIntegration", () => {
  test("should create Obsidian base from TypeNote note type", async ({
    page,
  }) => {
    // Define a TypeNote note type for articles
    const articleNoteType = {
      id: "article",
      name: "Article",
      version: "1.0.0",
      properties: {
        title: {
          key: "title",
          name: "Title",
          schema: { type: "string" },
          frontMatterKey: "title",
          required: true,
        },
        author: {
          key: "author",
          name: "Author",
          schema: { type: "string" },
          frontMatterKey: "author",
          required: false,
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
        published: {
          key: "published",
          name: "Published",
          schema: { type: "boolean" },
          frontMatterKey: "published",
          required: false,
        },
      },
      template: {
        version: "1.0.0",
        content:
          "# {{title}}\n\nAuthor: {{author}}\nPublished: {{publishDate}}",
        variables: {},
      },
    };

    // Wait for Obsidian to be ready
    const app = await getObsidianApp(page);
    expect(app).toBeDefined();

    // Register the note type and create base
    const baseCreationResult = await page.evaluate(async (noteType) => {
      const app = (window as any).app;
      if (!app) {
        throw new Error("Obsidian app not available");
      }

      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (!plugin) {
        throw new Error("Task Sync plugin not available");
      }

      // Access TypeNote API
      const typeNote = plugin.typeNote;
      if (!typeNote) {
        throw new Error("TypeNote not available");
      }

      // Register the note type
      const registrationResult = typeNote.registry.register(noteType);
      if (!registrationResult.valid) {
        throw new Error(
          `Failed to register note type: ${registrationResult.errors[0].message}`
        );
      }

      // Create base from note type using BasesIntegration
      const basesIntegration = typeNote.basesIntegration;
      if (!basesIntegration) {
        throw new Error("BasesIntegration not available");
      }

      return await basesIntegration.createBaseFromNoteType(noteType.id);
    }, articleNoteType);

    // Verify base creation succeeded
    expect(baseCreationResult.success).toBe(true);
    expect(baseCreationResult.baseFileName).toBe("article.base");

    // Verify the base file was created
    const baseFileExists = await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("article.base");
      return file !== null;
    });

    expect(baseFileExists).toBe(true);

    // Verify the base file content has correct properties
    const baseContent = await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("article.base");
      return await app.vault.read(file);
    });

    expect(baseContent).toContain("title:");
    expect(baseContent).toContain("author:");
    expect(baseContent).toContain("publish_date:");
    expect(baseContent).toContain("tags:");
    expect(baseContent).toContain("published:");
  });

  test("should generate views based on note type properties", async ({
    page,
  }) => {
    // Define a note type with different property types for view generation
    const taskNoteType = {
      id: "custom-task",
      name: "Custom Task",
      version: "1.0.0",
      properties: {
        title: {
          key: "title",
          name: "Title",
          schema: { type: "string" },
          frontMatterKey: "title",
          required: true,
        },
        priority: {
          key: "priority",
          name: "Priority",
          schema: { type: "string", enum: ["Low", "Medium", "High", "Urgent"] },
          frontMatterKey: "priority",
          required: false,
        },
        completed: {
          key: "completed",
          name: "Completed",
          schema: { type: "boolean" },
          frontMatterKey: "completed",
          required: false,
        },
        dueDate: {
          key: "dueDate",
          name: "Due Date",
          schema: { type: "date" },
          frontMatterKey: "due_date",
          required: false,
        },
      },
      template: {
        version: "1.0.0",
        content: "# {{title}}\n\nPriority: {{priority}}\nDue: {{dueDate}}",
        variables: {},
      },
    };

    // Wait for Obsidian to be ready
    const app2 = await getObsidianApp(page);
    expect(app2).toBeDefined();

    // Create base with views
    const viewGenerationResult = await page.evaluate(async (noteType) => {
      const app = (window as any).app;
      if (!app) {
        throw new Error("Obsidian app not available");
      }

      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (!plugin) {
        throw new Error("Task Sync plugin not available");
      }

      const typeNote = plugin.typeNote;
      if (!typeNote) {
        throw new Error("TypeNote not available");
      }

      // Register the note type
      typeNote.registry.register(noteType);

      // Create base with automatic view generation
      const basesIntegration = typeNote.basesIntegration;
      return await basesIntegration.createBaseFromNoteType(noteType.id, {
        generateViews: true,
        viewTypes: ["table", "priority-filtered"],
      });
    }, taskNoteType);

    expect(viewGenerationResult.success).toBe(true);
    expect(viewGenerationResult.viewsGenerated).toBeGreaterThan(0);

    // Verify the base file contains generated views
    const baseContent = await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("custom-task.base");
      return await app.vault.read(file);
    });

    expect(baseContent).toContain("views:");
    expect(baseContent).toContain("type: table");
    expect(baseContent).toContain("Priority");
  });

  test("should handle property type mapping for base generation", async ({
    page,
  }) => {
    // Wait for Obsidian to be ready
    const app3 = await getObsidianApp(page);
    expect(app3).toBeDefined();

    // Test that TypeNote property types are correctly mapped to base properties
    const mappingResult = await page.evaluate(async () => {
      const app = (window as any).app;
      if (!app) {
        throw new Error("Obsidian app not available");
      }

      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (!plugin) {
        throw new Error("Task Sync plugin not available");
      }

      const typeNote = plugin.typeNote;
      if (!typeNote) {
        throw new Error("TypeNote not available");
      }

      const basesIntegration = typeNote.basesIntegration;
      if (!basesIntegration) {
        throw new Error("BasesIntegration not available");
      }

      // Test property type mapping
      const mappings = [
        { typeNoteType: "string", expectedBaseType: "text" },
        { typeNoteType: "number", expectedBaseType: "number" },
        { typeNoteType: "boolean", expectedBaseType: "checkbox" },
        { typeNoteType: "date", expectedBaseType: "date" },
        { typeNoteType: "array", expectedBaseType: "list" },
      ];

      const results = [];
      for (const mapping of mappings) {
        const baseType = basesIntegration.mapTypeNoteTypeToBaseType(
          mapping.typeNoteType
        );
        results.push({
          typeNoteType: mapping.typeNoteType,
          expectedBaseType: mapping.expectedBaseType,
          actualBaseType: baseType,
          matches: baseType === mapping.expectedBaseType,
        });
      }

      return results;
    });

    // Verify all mappings are correct
    for (const result of mappingResult) {
      expect(result.matches).toBe(true);
      expect(result.actualBaseType).toBe(result.expectedBaseType);
    }
  });
});
