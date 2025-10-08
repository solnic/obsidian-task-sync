/**
 * Core TypeNote types and interfaces
 * Platform-agnostic note type definitions, validation, and templating system
 */

import { z } from "zod";

/**
 * Semantic version string (e.g., "1.0.0", "2.1.3")
 */
export type SemanticVersion = string;

/**
 * Property type enumeration
 * Defines the supported property types in TypeNote
 */
export type PropertyType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "array"
  | "select";

/**
 * Property definition with Zod schema and transformation rules
 * Defines how a single property should be validated and processed
 */
export interface PropertyDefinition {
  /** Unique identifier for this property */
  key: string;

  /** Human-readable name */
  name: string;

  /** Property type for UI rendering and validation */
  type: PropertyType;

  /** Zod schema for validation and type coercion */
  schema: z.ZodType<any>;

  /** Front-matter key where this property is stored */
  frontMatterKey: string;

  /** Whether this property is required */
  required: boolean;

  /** Default value if not provided */
  defaultValue?: any;

  /** Optional transformation function applied after validation */
  transform?: (value: any) => any;

  /** Optional description for documentation */
  description?: string;

  /** Whether this property should be displayed in UI */
  visible?: boolean;

  /** Display order in forms/UI (lower numbers first) */
  order?: number;

  /** Options for enum properties */
  options?: string[];

  /** Source for computed/formula properties (e.g., "file.ctime", "formula.Title") */
  source?: string;

  /** Whether this property should be rendered as a link in Obsidian Bases */
  link?: boolean;
  /** Options for select properties with colors */
  selectOptions?: SelectOption[];

  /** Form-specific configuration */
  form?: {
    /** Whether to hide this property in forms */
    hidden?: boolean;
    /** Label to display in forms. If false, no label is shown. If string, use that label. If undefined, use property.name */
    label?: string | false;
    /** Whether this is the main property (rendered first in forms) */
    main?: boolean;
  };
}

/**
 * Select option with optional color
 * Used for select property type
 */
export interface SelectOption {
  /** Option value */
  value: string;

  /** Optional color for this option (hex code) */
  color?: string;
}

/**
 * Property settings data for UI
 * Extends PropertyDefinition with UI-specific fields
 */
export interface PropertySettingsData {
  /** Unique identifier for this property */
  key: string;

  /** Human-readable name */
  name: string;

  /** Property type as string for UI (before schema creation) */
  schemaType: string;

  /** Front-matter key where this property is stored */
  frontMatterKey: string;

  /** Whether this property is required */
  required: boolean;

  /** Default value if not provided */
  defaultValue?: any;

  /** Optional description for documentation */
  description?: string;

  /** Whether this property should be displayed in UI */
  visible?: boolean;

  /** Display order in forms/UI (lower numbers first) */
  order?: number;

  /** Options for enum properties (comma-separated string in UI) */
  enumOptions?: string;

  /** Options for select properties with colors */
  selectOptions?: SelectOption[];

  /** Form-specific configuration */
  form?: {
    /** Whether to hide this property in forms */
    hidden?: boolean;
    /** Whether this is the main property (rendered first in forms) */
    main?: boolean;
  };
}

/**
 * Template variable definition
 * Defines a variable that can be used in template content
 */
export interface TemplateVariable {
  /** Variable name (used as {{variableName}} in templates) */
  name: string;

  /** Default value if not provided */
  defaultValue?: any;

  /** Optional transformation function */
  transform?: (value: any) => any;

  /** Description for documentation */
  description?: string;
}

/**
 * Template definition with versioning and update mechanisms
 * Defines how notes of this type should be created
 */
export interface Template {
  /** Template version (semantic versioning) */
  version: SemanticVersion;

  /** Template content with variable placeholders */
  content: string;

  /** Variables available in this template */
  variables: Record<string, TemplateVariable>;

  /** Optional parent template ID for inheritance */
  parentTemplateId?: string;

  /** Migration function to update from previous version */
  migrate?: (oldVersion: SemanticVersion, content: string) => string;

