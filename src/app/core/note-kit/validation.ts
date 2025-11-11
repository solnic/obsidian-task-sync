/**
 * Validation utilities for NoteKit
 * Provides validation helpers and result builders
 */

import { z } from "zod";
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PropertyDefinition,
  NoteType,
} from "./types";

// Re-export ValidationResult for external use
export type { ValidationResult };

/**
 * Create a successful validation result
 */
export function createValidResult(data: any): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    data,
  };
}

/**
 * Create a failed validation result
 */
export function createInvalidResult(
  errors: ValidationError[],
  warnings: ValidationWarning[] = []
): ValidationResult {
  return {
    valid: false,
    errors,
    warnings,
  };
}

/**
 * Create a validation error
 */
export function createValidationError(
  message: string,
  code: string,
  options?: {
    propertyKey?: string;
    path?: string[];
    expected?: any;
    actual?: any;
  }
): ValidationError {
  return {
    message,
    code,
    propertyKey: options?.propertyKey,
    path: options?.path,
    expected: options?.expected,
    actual: options?.actual,
  };
}

/**
 * Create a validation warning
 */
export function createValidationWarning(
  message: string,
  code: string,
  options?: {
    propertyKey?: string;
    path?: string[];
    suggestion?: string;
  }
): ValidationWarning {
  return {
    message,
    code,
    propertyKey: options?.propertyKey,
    path: options?.path,
    suggestion: options?.suggestion,
  };
}

/**
 * Convert Zod error to validation errors
 */
export function zodErrorToValidationErrors(
  error: z.ZodError,
  propertyKey?: string
): ValidationError[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String);

    return createValidationError(issue.message, issue.code, {
      propertyKey: propertyKey || path[0],
      path,
      expected: "expected" in issue ? issue.expected : undefined,
      actual: "received" in issue ? issue.received : undefined,
    });
  });
}

/**
 * Validate a single property value
 */
