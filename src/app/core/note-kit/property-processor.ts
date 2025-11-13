/**
 * PropertyProcessor - Front-matter Property Processing Engine
 * Handles property validation, transformation, conditional validation, and dependency resolution
 */

import type {
  PropertyDefinition,
  NoteType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "./types";
import {
  createValidResult,
  createInvalidResult,
  createValidationError,
  createValidationWarning,
} from "./validation";
import { z } from "zod";

/**
 * Property processing options
 */
export interface PropertyProcessingOptions {
  /** Whether to apply transformations */
  applyTransformations?: boolean;

  /** Whether to use default values for missing properties */
  useDefaults?: boolean;

  /** Whether to validate required properties */
  validateRequired?: boolean;

  /** Whether to run conditional validation */
  runConditionalValidation?: boolean;

  /** Whether to resolve property dependencies */
  resolveDependencies?: boolean;
}

/**
 * Property dependency definition
 * Defines how one property depends on another
 */
export interface PropertyDependency {
  /** Property key that has the dependency */
  propertyKey: string;

  /** Property keys that this property depends on */
  dependsOn: string[];

  /** Validation function that checks if dependency is satisfied */
  validate: (value: any, dependencies: Record<string, any>) => ValidationResult;
}

/**
 * Conditional validation rule
 * Defines validation that only applies under certain conditions
 */
export interface ConditionalValidation {
  /** Property key to validate */
  propertyKey: string;

  /** Condition that must be met for validation to run */
  condition: (properties: Record<string, any>) => boolean;

  /** Validation function to run if condition is met */
  validate: (value: any, properties: Record<string, any>) => ValidationResult;

  /** Description of the conditional validation */
  description?: string;
}

/**
 * Association validator interface
 * Allows external validation of association properties
 */
export interface AssociationValidator {
  /**
   * Validate that referenced entities exist
   * @param noteTypeId - The note type ID being referenced
   * @param references - Array of entity references (e.g., note names or IDs)
   * @returns ValidationResult indicating if all references are valid
   */
  validateReferences(
    noteTypeId: string,
    references: string[]
  ): Promise<ValidationResult> | ValidationResult;
}

/**
 * Property processing result
 */
export interface PropertyProcessingResult extends ValidationResult {
  /** Processed and validated properties */
  properties?: Record<string, any>;

  /** Properties that were transformed */
  transformed?: string[];

  /** Properties that used default values */
  defaulted?: string[];
}

/**
 * PropertyProcessor handles property validation and processing
 */
export class PropertyProcessor {
  private dependencies: Map<string, PropertyDependency> = new Map();
  private conditionalValidations: Map<string, ConditionalValidation[]> =
    new Map();
  private associationValidator: AssociationValidator | null = null;

  /**
   * Set an association validator for validating association properties
   */
  setAssociationValidator(validator: AssociationValidator | null): void {
    this.associationValidator = validator;
  }

  /**
   * Register a property dependency
   */
  registerDependency(dependency: PropertyDependency): void {
    this.dependencies.set(dependency.propertyKey, dependency);
  }

  /**
   * Unregister a property dependency
   */
  unregisterDependency(propertyKey: string): boolean {
    return this.dependencies.delete(propertyKey);
  }

  /**
   * Register a conditional validation rule
   */
  registerConditionalValidation(validation: ConditionalValidation): void {
    const existing =
      this.conditionalValidations.get(validation.propertyKey) || [];
    existing.push(validation);
    this.conditionalValidations.set(validation.propertyKey, existing);
  }

  /**
   * Unregister all conditional validations for a property
   */
  unregisterConditionalValidations(propertyKey: string): boolean {
    return this.conditionalValidations.delete(propertyKey);
  }

  /**
   * Clear all dependencies and conditional validations
   */
  clear(): void {
    this.dependencies.clear();
    this.conditionalValidations.clear();
  }

  /**
   * Process properties from front-matter
   */
  async process(
    noteType: NoteType,
    frontMatter: Record<string, any>,
    options: PropertyProcessingOptions = {}
  ): Promise<PropertyProcessingResult> {
    const {
      applyTransformations = true,
      useDefaults = true,
      validateRequired = true,
      runConditionalValidation = true,
      resolveDependencies = true,
    } = options;

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const processedProperties: Record<string, any> = {};
    const transformed: string[] = [];
    const defaulted: string[] = [];

    // First pass: Validate and process each property
    for (const [key, propertyDef] of Object.entries(noteType.properties)) {
      const value = frontMatter[propertyDef.frontMatterKey];

      // Handle missing values
      if (value === undefined || value === null) {
        if (validateRequired && propertyDef.required) {
          errors.push(
            createValidationError(
              `Required property '${propertyDef.name}' is missing`,
              "REQUIRED_PROPERTY_MISSING",
              { propertyKey: key }
            )
          );
          continue;
        }

        // Use default value if available
        if (useDefaults && propertyDef.defaultValue !== undefined) {
          processedProperties[propertyDef.frontMatterKey] =
            propertyDef.defaultValue;
          defaulted.push(key);
        }
        continue;
      }

      // Validate with Zod schema
      const validationResult = this.validateWithSchema(propertyDef, value);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
        continue;
      }

      let processedValue = validationResult.data;

      // Apply transformation if requested
      if (applyTransformations && propertyDef.transform) {
        try {
          processedValue = propertyDef.transform(processedValue);
          transformed.push(key);
        } catch (error) {
          errors.push(
            createValidationError(
              `Transformation failed for '${propertyDef.name}': ${error}`,
              "TRANSFORMATION_ERROR",
              { propertyKey: key }
            )
          );
          continue;
        }
      }

      processedProperties[propertyDef.frontMatterKey] = processedValue;
    }

    // If we have errors, return early
    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        warnings,
        properties: processedProperties,
        transformed,
        defaulted,
      };
    }

    // Second pass: Resolve dependencies
    if (resolveDependencies) {
      const dependencyResult = this.resolveDependencies(
        noteType,
        processedProperties
      );
      errors.push(...dependencyResult.errors);
      warnings.push(...dependencyResult.warnings);
    }

    // Third pass: Run conditional validations
    if (runConditionalValidation) {
      const conditionalResult = this.runConditionalValidations(
        noteType,
        processedProperties
      );
      errors.push(...conditionalResult.errors);
      warnings.push(...conditionalResult.warnings);
    }

    // Fourth pass: Validate association properties if validator is set
    if (this.associationValidator) {
      const associationResult = await this.validateAssociations(
        noteType,
        processedProperties
      );
      errors.push(...associationResult.errors);
      warnings.push(...associationResult.warnings);
    }

    // Fifth pass: Run cross-property validation if defined
    if (noteType.crossPropertyValidation) {
      const crossResult = noteType.crossPropertyValidation(processedProperties);
      if (!crossResult.valid) {
        errors.push(...crossResult.errors);
        warnings.push(...crossResult.warnings);
      }
    }

    // Return final result
    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        warnings,
        properties: processedProperties,
        transformed,
        defaulted,
      };
    }

    return {
      valid: true,
      errors: [],
      warnings,
      properties: processedProperties,
      transformed,
      defaulted,
    };
  }

  /**
   * Validate a single property value with its schema
   */
  private validateWithSchema(
    propertyDef: PropertyDefinition,
    value: any
  ): ValidationResult {
    try {
      const validatedValue = propertyDef.schema.parse(value);
      return createValidResult(validatedValue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = (error.issues || []).map((err: any) =>
          createValidationError(err.message, "SCHEMA_VALIDATION_ERROR", {
            propertyKey: propertyDef.key,
            path: err.path,
            expected: err.expected,
            actual: value,
          })
        );
        return createInvalidResult(
          errors.length > 0
            ? errors
            : [
                createValidationError(
                  "Schema validation failed",
                  "SCHEMA_VALIDATION_ERROR",
                  { propertyKey: propertyDef.key }
                ),
              ]
        );
      }

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
   * Resolve property dependencies
   */
  private resolveDependencies(
    noteType: NoteType,
    properties: Record<string, any>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [propertyKey, dependency] of this.dependencies) {
      const propertyDef = noteType.properties[propertyKey];
      if (!propertyDef) continue;

      const value = properties[propertyDef.frontMatterKey];

      // Collect dependency values
      const dependencyValues: Record<string, any> = {};
      for (const depKey of dependency.dependsOn) {
        const depDef = noteType.properties[depKey];
        if (depDef) {
          dependencyValues[depKey] = properties[depDef.frontMatterKey];
        }
      }

      // Validate dependency (even if value is undefined - the validation function decides)
      const result = dependency.validate(value, dependencyValues);
      if (!result.valid) {
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }

    if (errors.length > 0) {
      return createInvalidResult(errors, warnings);
    }

    const result = createValidResult({});
    result.warnings = warnings;
    return result;
  }

  /**
   * Run conditional validations
   */
  private runConditionalValidations(
    noteType: NoteType,
    properties: Record<string, any>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [propertyKey, validations] of this.conditionalValidations) {
      const propertyDef = noteType.properties[propertyKey];
      if (!propertyDef) continue;

      const value = properties[propertyDef.frontMatterKey];

      for (const validation of validations) {
        // Check if condition is met
        if (!validation.condition(properties)) continue;

        // Run validation
        const result = validation.validate(value, properties);
        if (!result.valid) {
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        }
      }
    }

    if (errors.length > 0) {
      return createInvalidResult(errors, warnings);
    }

    const result = createValidResult({});
    result.warnings = warnings;
    return result;
  }

  /**
   * Validate association properties
   */
  private async validateAssociations(
    noteType: NoteType,
    properties: Record<string, any>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.associationValidator) {
      return createValidResult({});
    }

    // Find all association properties
    for (const [key, propertyDef] of Object.entries(noteType.properties)) {
      if (propertyDef.type !== "association" || !propertyDef.association) {
        continue;
      }

      const value = properties[propertyDef.frontMatterKey];

      // Skip if no value
      if (value === undefined || value === null) {
        continue;
      }

      // Convert to array for uniform handling
      const references = propertyDef.association.multiple
        ? Array.isArray(value)
          ? value
          : []
        : value
        ? [value]
        : [];

      // Skip if empty
      if (references.length === 0) {
        continue;
      }

      // Validate references
      const result = await this.associationValidator.validateReferences(
        propertyDef.association.noteTypeId,
        references
      );

      if (!result.valid) {
        // Add property context to errors
        for (const error of result.errors) {
          errors.push({
            ...error,
            propertyKey: key,
          });
        }
        warnings.push(...result.warnings);
      }
    }

    if (errors.length > 0) {
      return createInvalidResult(errors, warnings);
    }

    const result = createValidResult({});
    result.warnings = warnings;
    return result;
  }
}

