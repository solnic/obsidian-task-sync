/**
 * Unit tests for NoteKit validation utilities
 */

import { describe, test, expect } from "vitest";
import { z } from "zod";
import {
  createValidResult,
  createInvalidResult,
  createValidationError,
  createValidationWarning,
  zodErrorToValidationErrors,
  validateProperty,
  validateProperties,
  validateNoteType,
  mergeValidationResults,
} from "../../../src/app/core/note-kit/validation";
import type {
  PropertyDefinition,
  NoteType,
} from "../../../src/app/core/note-kit/types";

describe("createValidResult", () => {
  test("creates valid result with data", () => {
    const result = createValidResult({ foo: "bar" });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.data).toEqual({ foo: "bar" });
  });
});

describe("createInvalidResult", () => {
  test("creates invalid result with errors", () => {
    const errors = [
      createValidationError("Error 1", "ERROR_1"),
      createValidationError("Error 2", "ERROR_2"),
    ];

    const result = createInvalidResult(errors);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(errors);
    expect(result.warnings).toEqual([]);
    expect(result.data).toBeUndefined();
  });

  test("creates invalid result with errors and warnings", () => {
    const errors = [createValidationError("Error", "ERROR")];
    const warnings = [createValidationWarning("Warning", "WARNING")];

    const result = createInvalidResult(errors, warnings);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(errors);
    expect(result.warnings).toEqual(warnings);
  });
});

describe("createValidationError", () => {
  test("creates basic error", () => {
    const error = createValidationError("Test error", "TEST_ERROR");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.propertyKey).toBeUndefined();
    expect(error.path).toBeUndefined();
  });

  test("creates error with options", () => {
    const error = createValidationError("Test error", "TEST_ERROR", {
      propertyKey: "testProp",
      path: ["nested", "property"],
      expected: "string",
      actual: 123,
    });

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.propertyKey).toBe("testProp");
    expect(error.path).toEqual(["nested", "property"]);
    expect(error.expected).toBe("string");
    expect(error.actual).toBe(123);
  });
});

describe("createValidationWarning", () => {
  test("creates basic warning", () => {
    const warning = createValidationWarning("Test warning", "TEST_WARNING");

    expect(warning.message).toBe("Test warning");
    expect(warning.code).toBe("TEST_WARNING");
    expect(warning.propertyKey).toBeUndefined();
    expect(warning.path).toBeUndefined();
    expect(warning.suggestion).toBeUndefined();
  });

  test("creates warning with options", () => {
    const warning = createValidationWarning("Test warning", "TEST_WARNING", {
      propertyKey: "testProp",
      path: ["nested", "property"],
      suggestion: "Use a different value",
    });

    expect(warning.message).toBe("Test warning");
    expect(warning.code).toBe("TEST_WARNING");
    expect(warning.propertyKey).toBe("testProp");
    expect(warning.path).toEqual(["nested", "property"]);
    expect(warning.suggestion).toBe("Use a different value");
  });
});

describe("zodErrorToValidationErrors", () => {
  test("converts Zod errors to validation errors", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    try {
      schema.parse({ name: "John", age: "not a number" });
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        const validationErrors = zodErrorToValidationErrors(_error);

        expect(validationErrors.length).toBeGreaterThan(0);
        expect(validationErrors[0].code).toBeDefined();
        expect(validationErrors[0].message).toBeDefined();
      }
    }
  });
});

