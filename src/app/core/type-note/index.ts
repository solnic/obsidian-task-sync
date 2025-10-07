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
 * Phase 1.1: Core Types and Interfaces ✅
 * Phase 1.2: Note Type Registry ✅
 * Phase 1.3: Template System Foundation ✅
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
// Export registry
export {
  TypeRegistry,
  RegistryError,
  type RegisterOptions,
  type RetrieveOptions,
  type SerializedNoteType,
  type SerializedPropertyDefinition,
  type SerializedTemplate,
} from "./registry";

// Export template engine
export {
  TemplateEngine,
  TemplateEngineError,
  type ProcessOptions,
  type InheritanceResult,
} from "./template-engine";

// Export template manager
export {
  TemplateManager,
  type TemplateProvider,
  type TemplateDetectionResult,
  type TemplateApplicationOptions,
  type TemplateApplicationResult,
  type TemplatePreferences,
} from "./template-manager";

// Export file manager
export {
  FileManager,
  type FileCreationOptions,
  type FileCreationResult,
  type FileUpdateOptions,
  type FileUpdateResult,
  type FileValidationResult,
} from "./file-manager";

// Export front-matter processor
export {
  FrontMatterProcessor,
  type FrontMatterModificationOptions,
  type FrontMatterModificationResult,
  type FrontMatterBackup,
} from "./front-matter-processor";

// Export file watcher
export {
  FileWatcher,
  type FileChangeType,
  type FileChangeEvent,
  type FileWatcherOptions,
  type FileWatcherEventHandler,
} from "./file-watcher";

// Export bulk operations
export {
  BulkOperations,
  type MigrationOperationType,
  type MigrationOperation,
  type MigrationPlan,
  type BulkOperationOptions,
  type BulkOperationResult,
  type FileMigrationResult,
} from "./bulk-operations";

// Export backup manager
export {
  BackupManager,
  type BackupType,
  type BackupEntry,
  type BackupOptions,
  type RestoreOptions,
  type BackupResult,
  type RestoreResult,
} from "./backup-manager";

// Export property processor
export {
  PropertyProcessor,
  type PropertyProcessingOptions,
  type PropertyProcessingResult,
  type PropertyDependency,
  type ConditionalValidation,
} from "./property-processor";

// Export note processor
export {
  NoteProcessor,
  type NoteProcessingOptions,
  type NoteProcessingResult,
  type FrontMatterExtractionResult,
  type NoteTypeDetectionResult,
} from "./note-processor";

// Export Obsidian property manager
export {
  ObsidianPropertyManager,
  type ObsidianPropertyType,
  type PropertyTypeInfo,
  TYPE_NOTE_TO_OBSIDIAN_TYPE_MAP,
} from "./obsidian-property-manager";

// Export bases integration
export {
  BasesIntegration,
  type BasePropertyType,
  type BaseProperty,
  type BaseView,
  type BaseConfig,
  type BaseCreationOptions,
  type BaseCreationResult,
  TYPE_NOTE_TO_BASE_TYPE_MAP,
} from "./bases-integration";

// Export main TypeNote API
export { TypeNote } from "./TypeNote";

// Export type cache
export {
  TypeCache,
  type TypeCacheOptions,
  type TypeCacheEntry,
  type TypeCacheStatistics,
  type CachePersistenceAdapter,
} from "./type-cache";
