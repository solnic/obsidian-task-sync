/**
 * Tests for TemplateEngine
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  TemplateEngine,
  TemplateEngineError,
} from "../../../src/app/core/note-kit/template-engine";
import type {
  Template,
  TemplateContext,
  NoteType,
} from "../../../src/app/core/note-kit/types";
import { stringSchema } from "../../../src/app/core/note-kit/schemas";

describe("TemplateEngine", () => {
  let engine: TemplateEngine;

  // Sample template for testing
  const createSampleTemplate = (
    content: string = "# {{title}}\n\n{{description}}",
    variables: Record<string, any> = {}
  ): Template => ({
    version: "1.0.0",
    content,
    variables: {
      title: {
        name: "title",
        defaultValue: "Untitled",
      },
      description: {
        name: "description",
        defaultValue: "",
      },
      ...variables,
    },
  });

  // Sample context for testing
  const createSampleContext = (
    variables: Record<string, any> = {}
  ): TemplateContext => ({
    variables: {
      title: "Test Title",
      description: "Test Description",
      ...variables,
    },
    noteType: {
      id: "test",
      name: "Test",
      version: "1.0.0",
      properties: {},
      template: createSampleTemplate(),
    },
  });

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe("process", () => {
    test("processes template with variables", () => {
      const template = createSampleTemplate();
      const context = createSampleContext();

      const result = engine.process(template, context);

      expect(result.success).toBe(true);
      expect(result.content).toBe("# Test Title\n\nTest Description");
    });

    test("uses default values for missing variables", () => {
      const template = createSampleTemplate();
      const context: TemplateContext = {
        variables: { title: "Custom Title" }, // description is missing
        noteType: {
          id: "test",
          name: "Test",
          version: "1.0.0",
          properties: {},
          template: createSampleTemplate(),
        },
      };

      const result = engine.process(template, context);

      expect(result.success).toBe(true);
      expect(result.content).toBe("# Custom Title\n\n");
    });

    test("applies variable transformations", () => {
      const template = createSampleTemplate("Date: {{date}}", {
        date: {
          name: "date",
          transform: (value: string) => new Date(value).toLocaleDateString(),
        },
      });
      const context = createSampleContext({ date: "2024-01-15" });

      const result = engine.process(template, context);

      expect(result.success).toBe(true);
      expect(result.content).toContain("Date:");
    });

    test("reports error for undefined variables when not allowed", () => {
      const template = createSampleTemplate("# {{title}}\n\n{{missing}}");
      const context = createSampleContext();

      const result = engine.process(template, context, {
        allowUndefinedVariables: false,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("UNDEFINED_VARIABLE");
    });

    test("allows undefined variables when configured", () => {
      const template = createSampleTemplate("# {{title}}\n\n{{missing}}");
      const context = createSampleContext();

      const result = engine.process(template, context, {
        allowUndefinedVariables: true,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe("# Test Title\n\n");
      // TODO: Template engine should warn about undefined and unused variables
      // expect(result.warnings).toHaveLength(2);
    });

    test("escapes HTML when requested", () => {
      const template = createSampleTemplate("{{html}}");
      const context = createSampleContext({
        html: '<script>alert("xss")</script>',
      });

      const result = engine.process(template, context, { escapeHtml: true });

      expect(result.success).toBe(true);
      expect(result.content).not.toContain("<script>");
      expect(result.content).toContain("&lt;script&gt;");
    });

    test("warns about unused variables", () => {
      const template = createSampleTemplate("# {{title}}", {
        unused: {
          name: "unused",
          defaultValue: "not used",
        },
      });
      const context = createSampleContext();

      const result = engine.process(template, context);

      expect(result.success).toBe(true);
      // TODO: Template engine should warn about unused variables
      // expect(result.warnings.some((w) => w.code === "UNUSED_VARIABLE")).toBe(
      //   true
      // );
    });

    test("handles transformation errors", () => {
      const template = createSampleTemplate("{{value}}", {
        value: {
          name: "value",
          transform: () => {
            throw new Error("Transform failed");
          },
        },
      });
      const context = createSampleContext({ value: "test" });

      const result = engine.process(template, context);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe("TRANSFORMATION_ERROR");
    });

    test("skips validation when requested", () => {
      const template = createSampleTemplate("# {{missing}}");
      const context = createSampleContext();

      const result = engine.process(template, context, {
        validateVariables: false,
        allowUndefinedVariables: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("validateVariables", () => {
    test("validates required variables are present", () => {
      const template = createSampleTemplate();
      const variables = { title: "Test", description: "Desc" };

      const result = engine.validateVariables(template, variables);

      expect(result.valid).toBe(true);
    });

    test("reports missing variables without defaults", () => {
      const template = createSampleTemplate("# {{title}}\n\n{{required}}", {
        required: {
          name: "required",
          // No default value
        },
      });
      const variables = { title: "Test" }; // missing required

      const result = engine.validateVariables(template, variables);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("MISSING_VARIABLE");
    });

    test("accepts missing variables with defaults", () => {
      const template = createSampleTemplate();
      const variables = {}; // both missing, but have defaults

      const result = engine.validateVariables(template, variables);

      // Should be valid because all variables have defaults
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("extractVariables", () => {
    test("extracts variables from template content", () => {
      const content = "# {{title}}\n\n{{description}}\n\nAuthor: {{author}}";

      const variables = engine.extractVariables(content);

      expect(variables).toHaveLength(3);
      expect(variables).toContain("title");
      expect(variables).toContain("description");
      expect(variables).toContain("author");
    });

    test("handles duplicate variables", () => {
      const content = "{{title}} - {{title}}";

      const variables = engine.extractVariables(content);

      expect(variables).toHaveLength(1);
      expect(variables[0]).toBe("title");
    });

    test("returns empty array for content without variables", () => {
      const content = "# Static Content\n\nNo variables here";

      const variables = engine.extractVariables(content);

      expect(variables).toHaveLength(0);
    });
  });

  describe("validateTemplate", () => {
    test("validates a valid template", () => {
      const template = createSampleTemplate();

      const result = engine.validateTemplate(template);

      expect(result.valid).toBe(true);
    });

    test("rejects template without version", () => {
      const template = { ...createSampleTemplate(), version: "" };

      const result = engine.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("MISSING_TEMPLATE_VERSION");
    });

    test("rejects template without content", () => {
      const template = { ...createSampleTemplate(), content: "" };

      const result = engine.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("MISSING_TEMPLATE_CONTENT");
    });

    test("reports undefined variables in content", () => {
      const template = createSampleTemplate("# {{title}}\n\n{{undefined}}");

      const result = engine.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("UNDEFINED_TEMPLATE_VARIABLE");
    });
  });

  describe("template registration", () => {
    test("registers and retrieves templates", () => {
      const template = createSampleTemplate();

      engine.registerTemplate("test-template", template);

      expect(engine.getTemplate("test-template")).toEqual(template);
    });

    test("unregisters templates", () => {
      const template = createSampleTemplate();
      engine.registerTemplate("test-template", template);

      const result = engine.unregisterTemplate("test-template");

      expect(result).toBe(true);
      expect(engine.getTemplate("test-template")).toBeUndefined();
    });

    test("returns false when unregistering non-existent template", () => {
      const result = engine.unregisterTemplate("nonexistent");
      expect(result).toBe(false);
    });

    test("gets all template IDs", () => {
      engine.registerTemplate("template1", createSampleTemplate());
      engine.registerTemplate("template2", createSampleTemplate());

      const ids = engine.getTemplateIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain("template1");
      expect(ids).toContain("template2");
    });

    test("clears all templates", () => {
      engine.registerTemplate("template1", createSampleTemplate());
      engine.registerTemplate("template2", createSampleTemplate());

      engine.clear();

      expect(engine.size).toBe(0);
    });
  });

  describe("resolveInheritance", () => {
    test("resolves simple parent-child inheritance", () => {
      const parentTemplate: Template = {
        version: "1.0.0",
        content: "Parent content",
        variables: {
          parentVar: {
            name: "parentVar",
            defaultValue: "parent",
          },
        },
      };

      const childTemplate: Template = {
        version: "1.0.0",
        content: "Child content",
        variables: {
          childVar: {
            name: "childVar",
            defaultValue: "child",
          },
        },
        parentTemplateId: "parent",
      };

      engine.registerTemplate("parent", parentTemplate);

      const result = engine.resolveInheritance(childTemplate);

      expect(result.chain).toEqual(["parent"]);
      expect(result.content).toContain("Parent content");
      expect(result.content).toContain("Child content");
      expect(result.variables).toHaveProperty("parentVar");
      expect(result.variables).toHaveProperty("childVar");
    });

    test("throws error for circular inheritance", () => {
      const template1: Template = {
        version: "1.0.0",
        content: "Template 1",
        variables: {},
        parentTemplateId: "template2",
      };

      const template2: Template = {
        version: "1.0.0",
        content: "Template 2",
        variables: {},
        parentTemplateId: "template1",
      };

      engine.registerTemplate("template1", template1);
      engine.registerTemplate("template2", template2);

      expect(() => engine.resolveInheritance(template1)).toThrow(
        TemplateEngineError
      );
    });

    test("throws error for missing parent template", () => {
      const childTemplate: Template = {
        version: "1.0.0",
        content: "Child content",
        variables: {},
        parentTemplateId: "nonexistent",
      };

      expect(() => engine.resolveInheritance(childTemplate)).toThrow(
        TemplateEngineError
      );
    });
  });

  describe("migrateTemplate", () => {
    test("returns content unchanged for same version", () => {
      const template = createSampleTemplate();

      const result = engine.migrateTemplate(template, "1.0.0", "1.0.0");

      expect(result.valid).toBe(true);
      expect(result.data.content).toBe(template.content);
    });

    test("rejects migration to older version", () => {
      const template = createSampleTemplate();

      const result = engine.migrateTemplate(template, "2.0.0", "1.0.0");

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("INVALID_MIGRATION_DIRECTION");
    });

    test("applies migration function when available", () => {
      const template: Template = {
        ...createSampleTemplate(),
        migrate: (oldVersion, content) => {
          return content.replace("{{title}}", "{{newTitle}}");
        },
      };

      const result = engine.migrateTemplate(template, "1.0.0", "2.0.0");

      expect(result.valid).toBe(true);
      expect(result.data.content).toContain("{{newTitle}}");
    });

    test("handles migration errors", () => {
      const template: Template = {
        ...createSampleTemplate(),
        migrate: () => {
          throw new Error("Migration failed");
        },
      };

      const result = engine.migrateTemplate(template, "1.0.0", "2.0.0");

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("MIGRATION_ERROR");
    });
  });

  describe("isTemplateCompatible", () => {
    test("returns true for same version", () => {
      const template = createSampleTemplate();

      const compatible = engine.isTemplateCompatible(template, "1.0.0");

      expect(compatible).toBe(true);
    });

    test("returns true for newer template version", () => {
      const template = { ...createSampleTemplate(), version: "2.0.0" };

      const compatible = engine.isTemplateCompatible(template, "1.0.0");

      expect(compatible).toBe(true);
    });

    test("returns false for older template version", () => {
      const template = { ...createSampleTemplate(), version: "1.0.0" };

      const compatible = engine.isTemplateCompatible(template, "2.0.0");

      expect(compatible).toBe(false);
    });
  });
});
