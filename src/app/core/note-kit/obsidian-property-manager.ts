/**
 * ObsidianPropertyManager - Obsidian Property System Integration
 * Integrates NoteKit with Obsidian's property API, including property type mapping
 * and support for built-in property types (date, number, text, etc.)
 */

import type { App } from "obsidian";
import type { NoteType, PropertyDefinition } from "./types";
import { z } from "zod";

/**
 * Mapping between NoteKit property types and Obsidian property types
 */
export const TYPE_NOTE_TO_OBSIDIAN_TYPE_MAP = {
  string: "text",
  number: "number",
  boolean: "checkbox",
  date: "date",
  array: "multitext",
  select: "text", // Select maps to text in Obsidian (will store the selected value)
  enum: "text", // Enum also maps to text
  object: "text", // Objects are serialized as text in Obsidian
} as const;

/**
 * Obsidian property type definitions (based on actual Obsidian API)
 */
export type ObsidianPropertyType =
  | "text"
  | "number"
  | "checkbox"
  | "date"
  | "datetime"
  | "multitext"
  | "aliases"
  | "tags";

/**
 * Property type information
 */
export interface PropertyTypeInfo {
  name: string;
  obsidianType: ObsidianPropertyType;
  typeNoteType: string;
}

/**
 * ObsidianPropertyManager handles integration between NoteKit and Obsidian's property system
 * Note: Obsidian doesn't have an API to "register" property types - they are inferred automatically
 * This manager provides utilities for type mapping and validation
 */
