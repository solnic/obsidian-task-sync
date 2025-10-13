/**
 * Project Note Type Definition for TypeNote Integration
 * Defines the Project note type with all required properties and validation
 */

import type { NoteType, PropertyDefinition } from "../../../core/type-note/types";
import {
  stringSchema,
  optionalStringSchema,
  stringArraySchema,
} from "../../../core/type-note/schemas";

/**
 * Create the Project note type definition
 */
export function createProjectNoteType(): NoteType {
  // Define properties for Project note type
  const properties: Record<string, PropertyDefinition> = {
    name: {
      key: "name",
      name: "Name",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "Name",
      required: true,
      description: "Project name",
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
      defaultValue: "Project",
      description: "Entity type (always 'Project')",
      order: 2,
      form: {
        hidden: true, // Hide from primary form section
      },
    },
    areas: {
      key: "areas",
      name: "Areas",
      type: "array",
      schema: stringArraySchema,
      frontMatterKey: "Areas",
      required: false,
      defaultValue: [],
      description: "Associated areas (wiki link format)",
      visible: true,
      order: 3,
    },
    tags: {
      key: "tags",
      name: "tags",
      type: "array",
      schema: stringArraySchema,
      frontMatterKey: "tags",
      required: false,
      defaultValue: [],
      description: "Project tags",
      visible: true,
      order: 4,
      form: {
        hidden: true, // Hide from primary form section
      },
    },
  };

  // Create template for Project notes
  const template = {
    version: "1.0.0",
    content: `# {{name}}

{{description}}

## Overview

## Tasks

## Notes

`,
    variables: {},
    metadata: {
      description: "Default template for Project notes",
      author: "TaskSync",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  // Create the complete NoteType
  const noteType: NoteType = {
    id: "project",
    name: "Project",
    version: "1.0.0",
    properties,
    template,
    metadata: {
      description: "Project note type for TaskSync",
      author: "TaskSync",
      icon: "folder",
      color: "#10b981",
      category: "TaskSync",
      tags: ["project", "organization"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return noteType;
}
