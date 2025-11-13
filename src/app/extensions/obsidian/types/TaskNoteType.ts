/**
 * Task Note Type Definition for NoteKit Integration
 * Defines the Task note type with all required properties and validation
 */

import type {
  NoteType,
  PropertyDefinition,
} from "../../../core/note-kit/types";
import {
  stringSchema,
  optionalStringSchema,
  booleanSchema,
  optionalBooleanSchema,
  dateSchema,
  optionalDateSchema,
  stringArraySchema,
  enumSchema,
  withDefault,
} from "../../../core/note-kit/schemas";

/**
 * Default task categories with colors
 * The option marked with isDefault: true will be used as the default value.
 * Only one option should have isDefault set to true.
 */
const DEFAULT_CATEGORIES = [
  { value: "Task", color: "#3b82f6", isDefault: true },
  { value: "Bug", color: "#ef4444", isDefault: false },
  { value: "Feature", color: "#10b981", isDefault: false },
  { value: "Improvement", color: "#8b5cf6", isDefault: false },
  { value: "Chore", color: "#6b7280", isDefault: false },
];

/**
 * Default task priorities with colors
 * The option marked with isDefault: true will be used as the default value.
 * Only one option should have isDefault set to true.
 */
const DEFAULT_PRIORITIES = [
  { value: "Low", color: "#6b7280", isDefault: false },
  { value: "Medium", color: "#f59e0b", isDefault: true },
  { value: "High", color: "#ef4444", isDefault: false },
  { value: "Urgent", color: "#dc2626", isDefault: false },
];

/**
 * Default task statuses with colors and state metadata
 * The option marked with isDefault: true will be used as the default value.
 * Only one option should have isDefault set to true.
 */
const DEFAULT_STATUSES = [
  { value: "Backlog", color: "#6b7280", isDefault: true, isDone: false, isInProgress: false },
  { value: "Ready", color: "#3b82f6", isDefault: false, isDone: false, isInProgress: false },
  { value: "In Progress", color: "#f59e0b", isDefault: false, isDone: false, isInProgress: true },
  { value: "Review", color: "#8b5cf6", isDefault: false, isDone: false, isInProgress: false },
  { value: "Done", color: "#10b981", isDefault: false, isDone: true, isInProgress: false },
  { value: "Cancelled", color: "#ef4444", isDefault: false, isDone: false, isInProgress: false },
];

/**
 * Validate that select options have all required fields
 * Throws an error if validation fails
 */
function validateSelectOptions(
  options: any[],
  propertyName: string,
  requiredFields: string[]
): void {
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    for (const field of requiredFields) {
      if (option[field] === undefined) {
        throw new Error(
          `${propertyName} option at index ${i} (value: "${option.value}") is missing required field: ${field}`
        );
      }
    }
  }

  // Ensure exactly one option has isDefault: true
  const defaultCount = options.filter(opt => opt.isDefault === true).length;
  if (defaultCount === 0) {
    throw new Error(`${propertyName} must have exactly one option with isDefault: true, but found none`);
  }
  if (defaultCount > 1) {
    throw new Error(`${propertyName} must have exactly one option with isDefault: true, but found ${defaultCount}`);
  }
}

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

  // Validate all select options have required fields
  validateSelectOptions(categoryOptions, "Category", ["value", "color", "isDefault"]);
  validateSelectOptions(priorityOptions, "Priority", ["value", "color", "isDefault"]);
  validateSelectOptions(statusOptions, "Status", ["value", "color", "isDefault", "isDone", "isInProgress"]);

  // Extract values for enum schemas
  const categoryValues = categoryOptions.map((opt) => opt.value);
  const priorityValues = priorityOptions.map((opt) => opt.value);
  const statusValues = statusOptions.map((opt) => opt.value);

  // Find default values from options marked as default
  // These are GUARANTEED to exist due to validation above - non-null assertion is safe here
  const defaultCategory = categoryOptions.find((opt) => opt.isDefault)!.value;
  const defaultPriority = priorityOptions.find((opt) => opt.isDefault)!.value;
  const defaultStatus = statusOptions.find((opt) => opt.isDefault)!.value;

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
      defaultValue: defaultCategory,
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
      defaultValue: defaultPriority,
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
      defaultValue: defaultStatus,
      selectOptions: statusOptions,
      description: "Task status",
      visible: true,
      order: 4,
    },
    done: {
      key: "done",
      name: "Done",
      type: "boolean",
      schema: withDefault(optionalBooleanSchema, false),
      frontMatterKey: "Done",
      required: false,
      defaultValue: false,
      description: "Whether the task is completed",
      visible: true,
      order: 5,
      form: {
        hidden: true, // Hidden from forms, auto-managed by status
      },
    },
    project: {
      key: "project",
      name: "Project",
      type: "association",
      schema: optionalStringSchema,
      frontMatterKey: "Project",
      required: false,
      description: "Associated project",
      visible: true,
      order: 6,
      association: {
        noteTypeId: "project",
        multiple: false,
        allowCreate: true,
      },
    },
    areas: {
      key: "areas",
      name: "Areas",
      type: "association",
      schema: stringArraySchema,
      frontMatterKey: "Areas",
      required: false,
      defaultValue: [],
      description: "Associated areas (wiki link format)",
      visible: true,
      order: 7,
      association: {
        noteTypeId: "area",
        multiple: true,
        allowCreate: true,
      },
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