  /** Template metadata */
  metadata?: {
    /** Template author */
    author?: string;

    /** Template description */
    description?: string;

    /** Creation date */
    createdAt?: Date;

    /** Last update date */
    updatedAt?: Date;

    /** Tags for categorization */
    tags?: string[];
  };
}

/**
 * Note type definition
 * Complete definition of a typed note including schema, metadata, and template
 */
export interface NoteType {
  /** Unique identifier for this note type */
  id: string;

  /** Human-readable name */
  name: string;

  /** Note type version (semantic versioning) */
  version: SemanticVersion;

  /** Property definitions for this note type */
  properties: Record<string, PropertyDefinition>;

  /** Template for creating new notes of this type */
  template: Template;

  /** Optional metadata */
  metadata?: {
    /** Note type description */
    description?: string;

    /** Note type author */
    author?: string;

    /** Icon for UI display */
    icon?: string;

    /** Color for UI display */
    color?: string;

    /** Category for organization */
    category?: string;

    /** Tags for categorization */
    tags?: string[];

    /** Creation date */
    createdAt?: Date;

    /** Last update date */
    updatedAt?: Date;

    /** Whether this note type is deprecated */
    deprecated?: boolean;

    /** Replacement note type ID if deprecated */
    replacedBy?: string;
  };

  /** Optional validation rules that span multiple properties */
  crossPropertyValidation?: (
    properties: Record<string, any>
  ) => ValidationResult;
}

/**
 * Validation result
 * Result of validating a note or property
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors (if any) */
  errors: ValidationError[];

  /** Validation warnings (non-blocking issues) */
  warnings: ValidationWarning[];

  /** Validated and transformed data (if valid) */
  data?: any;
}

/**
 * Validation error
 * Represents a validation failure
 */
export interface ValidationError {
  /** Property key that failed validation */
  propertyKey?: string;

  /** Error message */
  message: string;

  /** Error code for programmatic handling */
  code: string;

  /** Path to the error (for nested properties) */
  path?: string[];

  /** Expected value or type */
  expected?: any;

  /** Actual value that failed */
  actual?: any;
}

/**
 * Validation warning
 * Represents a non-blocking validation issue
 */
export interface ValidationWarning {
  /** Property key that triggered warning */
  propertyKey?: string;

  /** Warning message */
  message: string;

  /** Warning code for programmatic handling */
  code: string;

  /** Path to the warning (for nested properties) */
  path?: string[];

  /** Suggested fix */
  suggestion?: string;
}

/**
 * Version comparison result
 */
export enum VersionComparison {
  /** First version is less than second */
  LESS_THAN = -1,

  /** Versions are equal */
  EQUAL = 0,

  /** First version is greater than second */
  GREATER_THAN = 1,

  /** Versions are incompatible or invalid */
  INCOMPATIBLE = -2,
}

/**
 * Note type metadata for registry
 * Lightweight metadata for listing and searching note types
 */
export interface NoteTypeMetadata {
  /** Note type ID */
  id: string;

  /** Note type name */
  name: string;

  /** Note type version */
  version: SemanticVersion;

  /** Description */
  description?: string;

  /** Category */
  category?: string;

  /** Tags */
  tags?: string[];

  /** Whether deprecated */
  deprecated?: boolean;

  /** Icon */
  icon?: string;

  /** Color */
  color?: string;
}

/**
 * Template processing context
 * Context provided when processing a template
 */
export interface TemplateContext {
  /** Variable values */
  variables: Record<string, any>;

  /** Note type being created */
  noteType: NoteType;

  /** Additional context data */
  metadata?: Record<string, any>;

  /** Timestamp when template is being processed */
  timestamp?: Date;
}

/**
 * Template processing result
 */
export interface TemplateProcessingResult {
  /** Whether processing succeeded */
  success: boolean;

  /** Processed content (if successful) */
  content?: string;

  /** Front-matter properties (if successful) */
  frontMatter?: Record<string, any>;

  /** Processing errors (if any) */
  errors: ValidationError[];

  /** Processing warnings (if any) */
  warnings: ValidationWarning[];
}
