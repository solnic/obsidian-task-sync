/**
 * Task Note Type Definition for TypeNote Integration
 * Defines the Task note type with all required properties and validation
 */

import type { NoteType, PropertyDefinition } from "../../core/type-note/types";
import {
  stringSchema,
  optionalStringSchema,
  booleanSchema,
  dateSchema,
  optionalDateSchema,
  stringArraySchema,
  enumSchema,
} from "../../core/type-note/schemas";

/**
 * Default task categories with colors
 */
const DEFAULT_CATEGORIES = [
  { value: "Task", color: "#3b82f6" },
  { value: "Bug", color: "#ef4444" },
  { value: "Feature", color: "#10b981" },
  { value: "Improvement", color: "#8b5cf6" },
  { value: "Chore", color: "#6b7280" },
];

/**
 * Default task priorities with colors
 */
const DEFAULT_PRIORITIES = [
  { value: "Low", color: "#6b7280" },
  { value: "Medium", color: "#f59e0b" },
  { value: "High", color: "#ef4444" },
  { value: "Urgent", color: "#dc2626" },
];

/**
 * Default task statuses with colors
 */
const DEFAULT_STATUSES = [
  { value: "Backlog", color: "#6b7280" },
  { value: "Ready", color: "#3b82f6" },
  { value: "In Progress", color: "#f59e0b" },
  { value: "Review", color: "#8b5cf6" },
  { value: "Done", color: "#10b981" },
  { value: "Cancelled", color: "#ef4444" },
];

/**
 * Build Task note type
 * This creates a complete NoteType definition with sensible defaults
 * No longer dependent on settings - all configuration is in the note type itself
 */
export function buildTaskNoteType(): NoteType {
  // Use default options
  const categoryOptions = DEFAULT_CATEGORIES;
  const priorityOptions = DEFAULT_PRIORITIES;
  const statusOptions = DEFAULT_STATUSES;

  // Extract values for enum schemas
  const categoryValues = categoryOptions.map((opt) => opt.value);
  const priorityValues = priorityOptions.map((opt) => opt.value);
  const statusValues = statusOptions.map((opt) => opt.value);

  // Define properties for Task note type
  const properties: Record<string, PropertyDefinition> = {
    type: {
      key: "type",
      name: "Type",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "Type",
      required: true,
      defaultValue: "Task",
      description: "Entity type (always 'Task')",
      visible: true,
      order: 1,
      form: {
        hidden: true, // Hidden from form, auto-set
      },
    },
    title: {
      key: "title",
      name: "Title",
      type: "string",
      schema: stringSchema,
      frontMatterKey: "Title",
      required: true,
      description: "Task title",
      visible: true,
      order: 1,
      form: {
        main: true,
        label: false, // No label for main field
      },
    },
    category: {
      key: "category",
      name: "Category",
      type: "select",
      schema:
        categoryValues.length > 0
          ? enumSchema(categoryValues as [string, ...string[]])
          : stringSchema,
      frontMatterKey: "Category",
      required: true,
      defaultValue: categoryValues.length > 0 ? categoryValues[0] : "Task",
      selectOptions: categoryOptions,
      description: "Task category/type",
      visible: true,
      order: 2,
    },
    priority: {
      key: "priority",
      name: "Priority",
      type: "select",
      schema:
        priorityValues.length > 0
          ? enumSchema(priorityValues as [string, ...string[]])
          : optionalStringSchema,
      frontMatterKey: "Priority",
      required: true,
      defaultValue: priorityValues.length > 0 ? priorityValues[0] : "Medium",
      selectOptions: priorityOptions,
      description: "Task priority level",
      visible: true,
      order: 3,
    },
    status: {
      key: "status",
      name: "Status",
      type: "select",
      schema:
        statusValues.length > 0
          ? enumSchema(statusValues as [string, ...string[]])
          : stringSchema,
      frontMatterKey: "Status",
      required: true,
      defaultValue: statusValues.length > 0 ? statusValues[0] : "Backlog",
      selectOptions: statusOptions,
      description: "Task status",
      visible: true,
      order: 4,
    },
    done: {
      key: "done",
      name: "Done",
      type: "boolean",
      schema: booleanSchema,
      frontMatterKey: "Done",
      required: true,
      defaultValue: false,
      description: "Whether the task is completed",
      visible: true,
      order: 5,
    },
    project: {
      key: "project",
      name: "Project",
      type: "string",
      schema: optionalStringSchema,
      frontMatterKey: "Project",
      required: false,
      description: "Associated project (wiki link format)",
      visible: true,
      order: 6,
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
      order: 7,
    },
    parentTask: {
      key: "parentTask",
      name: "Parent task",
      type: "string",
      schema: optionalStringSchema,
      frontMatterKey: "Parent task",
      required: false,
      description: "Parent task (wiki link format)",
      visible: true,
      order: 8,
      form: {
        hidden: true, // Hide from primary form section
      },
    },
    doDate: {
      key: "doDate",
      name: "Do Date",
      type: "date",
      schema: optionalDateSchema,
      frontMatterKey: "Do Date",
      required: false,
      description: "Date when task should be done",
      visible: true,
      order: 9,
      form: {
        hidden: true, // Hide from primary form section
      },
    },
    dueDate: {
      key: "dueDate",
      name: "Due Date",
      type: "date",
      schema: optionalDateSchema,
      frontMatterKey: "Due Date",
      required: false,
      description: "Deadline for task completion",
      visible: true,
      order: 10,
      form: {
        hidden: true, // Hide from primary form section
      },
    },
    tags: {
      key: "tags",
      name: "tags",
      type: "array",
      schema: stringArraySchema,
      frontMatterKey: "tags",
      required: false,
      defaultValue: [],
      description: "Task tags",
      visible: true,
      order: 11,
      form: {
        hidden: true, // Hide from primary form section
      },
    },
  };

  // Create template for Task notes
  const template = {
    version: "1.0.0",
    content: `## Notes

`,
    variables: {},
    metadata: {
      description: "Default template for Task notes",
      author: "TaskSync",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  // Create the complete NoteType
  const noteType: NoteType = {
    id: "task",
    name: "Task",
    version: "1.0.0",
    properties,
    template,
    metadata: {
      description: "Task note type for TaskSync",
      author: "TaskSync",
      icon: "check-square",
      color: "#3b82f6",
      category: "TaskSync",
      tags: ["task", "productivity"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return noteType;
}
