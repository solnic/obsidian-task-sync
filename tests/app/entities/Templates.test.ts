/**
 * Tests for Templates entity with Queries and Operations
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Templates, templateQueries, templateOperations } from "../../../src/app/entities/Templates";
import { templateStore } from "../../../src/app/stores/templateStore";
import type { Template } from "../../../src/app/core/template-entities";

describe("Templates", () => {
  beforeEach(() => {
    // Reset the store before each test
    templateStore.reset();
  });

  describe("Queries", () => {
    test("should return empty array when no templates exist", async () => {
      const templates = await templateQueries.getAll();
      expect(templates).toEqual([]);
    });

    test("should return templates after they are added", async () => {
      const templateData: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "task",
        name: "Test Task Template",
        content: "# {{title}}\n\n{{description}}",
        variables: [
          { name: "title", type: "text", required: true },
          { name: "description", type: "text", required: false },
        ],
        filePath: "Templates/task-template.md",
        fileExists: true,
        usageCount: 0,
      };

      const template = await templateOperations.create(templateData);
      const templates = await templateQueries.getAll();

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe(template.id);
      expect(templates[0].name).toBe("Test Task Template");
    });

    test("should get template by ID", async () => {
      const templateData: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "project",
        name: "Test Project Template",
        content: "# {{name}}\n\n{{description}}",
        variables: [
          { name: "name", type: "text", required: true },
          { name: "description", type: "text", required: false },
        ],
        filePath: "Templates/project-template.md",
        fileExists: true,
        usageCount: 0,
      };

      const template = await templateOperations.create(templateData);
      const foundTemplate = await templateQueries.getById(template.id);

      expect(foundTemplate).toBeDefined();
      expect(foundTemplate?.name).toBe("Test Project Template");
    });

    test("should get templates by type", async () => {
      const taskTemplate: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "task",
        name: "Task Template",
        content: "# {{title}}",
        variables: [],
        filePath: "Templates/task.md",
        fileExists: true,
        usageCount: 0,
      };

      const projectTemplate: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "project",
        name: "Project Template",
        content: "# {{name}}",
        variables: [],
        filePath: "Templates/project.md",
        fileExists: true,
        usageCount: 0,
      };

      await templateOperations.create(taskTemplate);
      await templateOperations.create(projectTemplate);

      const taskTemplates = await templateQueries.getByType("task");
      const projectTemplates = await templateQueries.getByType("project");

      expect(taskTemplates).toHaveLength(1);
      expect(taskTemplates[0].type).toBe("task");
      expect(projectTemplates).toHaveLength(1);
      expect(projectTemplates[0].type).toBe("project");
    });

    test("should get available templates (fileExists = true)", async () => {
      const existingTemplate: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "task",
        name: "Existing Template",
        content: "# {{title}}",
        variables: [],
        filePath: "Templates/existing.md",
        fileExists: true,
        usageCount: 0,
      };

      const missingTemplate: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "task",
        name: "Missing Template",
        content: "# {{title}}",
        variables: [],
        filePath: "Templates/missing.md",
        fileExists: false,
        usageCount: 0,
      };

      await templateOperations.create(existingTemplate);
      await templateOperations.create(missingTemplate);

      const availableTemplates = await templateQueries.getAvailableTemplates();

      expect(availableTemplates).toHaveLength(1);
      expect(availableTemplates[0].name).toBe("Existing Template");
    });
  });

  describe("Operations", () => {
    test("should create template with generated ID and timestamps", async () => {
      const templateData: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "area",
        name: "Area Template",
        content: "# {{name}}\n\n{{description}}",
        variables: [],
        filePath: "Templates/area.md",
        fileExists: true,
        usageCount: 0,
      };

      const template = await templateOperations.create(templateData);

      expect(template.id).toBeDefined();
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
      expect(template.name).toBe("Area Template");
      expect(template.type).toBe("area");
    });

    test("should update template", async () => {
      const templateData: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "task",
        name: "Original Name",
        content: "# {{title}}",
        variables: [],
        filePath: "Templates/task.md",
        fileExists: true,
        usageCount: 0,
      };

      const template = await templateOperations.create(templateData);
      const originalUpdatedAt = template.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updatedTemplate = await templateOperations.update({
        ...template,
        name: "Updated Name",
      });

      expect(updatedTemplate.name).toBe("Updated Name");
      expect(updatedTemplate.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    test("should delete template", async () => {
      const templateData: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "task",
        name: "To Delete",
        content: "# {{title}}",
        variables: [],
        filePath: "Templates/delete.md",
        fileExists: true,
        usageCount: 0,
      };

      const template = await templateOperations.create(templateData);
      await templateOperations.delete(template.id);

      const templates = await templateQueries.getAll();
      expect(templates).toHaveLength(0);
    });

    test("should increment usage count", async () => {
      const templateData: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "task",
        name: "Usage Test",
        content: "# {{title}}",
        variables: [],
        filePath: "Templates/usage.md",
        fileExists: true,
        usageCount: 0,
      };

      const template = await templateOperations.create(templateData);
      await templateOperations.incrementUsage(template.id);

      const updatedTemplate = await templateQueries.getById(template.id);
      expect(updatedTemplate?.usageCount).toBe(1);
      expect(updatedTemplate?.lastUsed).toBeInstanceOf(Date);
    });

    test("should update file exists status", async () => {
      const templateData: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        type: "task",
        name: "File Status Test",
        content: "# {{title}}",
        variables: [],
        filePath: "Templates/status.md",
        fileExists: true,
        usageCount: 0,
      };

      const template = await templateOperations.create(templateData);
      await templateOperations.updateFileExists(template.id, false);

      const updatedTemplate = await templateQueries.getById(template.id);
      expect(updatedTemplate?.fileExists).toBe(false);
    });
  });
});
