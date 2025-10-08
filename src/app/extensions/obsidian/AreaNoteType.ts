/**
 * Area Note Type Definition for TypeNote Integration
 * Defines the Area note type with all required properties and validation
 */

import type { NoteType, PropertyDefinition } from "../../core/type-note/types";
import {
  stringSchema,
  optionalStringSchema,
  stringArraySchema,
} from "../../core/type-note/schemas";

/**
 * Create the Area note type definition
 */
export function createAreaNoteType(): NoteType {
  // Define properties for Area note type
  const properties: Record<string, PropertyDefinition> = {
    name: {
      key: "name",
      name: "Name",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "Name",
      required: true,
      description: "Area name",
      visible: true,
      order: 1,
      form: {
        main: true,
        label: false, // No label for main field
      },
    },
    type: {
      key: "type",
      name: "Type",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "Type",
      required: true,
      defaultValue: "Area",
      description: "Entity type (always 'Area')",
      visible: false, // Hidden from form, auto-set
      order: 2,
    },
    tags: {
      key: "tags",
      name: "tags",
      type: "array",
      schema: stringArraySchema,
      frontMatterKey: "tags",
      required: false,
      defaultValue: [],
      description: "Area tags",
      visible: true,
      order: 3,
      form: {
        hidden: true, // Hide from primary form section
      },
    },
    description: {
      key: "description",
      name: "Description",
      type: "string",
      schema: optionalStringSchema,
      frontMatterKey: "Description",
      required: false,
      description: "Area description",
      visible: true,
      order: 4,
      form: {
        hidden: true, // Hide from primary form section
      },
    },
  };

  // Create template for Area notes
  const template = {
    version: "1.0.0",
    content: `# {{name}}

{{description}}

## Overview

## Projects

## Tasks

## Notes

`,
    variables: {},
    metadata: {
      description: "Default template for Area notes",
      author: "TaskSync",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  // Create the complete NoteType
  const noteType: NoteType = {
    id: "area",
    name: "Area",
    version: "1.0.0",
    properties,
    template,
    metadata: {
      description: "Area note type for TaskSync",
      author: "TaskSync",
      icon: "folder-tree",
      color: "#8b5cf6",
      category: "TaskSync",
      tags: ["area", "organization"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return noteType;
}

