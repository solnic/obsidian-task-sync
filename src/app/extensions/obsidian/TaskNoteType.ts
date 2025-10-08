/**
 * Task Note Type Definition for TypeNote Integration
 * Defines the Task note type with all required properties and validation
 */

import type {
  NoteType,
  PropertyDefinition,
  SelectOption,
} from "../../core/type-note/types";
import {
  stringSchema,
  optionalStringSchema,
  booleanSchema,
  dateSchema,
  optionalDateSchema,
  stringArraySchema,
  enumSchema,
} from "../../core/type-note/schemas";
import type {
  TaskSyncSettings,
  TaskType,
  TaskPriority,
  TaskStatus,
} from "../../types/settings";

/**
 * Create select options from task types
 */
function createTaskTypeOptions(taskTypes: TaskType[]): SelectOption[] {
  return taskTypes.map((type) => ({
    value: type.name,
    label: type.name,
    color: type.color,
  }));
}

/**
 * Create select options from task priorities
 */
function createTaskPriorityOptions(
  taskPriorities: TaskPriority[]
): SelectOption[] {
  return taskPriorities.map((priority) => ({
    value: priority.name,
    label: priority.name,
    color: priority.color,
  }));
}

/**
 * Create select options from task statuses
 */
function createTaskStatusOptions(taskStatuses: TaskStatus[]): SelectOption[] {
  return taskStatuses.map((status) => ({
    value: status.name,
    label: status.name,
    color: status.color,
  }));
}

/**
 * Build Task note type from settings
 * This creates a complete NoteType definition based on current TaskSync settings
 */
export function buildTaskNoteType(settings: TaskSyncSettings): NoteType {
  // Create select options from settings
  const categoryOptions = createTaskTypeOptions(settings.taskTypes);
  const priorityOptions = createTaskPriorityOptions(settings.taskPriorities);
  const statusOptions = createTaskStatusOptions(settings.taskStatuses);

  // Extract values for enum schemas
  const categoryValues = categoryOptions.map((opt) => opt.value);
  const priorityValues = priorityOptions.map((opt) => opt.value);
  const statusValues = statusOptions.map((opt) => opt.value);

  // Define properties for Task note type
  const properties: Record<string, PropertyDefinition> = {
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
          : optionalStringSchema,
      frontMatterKey: "Category",
      required: false,
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
      required: false,
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
    content: `# {{title}}

{{#if description}}
## Description

{{description}}
{{/if}}

## Details

- **Status**: {{status}}
- **Category**: {{category}}
- **Priority**: {{priority}}
{{#if project}}
- **Project**: [[{{project}}]]
{{/if}}
{{#if areas}}
- **Areas**: {{#each areas}}[[{{this}}]]{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{#if doDate}}
- **Do Date**: {{doDate}}
{{/if}}
{{#if dueDate}}
- **Due Date**: {{dueDate}}
{{/if}}

## Notes

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
