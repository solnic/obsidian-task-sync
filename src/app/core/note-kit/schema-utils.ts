/**
 * Schema Utilities
 * Helper functions for creating and reconstructing Zod schemas
 */

import { z } from "zod";
import {
  stringSchema,
  optionalStringSchema,
  numberSchema,
  booleanSchema,
  dateSchema,
  enumSchema,
  stringArraySchema,
} from "./schemas";
import type { NoteType, PropertyDefinition, SelectOption } from "./types";

/**
 * Create a Zod schema from a property definition
 * Used when reconstructing schemas from serialized note types or when schemas
 * have been lost through serialization/deserialization
 */
export function createSchemaFromProperty(
  property: PropertyDefinition
): z.ZodType<any> {
  const { type, selectOptions, association, required } = property;

  switch (type) {
    case "string":
      return required ? stringSchema : optionalStringSchema;
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
    case "association":
      // Association properties can be single or multiple
      // Multiple associations use array schema, single uses string schema
      if (association?.multiple) {
        return stringArraySchema;
      } else {
        return required ? stringSchema : optionalStringSchema;
      }
    default:
      return stringSchema;
  }
}



/**
 * Reconstruct schemas for all properties in a note type
 * This is needed when loading note types from JSON storage
 * where Zod schemas can't be serialized, or when schemas have been
 * lost through Svelte reactivity proxies or other transformations
 */
export function reconstructNoteTypeSchemas(noteType: NoteType): NoteType {
  const reconstructedProperties: Record<string, PropertyDefinition> = {};

  for (const [key, property] of Object.entries(noteType.properties)) {
    // Always reconstruct schema to ensure it's a proper Zod schema
    // Schemas can be lost through serialization or reactive proxies
    const schema = createSchemaFromProperty(property);

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

