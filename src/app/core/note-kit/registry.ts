/**
 * TypeRegistry - Note Type Registry
 * Manages note type definitions with registration, retrieval, and version management
 */

import type {
  NoteType,
  NoteTypeMetadata,
  PropertyType,
  SemanticVersion,
  ValidationResult,
  PropertyDefinition,
} from "./types";
import { VersionComparison } from "./types";
import { compareVersions } from "./version";
import {
  createValidResult,
  createInvalidResult,
  createValidationError,
} from "./validation";
import { reconstructNoteTypeSchemas } from "./schema-utils";
import { PropertyAccessor } from "./PropertyAccessor";

/**
 * Registry error types
 */
export class RegistryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "RegistryError";
  }
}

/**
 * Options for registering a note type
 */
export interface RegisterOptions {
  /** Whether to allow overwriting existing note types */
  allowOverwrite?: boolean;

  /** Whether to validate the note type before registration */
  validate?: boolean;

  /** Whether to check version compatibility when updating */
  checkCompatibility?: boolean;
}

/**
 * Options for retrieving note types
 */
export interface RetrieveOptions {
  /** Include deprecated note types */
  includeDeprecated?: boolean;

  /** Filter by category */
  category?: string;

  /** Filter by tags */
  tags?: string[];
}

/**
 * Serialized note type for persistence
 * Functions and Zod schemas are excluded from serialization
 */
export interface SerializedNoteType {
  id: string;
  name: string;
  version: SemanticVersion;
  properties: Record<string, SerializedPropertyDefinition>;
  template: SerializedTemplate;
  metadata?: NoteType["metadata"];
}

/**
 * Serialized property definition
 */
export interface SerializedPropertyDefinition {
  key: string;
  name: string;
  type: PropertyType; // Property type for UI rendering
  schemaType: string; // Type identifier for schema reconstruction
  frontMatterKey: string;
  required: boolean;
  defaultValue?: any;
  description?: string;
  visible?: boolean;
  order?: number;
  options?: string[]; // Options for enum properties
  source?: string; // Source for computed/formula properties
  link?: boolean; // Whether property should be rendered as a link
}

/**
 * Serialized template
 */
export interface SerializedTemplate {
  version: SemanticVersion;
  content: string;
  variables: Record<string, any>;
  parentTemplateId?: string;
  metadata?: any;
}

/**
 * Enhance a NoteType by wrapping its properties with PropertyAccessor
 * This provides convenient .default and .options accessors on properties
 */
function enhanceNoteType(noteType: NoteType): NoteType {
  const enhancedProperties: Record<string, PropertyDefinition> = {};

  for (const [key, prop] of Object.entries(noteType.properties)) {
    enhancedProperties[key] = new PropertyAccessor(prop);
  }

  return {
    ...noteType,
    properties: enhancedProperties,
  };
}

/**
 * TypeRegistry manages note type definitions
 */
export class TypeRegistry {
  private noteTypes: Map<string, NoteType> = new Map();
  private versionHistory: Map<string, SemanticVersion[]> = new Map();

  /**
   * Register a new note type
   */
  register(
    noteType: NoteType,
    options: RegisterOptions = {}
  ): ValidationResult {
    const {
      allowOverwrite = false,
      validate = true,
      checkCompatibility = true,
    } = options;

    // Validate note type if requested
    if (validate) {
      const validationResult = this.validateNoteType(noteType);
      if (!validationResult.valid) {
        return validationResult;
      }
    }

    // Check if note type already exists
    const existing = this.noteTypes.get(noteType.id);

    if (existing) {
      if (!allowOverwrite) {
        return createInvalidResult([
          createValidationError(
            `Note type '${noteType.id}' already exists with version ${existing.version}. Use allowOverwrite option to update.`,
            "DUPLICATE_NOTE_TYPE"
          ),
        ]);
      }

      // If overwriting, check version compatibility
      if (checkCompatibility && existing.version !== noteType.version) {
        const compatibilityResult = this.checkVersionCompatibility(
          existing,
          noteType
        );
        if (!compatibilityResult.valid) {
          return compatibilityResult;
        }
      }
    }

    // Register the note type
    this.noteTypes.set(noteType.id, noteType);

    // Update version history
    const versions = this.versionHistory.get(noteType.id) || [];
    if (!versions.includes(noteType.version)) {
      versions.push(noteType.version);
      versions.sort((a, b) => {
        const comparison = compareVersions(a, b);
        return comparison === VersionComparison.LESS_THAN
          ? -1
          : comparison === VersionComparison.GREATER_THAN
          ? 1
          : 0;
      });
      this.versionHistory.set(noteType.id, versions);
    }

    return createValidResult({ noteType });
  }

