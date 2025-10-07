/**
 * Tests for PropertyProcessor
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  PropertyProcessor,
  type PropertyDependency,
  type ConditionalValidation,
} from "../../../src/app/core/type-note/property-processor";
import type { NoteType } from "../../../src/app/core/type-note/types";
import {
  stringSchema,
  numberSchema,
  dateSchema,
  optionalStringSchema,
} from "../../../src/app/core/type-note/schemas";
import {
  createValidResult,
  createInvalidResult,
  createValidationError,
} from "../../../src/app/core/type-note/validation";

describe("PropertyProcessor", () => {
  let processor: PropertyProcessor;

  // Sample note type for testing
  const createSampleNoteType = (): NoteType => ({
    id: "task",
    name: "Task",
    version: "1.0.0",
    properties: {
      title: {
        key: "title",
        name: "Title",
        schema: stringSchema,
        frontMatterKey: "title",
        required: true,
      },
      description: {
        key: "description",
        name: "Description",
        schema: optionalStringSchema,
        frontMatterKey: "description",
        required: false,
        defaultValue: "No description",
      },
      priority: {
        key: "priority",
        name: "Priority",
        schema: numberSchema,
        frontMatterKey: "priority",
        required: false,
        defaultValue: 0,
        transform: (value: number) => Math.max(0, Math.min(10, value)), // Clamp to 0-10
      },
      dueDate: {
        key: "dueDate",
        name: "Due Date",
        schema: dateSchema,
        frontMatterKey: "due_date",
        required: false,
      },
    },
    template: {
      version: "1.0.0",
      content: "# {{title}}",
      variables: {},
    },
  });

  beforeEach(() => {
    processor = new PropertyProcessor();
  });

  describe("process", () => {
    test("processes valid properties", () => {
      const noteType = createSampleNoteType();
      const frontMatter = {
        title: "Test Task",
        description: "A test task",
        priority: 5,
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(true);
      expect(result.properties).toEqual({
        title: "Test Task",
        description: "A test task",
        priority: 5,
      });
    });

    test("reports error for missing required property", () => {
      const noteType = createSampleNoteType();
      const frontMatter = {
        description: "Missing title",
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("REQUIRED_PROPERTY_MISSING");
      expect(result.errors[0].propertyKey).toBe("title");
    });

    test("uses default values for missing optional properties", () => {
      const noteType = createSampleNoteType();
      const frontMatter = {
        title: "Test Task",
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(true);
      expect(result.properties?.description).toBe("No description");
      expect(result.properties?.priority).toBe(0);
      expect(result.defaulted).toContain("description");
      expect(result.defaulted).toContain("priority");
    });

    test("applies transformations", () => {
      const noteType = createSampleNoteType();
      const frontMatter = {
        title: "Test Task",
        priority: 15, // Should be clamped to 10
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(true);
      expect(result.properties?.priority).toBe(10);
      expect(result.transformed).toContain("priority");
    });

    test("reports schema validation errors", () => {
      const noteType = createSampleNoteType();
      const frontMatter = {
        title: "Test Task",
        priority: "invalid", // Should be a number
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("SCHEMA_VALIDATION_ERROR");
    });

    test("handles transformation errors", () => {
      const noteType = createSampleNoteType();
      noteType.properties.priority.transform = () => {
        throw new Error("Transform failed");
      };

      const frontMatter = {
        title: "Test Task",
        priority: 5,
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("TRANSFORMATION_ERROR");
    });

    test("skips transformations when disabled", () => {
      const noteType = createSampleNoteType();
      const frontMatter = {
        title: "Test Task",
        priority: 15,
      };

      const result = processor.process(noteType, frontMatter, {
        applyTransformations: false,
      });

      expect(result.valid).toBe(true);
      expect(result.properties?.priority).toBe(15); // Not clamped
      expect(result.transformed).toHaveLength(0);
    });

    test("skips default values when disabled", () => {
      const noteType = createSampleNoteType();
      const frontMatter = {
        title: "Test Task",
      };

      const result = processor.process(noteType, frontMatter, {
        useDefaults: false,
      });

      expect(result.valid).toBe(true);
      expect(result.properties?.description).toBeUndefined();
      expect(result.defaulted).toHaveLength(0);
    });

    test("skips required validation when disabled", () => {
      const noteType = createSampleNoteType();
      const frontMatter = {
        description: "No title",
      };

      const result = processor.process(noteType, frontMatter, {
        validateRequired: false,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("property dependencies", () => {
    test("validates property dependencies", () => {
      const noteType = createSampleNoteType();
      const dependency: PropertyDependency = {
        propertyKey: "dueDate",
        dependsOn: ["priority"],
        validate: (value, deps) => {
          if (deps.priority > 5 && !value) {
            return createInvalidResult([
              createValidationError(
                "High priority tasks must have a due date",
                "DEPENDENCY_VALIDATION_ERROR",
                { propertyKey: "dueDate" }
              ),
            ]);
          }
          return createValidResult({});
        },
      };

      processor.registerDependency(dependency);

      const frontMatter = {
        title: "High Priority Task",
        priority: 8,
        // Missing due_date
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "DEPENDENCY_VALIDATION_ERROR")).toBe(
        true
      );
    });

    test("passes when dependency is satisfied", () => {
      const noteType = createSampleNoteType();
      const dependency: PropertyDependency = {
        propertyKey: "dueDate",
        dependsOn: ["priority"],
        validate: (value, deps) => {
          if (deps.priority > 5 && !value) {
            return createInvalidResult([
              createValidationError(
                "High priority tasks must have a due date",
                "DEPENDENCY_VALIDATION_ERROR",
                { propertyKey: "dueDate" }
              ),
            ]);
          }
          return createValidResult({});
        },
      };

      processor.registerDependency(dependency);

      const frontMatter = {
        title: "High Priority Task",
        priority: 8,
        due_date: "2024-12-31",
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(true);
    });

    test("unregisters dependencies", () => {
      const dependency: PropertyDependency = {
        propertyKey: "dueDate",
        dependsOn: ["priority"],
        validate: () => createValidResult({}),
      };

      processor.registerDependency(dependency);
      const unregistered = processor.unregisterDependency("dueDate");

      expect(unregistered).toBe(true);
    });
  });

  describe("conditional validation", () => {
    test("runs conditional validation when condition is met", () => {
      const noteType = createSampleNoteType();
      const validation: ConditionalValidation = {
        propertyKey: "description",
        condition: (props) => props.priority > 7,
        validate: (value) => {
          if (!value || value === "No description") {
            return createInvalidResult([
              createValidationError(
                "High priority tasks must have a description",
                "CONDITIONAL_VALIDATION_ERROR",
                { propertyKey: "description" }
              ),
            ]);
          }
          return createValidResult({});
        },
        description: "High priority tasks require description",
      };

      processor.registerConditionalValidation(validation);

      const frontMatter = {
        title: "Critical Task",
        priority: 9,
        // description will use default "No description"
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.code === "CONDITIONAL_VALIDATION_ERROR")
      ).toBe(true);
    });

    test("skips conditional validation when condition is not met", () => {
      const noteType = createSampleNoteType();
      const validation: ConditionalValidation = {
        propertyKey: "description",
        condition: (props) => props.priority > 7,
        validate: (value) => {
          if (!value || value === "No description") {
            return createInvalidResult([
              createValidationError(
                "High priority tasks must have a description",
                "CONDITIONAL_VALIDATION_ERROR",
                { propertyKey: "description" }
              ),
            ]);
          }
          return createValidResult({});
        },
      };

      processor.registerConditionalValidation(validation);

      const frontMatter = {
        title: "Low Priority Task",
        priority: 3,
        // description will use default "No description"
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(true);
    });

    test("unregisters conditional validations", () => {
      const validation: ConditionalValidation = {
        propertyKey: "description",
        condition: () => true,
        validate: () => createValidResult({}),
      };

      processor.registerConditionalValidation(validation);
      const unregistered = processor.unregisterConditionalValidations("description");

      expect(unregistered).toBe(true);
    });
  });

  describe("cross-property validation", () => {
    test("runs cross-property validation", () => {
      const noteType = createSampleNoteType();
      noteType.crossPropertyValidation = (props) => {
        if (props.priority > 5 && !props.due_date) {
          return createInvalidResult([
            createValidationError(
              "High priority tasks must have a due date",
              "CROSS_PROPERTY_VALIDATION_ERROR"
            ),
          ]);
        }
        return createValidResult({});
      };

      const frontMatter = {
        title: "High Priority Task",
        priority: 8,
      };

      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.code === "CROSS_PROPERTY_VALIDATION_ERROR")
      ).toBe(true);
    });
  });

  describe("clear", () => {
    test("clears all dependencies and validations", () => {
      processor.registerDependency({
        propertyKey: "test",
        dependsOn: [],
        validate: () => createValidResult({}),
      });

      processor.registerConditionalValidation({
        propertyKey: "test",
        condition: () => true,
        validate: () => createValidResult({}),
      });

      processor.clear();

      // After clearing, processing should work without running any custom validations
      const noteType = createSampleNoteType();
      const frontMatter = { title: "Test" };
      const result = processor.process(noteType, frontMatter);

      expect(result.valid).toBe(true);
    });
  });
});

