/**
 * Schema Utilities
 * Helper functions for creating and reconstructing Zod schemas
 */

import { z } from "zod";
import {
  stringSchema,
  numberSchema,
  booleanSchema,
  dateSchema,
  enumSchema,
} from "./schemas";
import type { NoteType, PropertyDefinition, SelectOption } from "./types";

/**
 * Create a Zod schema from a type string
 * Used when reconstructing schemas from serialized note types
 */
export function createSchemaFromType(
  schemaType: string,
  selectOptions?: SelectOption[]
): z.ZodType<any> {
  switch (schemaType) {
    case "string":
      return stringSchema;
    case "number":
      return numberSchema;
    case "boolean":
      return booleanSchema;
    case "date":
      return dateSchema;
    case "select":
      // For select type, create enum schema from options
      if (selectOptions && selectOptions.length > 0) {
        const values = selectOptions.map((opt) => opt.value);
        return enumSchema(values as [string, ...string[]]);
      }
      return stringSchema; // Fallback if no options
    case "enum":
      // For enum type, we need the options to be passed separately
      // This is handled by the caller
      return stringSchema; // Fallback
    case "array":
      return z.array(z.string()).default([]);
    default:
      return stringSchema;
  }
}

/**
 * Reconstruct schemas for all properties in a note type
 * This is needed when loading note types from JSON storage
 * where Zod schemas can't be serialized
 */
export function reconstructNoteTypeSchemas(noteType: NoteType): NoteType {
  const reconstructedProperties: Record<string, PropertyDefinition> = {};

  for (const [key, property] of Object.entries(noteType.properties)) {
    // If schema already exists, keep it
    if (property.schema) {
      reconstructedProperties[key] = property;
      continue;
    }

    // Reconstruct schema from type
    const schema = createSchemaFromType(property.type, property.selectOptions);

    reconstructedProperties[key] = {
      ...property,
      schema,
    };
  }

  return {
    ...noteType,
    properties: reconstructedProperties,
  };
}

/**
 * Get schema type string from a Zod schema
 * This is a heuristic approach - in production you might want
 * to store the schema type separately
 */
export function getSchemaTypeFromSchema(schema: z.ZodType<any>): string {
  if (schema === stringSchema) return "string";
  if (schema === numberSchema) return "number";
  if (schema === booleanSchema) return "boolean";
  if (schema === dateSchema) return "date";
  return "string"; // default fallback
}