  /**
   * Unregister a note type
   */
  unregister(noteTypeId: string): boolean {
    const deleted = this.noteTypes.delete(noteTypeId);
    if (deleted) {
      this.versionHistory.delete(noteTypeId);
    }
    return deleted;
  }

  /**
   * Get a note type by ID
   * Returns an enhanced note type with PropertyAccessor wrappers on properties
   */
  get(noteTypeId: string): NoteType | undefined {
    const noteType = this.noteTypes.get(noteTypeId);
    if (!noteType) return undefined;

    // Reconstruct schemas and enhance properties
    const reconstructed = reconstructNoteTypeSchemas(noteType);
    return enhanceNoteType(reconstructed);
  }

  /**
   * Check if a note type exists
   */
  has(noteTypeId: string): boolean {
    return this.noteTypes.has(noteTypeId);
  }

  /**
   * Get all registered note types
   */
  getAll(options: RetrieveOptions = {}): NoteType[] {
    const { includeDeprecated = false, category, tags } = options;

    let noteTypes = Array.from(this.noteTypes.values());

    // Filter deprecated
    if (!includeDeprecated) {
      noteTypes = noteTypes.filter((nt) => !nt.metadata?.deprecated);
    }

    // Filter by category
    if (category) {
      noteTypes = noteTypes.filter((nt) => nt.metadata?.category === category);
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      noteTypes = noteTypes.filter((nt) => {
        const noteTags = nt.metadata?.tags || [];
        return tags.some((tag) => noteTags.includes(tag));
      });
    }

    // Reconstruct schemas and enhance all note types before returning
    return noteTypes.map((nt) => enhanceNoteType(reconstructNoteTypeSchemas(nt)));
  }

  /**
   * Get metadata for all note types (lightweight)
   */
  getAllMetadata(options: RetrieveOptions = {}): NoteTypeMetadata[] {
    const noteTypes = this.getAll(options);
    return noteTypes.map((nt) => this.extractMetadata(nt));
  }

  /**
   * Get version history for a note type
   */
  getVersionHistory(noteTypeId: string): SemanticVersion[] {
    return this.versionHistory.get(noteTypeId) || [];
  }

  /**
   * Get the latest version of a note type
   */
  getLatestVersion(noteTypeId: string): SemanticVersion | undefined {
    const versions = this.getVersionHistory(noteTypeId);
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
  }

  /**
   * Clear all note types
   */
  clear(): void {
    this.noteTypes.clear();
    this.versionHistory.clear();
  }

  /**
   * Get the number of registered note types
   */
  get size(): number {
    return this.noteTypes.size;
  }

  /**
   * Validate a note type definition
   */
  validateNoteType(noteType: NoteType): ValidationResult {
    const errors = [];

    // Validate ID
    if (!noteType.id || typeof noteType.id !== "string") {
      errors.push(
        createValidationError(
          "Note type ID is required and must be a string",
          "INVALID_NOTE_TYPE_ID"
        )
      );
    }

    // Validate name
    if (!noteType.name || typeof noteType.name !== "string") {
      errors.push(
        createValidationError(
          "Note type name is required and must be a string",
          "INVALID_NOTE_TYPE_NAME"
        )
      );
    }

    // Validate version
    if (!noteType.version || typeof noteType.version !== "string") {
      errors.push(
        createValidationError(
          "Note type version is required and must be a string",
          "INVALID_NOTE_TYPE_VERSION"
        )
      );
    }

    // Validate properties
    if (!noteType.properties || typeof noteType.properties !== "object") {
      errors.push(
        createValidationError(
          "Note type properties are required and must be an object",
          "INVALID_NOTE_TYPE_PROPERTIES"
        )
      );
    } else {
      // Validate each property definition
      for (const [key, prop] of Object.entries(noteType.properties)) {
        if (!prop.key || !prop.name || !prop.schema || !prop.frontMatterKey) {
          errors.push(
            createValidationError(
              `Property '${key}' is missing required fields`,
              "INVALID_PROPERTY_DEFINITION",
              { propertyKey: key }
            )
          );
        }
      }
    }

    // Validate template
    if (!noteType.template || typeof noteType.template !== "object") {
      errors.push(
        createValidationError(
          "Note type template is required and must be an object",
          "INVALID_NOTE_TYPE_TEMPLATE"
        )
      );
    } else {
      if (!noteType.template.version || !noteType.template.content) {
        errors.push(
          createValidationError(
            "Template must have version and content",
            "INVALID_TEMPLATE"
          )
        );
      }
    }

    return errors.length > 0
      ? createInvalidResult(errors)
      : createValidResult({ noteType });
  }

