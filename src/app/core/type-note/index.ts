/**
 * TypeNote Core Module
 * Platform-agnostic note type definitions, validation, and templating system
 *
 * This module provides the foundation for typed notes with:
 * - Type-safe property definitions with Zod schemas
 * - Template versioning and migration support
 * - Comprehensive validation with detailed error reporting
 * - Semantic version comparison utilities
 *
 * Phase 1.1: Core Types and Interfaces
 */

// Export all types
export type {
  SemanticVersion,
  PropertyDefinition,
  TemplateVariable,
  Template,
  NoteType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  NoteTypeMetadata,
  TemplateContext,
  TemplateProcessingResult,
} from "./types";

export { VersionComparison } from "./types";

// Export version utilities
export {
  parseVersion,
  isValidVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  isCompatible,
  nextMajor,
  nextMinor,
  nextPatch,
  sortVersions,
  getLatestVersion,
  satisfiesRange,
  formatVersion,
} from "./version";

// Export validation utilities
export {
  createValidResult,
  createInvalidResult,
  createValidationError,
  createValidationWarning,
  zodErrorToValidationErrors,
  validateProperty,
  validateProperties,
  validateNoteType,
  mergeValidationResults,
} from "./validation";

// Export common schemas
export {
  stringSchema,
  optionalStringSchema,
  nonEmptyStringSchema,
  numberSchema,
  optionalNumberSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  booleanSchema,
  optionalBooleanSchema,
  dateSchema,
  optionalDateSchema,
  stringArraySchema,
  optionalStringArraySchema,
  numberArraySchema,
  optionalNumberArraySchema,
  emailSchema,
  optionalEmailSchema,
  urlSchema,
  optionalUrlSchema,
  enumSchema,
  optionalEnumSchema,
  recordSchema,
  optionalRecordSchema,
  versionSchema,
  optionalVersionSchema,
  colorSchema,
  optionalColorSchema,
  markdownSchema,
  optionalMarkdownSchema,
  filePathSchema,
  optionalFilePathSchema,
  tagsSchema,
  optionalTagsSchema,
  prioritySchema,
  optionalPrioritySchema,
  statusSchema,
  optionalStatusSchema,
  customSchema,
  transformSchema,
  unionSchema,
  intersectionSchema,
  nullableSchema,
  withDefault,
  literalSchema,
  noteTypeMetadataSchema,
  templateMetadataSchema,
} from "./schemas";