describe("validateProperty", () => {
  test("validates valid property value", () => {
    const propertyDef: PropertyDefinition = {
      key: "name",
      name: "Name",
      type: "string" as const,
      schema: z.string(),
      frontMatterKey: "name",
      required: true,
    };

    const result = validateProperty(propertyDef, "John Doe");

    expect(result.valid).toBe(true);
    expect(result.data).toBe("John Doe");
    expect(result.errors).toEqual([]);
  });

  test("validates invalid property value", () => {
    const propertyDef: PropertyDefinition = {
      key: "age",
      name: "Age",
      type: "number" as const,
      schema: z.number(),
      frontMatterKey: "age",
      required: true,
    };

    const result = validateProperty(propertyDef, "not a number");

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("applies transformation", () => {
    const propertyDef: PropertyDefinition = {
      key: "name",
      name: "Name",
      type: "string" as const,
      schema: z.string(),
      frontMatterKey: "name",
      required: true,
      transform: (value: unknown) => (value as string).toUpperCase(),
    };

    const result = validateProperty(propertyDef, "john doe");

    expect(result.valid).toBe(true);
    expect(result.data).toBe("JOHN DOE");
  });
});

describe("validateProperties", () => {
  const noteType: NoteType = {
    id: "test-note",
    name: "Test Note",
    version: "1.0.0",
    properties: {
      title: {
        key: "title",
        name: "Title",
        type: "string" as const,
        schema: z.string(),
        frontMatterKey: "title",
        required: true,
      },
      description: {
        key: "description",
        name: "Description",
        type: "string" as const,
        schema: z.string(),
        frontMatterKey: "description",
        required: false,
      },
      count: {
        key: "count",
        name: "Count",
        type: "number" as const,
        schema: z.number(),
        frontMatterKey: "count",
        required: false,
        defaultValue: 0,
      },
    },
    template: {
      version: "1.0.0",
      content: "# {{title}}",
      variables: {},
    },
  };

  test("validates all properties successfully", () => {
    const properties = {
      title: "Test Title",
      description: "Test Description",
      count: 5,
    };

    const result = validateProperties(noteType, properties);

    expect(result.valid).toBe(true);
    expect(result.data).toEqual(properties);
  });

  test("fails when required property is missing", () => {
    const properties = {
      description: "Test Description",
    };

    const result = validateProperties(noteType, properties);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe("REQUIRED_PROPERTY_MISSING");
  });

  test("uses default value for missing optional property", () => {
    const properties = {
      title: "Test Title",
    };

    const result = validateProperties(noteType, properties);

    expect(result.valid).toBe(true);
    expect((result.data as any)?.count).toBe(0);
  });

  test("validates property types", () => {
    const properties = {
      title: "Test Title",
      count: "not a number",
    };

    const result = validateProperties(noteType, properties);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("validateNoteType", () => {
  test("validates valid note type", () => {
    const noteType: NoteType = {
      id: "test-note",
      name: "Test Note",
      version: "1.0.0",
      properties: {
        title: {
          key: "title",
          name: "Title",
          type: "string" as const,
          schema: z.string(),
          frontMatterKey: "title",
          required: true,
        },
      },
      template: {
        version: "1.0.0",
        content: "# {{title}}",
        variables: {},
      },
    };

    const result = validateNoteType(noteType);

    expect(result.valid).toBe(true);
  });

  test("fails when ID is missing", () => {
    const noteType: NoteType = {
      id: "",
      name: "Test Note",
      version: "1.0.0",
      properties: {},
      template: {
        version: "1.0.0",
        content: "",
        variables: {},
      },
    };

    const result = validateNoteType(noteType);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_NOTE_TYPE_ID")).toBe(
      true
    );
  });

  test("fails when name is missing", () => {
    const noteType: NoteType = {
      id: "test-note",
      name: "",
      version: "1.0.0",
      properties: {},
      template: {
        version: "1.0.0",
        content: "",
        variables: {},
      },
    };

    const result = validateNoteType(noteType);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_NOTE_TYPE_NAME")).toBe(
      true
    );
  });

  test("warns when no properties defined", () => {
    const noteType: NoteType = {
      id: "test-note",
      name: "Test Note",
      version: "1.0.0",
      properties: {},
      template: {
        version: "1.0.0",
        content: "Test",
        variables: {},
      },
    };

    const result = validateNoteType(noteType);

    expect(result.warnings.some((w) => w.code === "NO_PROPERTIES_DEFINED")).toBe(
      true
    );
  });
});

describe("mergeValidationResults", () => {
  test("merges multiple valid results", () => {
    const results = [
      createValidResult({ a: 1 }),
      createValidResult({ b: 2 }),
      createValidResult({ c: 3 }),
    ];

    const merged = mergeValidationResults(results);

    expect(merged.valid).toBe(true);
    expect(merged.errors).toEqual([]);
  });

  test("merges results with errors", () => {
    const results = [
      createValidResult({ a: 1 }),
      createInvalidResult([createValidationError("Error 1", "ERROR_1")]),
      createInvalidResult([createValidationError("Error 2", "ERROR_2")]),
    ];

    const merged = mergeValidationResults(results);

    expect(merged.valid).toBe(false);
    expect(merged.errors.length).toBe(2);
  });

  test("merges warnings from all results", () => {
    const results = [
      {
        valid: true,
        errors: [] as any[],
        warnings: [createValidationWarning("Warning 1", "WARNING_1")],
      },
      {
        valid: true,
        errors: [] as any[],
        warnings: [createValidationWarning("Warning 2", "WARNING_2")],
      },
    ];

    const merged = mergeValidationResults(results);

    expect(merged.valid).toBe(true);
    expect(merged.warnings.length).toBe(2);
  });
});