  /**
   * Check version compatibility between two note types
   */
  private checkVersionCompatibility(
    existing: NoteType,
    updated: NoteType
  ): ValidationResult {
    const comparison = compareVersions(updated.version, existing.version);

    // New version must be greater than existing
    if (comparison !== VersionComparison.GREATER_THAN) {
      return createInvalidResult([
        createValidationError(
          `New version ${updated.version} must be greater than existing version ${existing.version}`,
          "INVALID_VERSION_UPDATE",
          {
            expected: `version > ${existing.version}`,
            actual: updated.version,
          }
        ),
      ]);
    }

    return createValidResult({ compatible: true });
  }

  /**
   * Extract metadata from a note type
   */
  private extractMetadata(noteType: NoteType): NoteTypeMetadata {
    return {
      id: noteType.id,
      name: noteType.name,
      version: noteType.version,
      description: noteType.metadata?.description,
      category: noteType.metadata?.category,
      tags: noteType.metadata?.tags,
      deprecated: noteType.metadata?.deprecated,
      icon: noteType.metadata?.icon,
      color: noteType.metadata?.color,
    };
  }

  /**
   * Serialize a note type for persistence
   * Note: Zod schemas and functions are not serialized
   */
  serialize(noteType: NoteType): SerializedNoteType {
    const serializedProperties: Record<string, SerializedPropertyDefinition> =
      {};

    for (const [key, prop] of Object.entries(noteType.properties)) {
      serializedProperties[key] = {
        key: prop.key,
        name: prop.name,
        type: prop.type,
        schemaType: this.getSchemaType(prop.schema),
        frontMatterKey: prop.frontMatterKey,
        required: prop.required,
        defaultValue: prop.defaultValue,
        description: prop.description,
        visible: prop.visible,
        order: prop.order,
        options: prop.options,
        source: prop.source,
        link: prop.link,
      };
    }

    const serializedTemplate: SerializedTemplate = {
      version: noteType.template.version,
      content: noteType.template.content,
      variables: noteType.template.variables,
      parentTemplateId: noteType.template.parentTemplateId,
      metadata: noteType.template.metadata,
    };

    return {
      id: noteType.id,
      name: noteType.name,
      version: noteType.version,
      properties: serializedProperties,
      template: serializedTemplate,
      metadata: noteType.metadata,
    };
  }

  /**
   * Serialize all note types
   */
  serializeAll(): SerializedNoteType[] {
    return Array.from(this.noteTypes.values()).map((nt) => this.serialize(nt));
  }

  /**
   * Get schema type identifier for serialization
   * This is a simplified version - in production, you'd need a more robust schema registry
   */
  private getSchemaType(schema: any): string {
    // This is a placeholder - actual implementation would need to inspect
    // the Zod schema and determine its type
    // For now, we'll return a generic identifier
    return schema._def?.typeName || "unknown";
  }

  /**
   * Export registry to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.serializeAll(), null, 2);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalNoteTypes: number;
    deprecatedCount: number;
    categories: string[];
    tags: string[];
  } {
    const noteTypes = this.getAll({ includeDeprecated: true });
    const deprecatedCount = noteTypes.filter(
      (nt) => nt.metadata?.deprecated
    ).length;

    const categories = new Set<string>();
    const tags = new Set<string>();

    for (const nt of noteTypes) {
      if (nt.metadata?.category) {
        categories.add(nt.metadata.category);
      }
      if (nt.metadata?.tags) {
        nt.metadata.tags.forEach((tag) => tags.add(tag));
      }
    }

    return {
      totalNoteTypes: noteTypes.length,
      deprecatedCount,
      categories: Array.from(categories),
      tags: Array.from(tags),
    };
  }
}