export class ObsidianPropertyManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Map NoteKit property type to Obsidian property type
   */
  mapTypeNoteTypeToObsidian(typeNoteType: string): ObsidianPropertyType {
    // Handle Zod schema types
    if (typeNoteType.startsWith("Zod")) {
      return this.mapZodTypeToObsidian(typeNoteType);
    }

    // Handle simple type strings
    return (
      TYPE_NOTE_TO_OBSIDIAN_TYPE_MAP[
        typeNoteType as keyof typeof TYPE_NOTE_TO_OBSIDIAN_TYPE_MAP
      ] || "text"
    );
  }

  /**
   * Map Zod schema type to Obsidian property type
   */
  private mapZodTypeToObsidian(zodType: string): ObsidianPropertyType {
    if (zodType.includes("String")) return "text";
    if (zodType.includes("Number")) return "number";
    if (zodType.includes("Boolean")) return "checkbox";
    if (zodType.includes("Date")) return "date";
    if (zodType.includes("Array")) return "multitext";
    return "text";
  }

  /**
   * Infer NoteKit type from Zod schema
   */
  private inferTypeFromZodSchema(schema: z.ZodType<any>): string {
    const typeName = schema.constructor.name;

    if (typeName.includes("String")) return "string";
    if (typeName.includes("Number")) return "number";
    if (typeName.includes("Boolean")) return "boolean";
    if (typeName.includes("Date")) return "date";
    if (typeName.includes("Array")) return "array";

    return "string"; // Default fallback
  }

  /**
   * Get property type information for NoteKit properties
   * Note: Obsidian infers property types automatically, so this provides mapping info
   */
  getNoteTypePropertyInfo(noteType: NoteType): PropertyTypeInfo[] {
    const propertyInfo: PropertyTypeInfo[] = [];

    for (const [key, propertyDef] of Object.entries(noteType.properties)) {
      const typeNoteType = this.inferTypeFromZodSchema(propertyDef.schema);
      const obsidianType = this.mapTypeNoteTypeToObsidian(typeNoteType);

      propertyInfo.push({
        name: propertyDef.frontMatterKey,
        obsidianType,
        typeNoteType,
      });
    }

    return propertyInfo;
  }

  /**
   * Get property type information for a single property
   */
  getPropertyInfo(propertyDef: PropertyDefinition): PropertyTypeInfo {
    const typeNoteType = this.inferTypeFromZodSchema(propertyDef.schema);
    const obsidianType = this.mapTypeNoteTypeToObsidian(typeNoteType);

    return {
      name: propertyDef.frontMatterKey,
      obsidianType,
      typeNoteType,
    };
  }

  /**
   * Get property type from Obsidian's metadata type manager
   * Uses the actual Obsidian API to check property types
   */
  getObsidianPropertyType(propertyName: string): ObsidianPropertyType | null {
    try {
      const metadataTypeManager = (this.app as any).metadataTypeManager;

      if (!metadataTypeManager) {
        return null;
      }

      // Check both properties and types sections
      const propertyType =
        metadataTypeManager.properties?.[propertyName.toLowerCase()]?.type ||
        metadataTypeManager.types?.[propertyName.toLowerCase()]?.type;

      return propertyType || null;
    } catch (error) {
      console.error(`Failed to get property type for ${propertyName}:`, error);
      return null;
    }
  }

  /**
   * Get all property types from Obsidian's metadata type manager
   */
  getAllObsidianPropertyTypes(): Record<string, ObsidianPropertyType> {
    try {
      const metadataTypeManager = (this.app as any).metadataTypeManager;

      if (!metadataTypeManager) {
        return {};
      }

      const allTypes: Record<string, ObsidianPropertyType> = {};

      // Merge properties and types sections
      if (metadataTypeManager.properties) {
        for (const [key, value] of Object.entries(
          metadataTypeManager.properties
        )) {
          if (value && typeof value === "object" && "type" in value) {
            allTypes[key] = (value as any).type;
          }
        }
      }

      if (metadataTypeManager.types) {
        for (const [key, value] of Object.entries(metadataTypeManager.types)) {
          if (value && typeof value === "object" && "type" in value) {
            allTypes[key] = (value as any).type;
          }
        }
      }

      return allTypes;
    } catch (error) {
      console.error("Failed to get all property types:", error);
      return {};
    }
  }

  /**
   * Validate property value against Obsidian's type system
   */
  validatePropertyValue(
    propertyName: string,
    value: any
  ): { valid: boolean; error?: string } {
    const obsidianType = this.getObsidianPropertyType(propertyName);

    if (!obsidianType) {
      // If no type is registered, allow any value (Obsidian will infer the type)
      return { valid: true };
    }

    // Validate based on Obsidian type
    switch (obsidianType) {
      case "text":
        return { valid: typeof value === "string" };
      case "number":
        return { valid: typeof value === "number" && !isNaN(value) };
      case "checkbox":
        return { valid: typeof value === "boolean" };
      case "date":
      case "datetime":
        return { valid: this.isValidDate(value) };
      case "multitext":
      case "tags":
        return {
          valid:
            Array.isArray(value) && value.every((v) => typeof v === "string"),
        };
      case "aliases":
        return {
          valid:
            Array.isArray(value) && value.every((v) => typeof v === "string"),
        };
      default:
        return { valid: true }; // Allow unknown types
    }
  }

  /**
   * Check if a value is a valid date
   */
  private isValidDate(value: any): boolean {
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }

    if (typeof value === "string") {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }

    return false;
  }

  /**
   * Check if NoteKit property types are compatible with Obsidian
   */
  validateTypeNoteCompatibility(noteType: NoteType): {
    compatible: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const propertyInfo = this.getNoteTypePropertyInfo(noteType);

    for (const info of propertyInfo) {
      const obsidianType = this.getObsidianPropertyType(info.name);

      if (obsidianType && obsidianType !== info.obsidianType) {
        issues.push(
          `Property "${info.name}" type mismatch: NoteKit expects "${info.obsidianType}" but Obsidian has "${obsidianType}"`
        );
      }
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  }

  /**
   * Get UI-friendly type mapping for property type selection
   * Returns a mapping of NoteKit types to their display names
   */
  static getTypeMapping(): Record<string, string> {
    return {
      string: "Text",
      number: "Number",
      boolean: "Checkbox",
      date: "Date",
      array: "List",
      select: "Select",
    };
  }
}