export function validateProperty(
  propertyDef: PropertyDefinition,
  value: any
): ValidationResult {
  try {
    // Validate with Zod schema
    const validatedValue = propertyDef.schema.parse(value);

    // Apply transformation if provided
    const transformedValue = propertyDef.transform
      ? propertyDef.transform(validatedValue)
      : validatedValue;

    return createValidResult(transformedValue);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = zodErrorToValidationErrors(error, propertyDef.key);
      return createInvalidResult(errors);
    }

    // Unknown error
    return createInvalidResult([
      createValidationError(
        `Validation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        "VALIDATION_ERROR",
        { propertyKey: propertyDef.key }
      ),
    ]);
  }
}

/**
 * Validate all properties in a note type
 */
export function validateProperties(
  noteType: NoteType,
  properties: Record<string, any>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const validatedData: Record<string, any> = {};

  // Validate each property definition
  for (const [key, propertyDef] of Object.entries(noteType.properties)) {
    let value = properties[propertyDef.frontMatterKey];

    // Apply default value if value is missing
    if (
      (value === undefined || value === null) &&
      propertyDef.defaultValue !== undefined
    ) {
      value = propertyDef.defaultValue;
      validatedData[propertyDef.frontMatterKey] = propertyDef.defaultValue;
    }

    // Check required properties (after applying defaults)
    if (propertyDef.required && (value === undefined || value === null)) {
      errors.push(
        createValidationError(
          `Required property '${propertyDef.name}' is missing`,
          "REQUIRED_PROPERTY_MISSING",
          { propertyKey: key }
        )
      );
      continue;
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Validate the property
    const result = validateProperty(propertyDef, value);

    if (!result.valid) {
      errors.push(...result.errors);
    } else {
      validatedData[propertyDef.frontMatterKey] = result.data;
    }

    warnings.push(...result.warnings);
  }

  // If there are errors, return invalid result
  if (errors.length > 0) {
    return createInvalidResult(errors, warnings);
  }

  // Run cross-property validation if defined
  if (noteType.crossPropertyValidation) {
    const crossValidationResult =
      noteType.crossPropertyValidation(validatedData);

    if (!crossValidationResult.valid) {
      return createInvalidResult(
        [...errors, ...crossValidationResult.errors],
        [...warnings, ...crossValidationResult.warnings]
      );
    }

    warnings.push(...crossValidationResult.warnings);
  }

  return {
    valid: true,
    errors: [],
    warnings,
    data: validatedData,
  };
}

/**
 * Validate note type definition
 * Ensures the note type itself is valid
 */
export function validateNoteType(noteType: NoteType): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate ID
  if (!noteType.id || noteType.id.trim() === "") {
    errors.push(
      createValidationError("Note type ID is required", "INVALID_NOTE_TYPE_ID")
    );
  }

  // Validate name
  if (!noteType.name || noteType.name.trim() === "") {
    errors.push(
      createValidationError(
        "Note type name is required",
        "INVALID_NOTE_TYPE_NAME"
      )
    );
  }

  // Validate version
  if (!noteType.version || noteType.version.trim() === "") {
    errors.push(
      createValidationError(
        "Note type version is required",
        "INVALID_NOTE_TYPE_VERSION"
      )
    );
  }

  // Validate properties
  if (!noteType.properties || Object.keys(noteType.properties).length === 0) {
    warnings.push(
      createValidationWarning(
        "Note type has no properties defined",
        "NO_PROPERTIES_DEFINED",
        {
          suggestion: "Consider adding at least one property to the note type",
        }
      )
    );
  }

  // Validate each property definition
  for (const [key, propertyDef] of Object.entries(noteType.properties || {})) {
    if (!propertyDef.key || propertyDef.key.trim() === "") {
      errors.push(
        createValidationError(
          `Property '${key}' has invalid key`,
          "INVALID_PROPERTY_KEY",
          { propertyKey: key }
        )
      );
    }

    if (!propertyDef.name || propertyDef.name.trim() === "") {
      errors.push(
        createValidationError(
          `Property '${key}' has invalid name`,
          "INVALID_PROPERTY_NAME",
          { propertyKey: key }
        )
      );
    }

    if (
      !propertyDef.frontMatterKey ||
      propertyDef.frontMatterKey.trim() === ""
    ) {
      errors.push(
        createValidationError(
          `Property '${key}' has invalid front-matter key`,
          "INVALID_FRONT_MATTER_KEY",
          { propertyKey: key }
        )
      );
    }

    if (!propertyDef.schema) {
      errors.push(
        createValidationError(
          `Property '${key}' has no schema defined`,
          "NO_SCHEMA_DEFINED",
          { propertyKey: key }
        )
      );
    }
  }

  // Validate template
  if (!noteType.template) {
    errors.push(
      createValidationError(
        "Note type template is required",
        "NO_TEMPLATE_DEFINED"
      )
    );
  } else {
    if (!noteType.template.version || noteType.template.version.trim() === "") {
      errors.push(
        createValidationError(
          "Template version is required",
          "INVALID_TEMPLATE_VERSION"
        )
      );
    }

    if (!noteType.template.content || noteType.template.content.trim() === "") {
      warnings.push(
        createValidationWarning(
          "Template has no content",
          "EMPTY_TEMPLATE_CONTENT",
          {
            suggestion: "Consider adding content to the template",
          }
        )
      );
    }
  }

  if (errors.length > 0) {
    return createInvalidResult(errors, warnings);
  }

  return {
    valid: true,
    errors: [],
    warnings,
    data: noteType,
  };
}

/**
 * Merge multiple validation results
 */
export function mergeValidationResults(
  results: ValidationResult[]
): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  let allValid = true;

  for (const result of results) {
    if (!result.valid) {
      allValid = false;
    }
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  if (!allValid) {
    return createInvalidResult(allErrors, allWarnings);
  }

  return {
    valid: true,
    errors: [],
    warnings: allWarnings,
  };
}
