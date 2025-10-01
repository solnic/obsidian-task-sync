/**
 * Base Configurations
 * Simplified declarative base generation system using entity-based configurations
 * Ported from old-stuff to new architecture, focusing on Project entity type
 */

import * as yaml from "js-yaml";
import { pluralize } from "inflection";

import { TaskSyncSettings } from "../types/settings";
import { PROPERTY_REGISTRY, PropertyDefinition } from "../types/properties";
import { FilterCondition, FilterBuilder } from "../types/filters";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ProjectAreaInfo {
  name: string;
  path: string;
  type: "project" | "area";
}

// ============================================================================
// PREDEFINED FILTER SETS
// ============================================================================

/**
 * Common filter combinations that can be reused across different base types
 */
export const FILTER_PRESETS = {
  /**
   * Base filter for all task-related views
   */
  TASKS_BASE: (settings: TaskSyncSettings) =>
    FilterBuilder.and(
      FilterBuilder.inFolder(settings.tasksFolder),
      FilterBuilder.notDone()
    ),

  /**
   * Filter for top-level tasks (no parent)
   */
  TOP_LEVEL_TASKS: (settings: TaskSyncSettings) =>
    FilterBuilder.and(
      FilterBuilder.inFolder(settings.tasksFolder),
      FilterBuilder.notDone(),
      FilterBuilder.noParentTask()
    ),

  /**
   * Filter for tasks in a specific project
   */
  PROJECT_TASKS: (settings: TaskSyncSettings, projectName: string) =>
    FilterBuilder.and(
      FilterBuilder.inFolder(settings.tasksFolder),
      FilterBuilder.notDone(),
      FilterBuilder.inProject(projectName),
      FilterBuilder.noParentTask()
    ),

  /**
   * Filter for tasks in a specific area
   */
  AREA_TASKS: (settings: TaskSyncSettings, areaName: string) =>
    FilterBuilder.and(
      FilterBuilder.inFolder(settings.tasksFolder),
      FilterBuilder.notDone(),
      FilterBuilder.inArea(areaName),
      FilterBuilder.noParentTask()
    ),

  /**
   * Filter for child tasks of a parent
   */
  CHILD_TASKS: (settings: TaskSyncSettings, parentTaskName: string) =>
    FilterBuilder.and(
      FilterBuilder.inFolder(settings.tasksFolder),
      FilterBuilder.childrenOf(parentTaskName)
    ),

  /**
   * Filter for all tasks related to a parent (parent + children)
   */
  RELATED_TASKS: (_settings: TaskSyncSettings, parentTaskName: string) =>
    FilterBuilder.or(
      FilterBuilder.fileName(parentTaskName),
      FilterBuilder.childrenOf(parentTaskName)
    ),
} as const;

// ============================================================================
// ENTITY-BASED PROPERTY SETS (using entity configurations)
// ============================================================================

export const PROPERTY_SETS = {
  TASK_FRONTMATTER: [
    "TITLE",
    "TYPE",
    "CATEGORY",
    "PRIORITY",
    "AREAS",
    "PROJECT",
    "DONE",
    "STATUS",
    "PARENT_TASK",
    "DO_DATE",
    "DUE_DATE",
    "TAGS",
    "REMINDERS",
  ] as const,
  TASKS_BASE: [
    "TITLE",
    "TYPE",
    "CATEGORY",
    "PRIORITY",
    "AREAS",
    "PROJECT",
    "DONE",
    "STATUS",
    "PARENT_TASK",
    "DO_DATE",
    "DUE_DATE",
    "TAGS",
    "REMINDERS",
    "CREATED_AT",
    "UPDATED_AT",
  ] as const,
  AREA_BASE: [
    "TITLE",
    "TYPE",
    "PRIORITY",
    "PROJECTS",
    "DONE",
    "STATUS",
    "PARENT_TASK",
    "TAGS",
    "CREATED_AT",
    "UPDATED_AT",
  ] as const,
  PROJECT_BASE: [
    "TITLE",
    "TYPE",
    "PRIORITY",
    "AREAS",
    "DONE",
    "STATUS",
    "PARENT_TASK",
    "TAGS",
    "CREATED_AT",
    "UPDATED_AT",
  ] as const,
} as const;

// ============================================================================
// VIEW ORDERING CONFIGURATIONS
// ============================================================================

export const VIEW_ORDERS = {
  TASKS_MAIN: [
    "formula.Title",
    "TYPE",
    "CATEGORY",
    "PRIORITY",
    "AREAS",
    "PROJECT",
    "DONE",
    "STATUS",
    "DO_DATE",
    "DUE_DATE",
    "note.tags",
    "file.mtime",
    "file.ctime",
  ],
  PROJECT_MAIN: [
    "formula.Title",
    "TYPE",
    "CATEGORY",
    "PRIORITY",
    "AREAS",
    "DONE",
    "STATUS",
    "DO_DATE",
    "DUE_DATE",
    "note.tags",
    "file.mtime",
    "file.ctime",
  ],
  AREA_MAIN: [
    "formula.Title",
    "TYPE",
    "CATEGORY",
    "PRIORITY",
    "PROJECTS",
    "DONE",
    "STATUS",
    "DO_DATE",
    "DUE_DATE",
    "note.tags",
    "file.mtime",
    "file.ctime",
  ],
} as const;

// ============================================================================
// SORT CONFIGURATIONS
// ============================================================================

export const SORT_CONFIGS = {
  TASK: [
    { property: "DONE", direction: "ASC" as const },
    { property: "PROJECT", direction: "ASC" as const },
    { property: "CATEGORY", direction: "ASC" as const },
    { property: "UPDATED_AT", direction: "DESC" as const },
    { property: "CREATED_AT", direction: "DESC" as const },
    { property: "TITLE", direction: "ASC" as const },
  ],
  AREA: [
    { property: "DONE", direction: "ASC" as const },
    { property: "CATEGORY", direction: "ASC" as const },
    { property: "UPDATED_AT", direction: "DESC" as const },
    { property: "CREATED_AT", direction: "DESC" as const },
    { property: "TITLE", direction: "ASC" as const },
  ],
  PROJECT: [
    { property: "DONE", direction: "ASC" as const },
    { property: "CATEGORY", direction: "ASC" as const },
    { property: "UPDATED_AT", direction: "DESC" as const },
    { property: "CREATED_AT", direction: "DESC" as const },
    { property: "TITLE", direction: "ASC" as const },
  ],
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve view order configuration
 */
function resolveViewOrder(orderConfig: readonly string[]): string[] {
  return [...orderConfig];
}

/**
 * Resolve sort configuration
 */
function resolveSortConfig(
  sortConfig: readonly { property: string; direction: "ASC" | "DESC" }[]
): Array<{ property: string; direction: "ASC" | "DESC" }> {
  return [...sortConfig];
}

/**
 * Generate properties section for base YAML
 */
function generatePropertiesSection(
  propertyKeys: readonly string[]
): Record<string, any> {
  const properties: Record<string, any> = {};

  // Add numbered properties
  propertyKeys.forEach((key, index) => {
    const prop = PROPERTY_REGISTRY[key as keyof typeof PROPERTY_REGISTRY];
    if (!prop) return;

    properties[index.toString()] = {
      name: prop.name,
      type: prop.type,
      ...(prop.source && { source: prop.source }),
      ...(prop.link && { link: prop.link }),
      ...(prop.default !== undefined && { default: prop.default }),
    };
  });

  // Add metadata properties with displayName
  if (propertyKeys.includes("CREATED_AT")) {
    properties["file.ctime"] = { displayName: "Created At" };
  }
  if (propertyKeys.includes("UPDATED_AT")) {
    properties["file.mtime"] = { displayName: "Updated At" };
  }

  return properties;
}

// ============================================================================
// BASE GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate Project base configuration
 */
export function generateProjectBase(
  settings: TaskSyncSettings,
  project: ProjectAreaInfo
): string {
  const config = {
    formulas: {
      Title: "link(file.name, Title)",
    },
    properties: generatePropertiesSection(PROPERTY_SETS.PROJECT_BASE),
    views: [
      // Main Tasks view
      {
        type: "table",
        name: "Tasks",
        filters: FILTER_PRESETS.PROJECT_TASKS(
          settings,
          project.name
        ).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.PROJECT_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.PROJECT),
        columnSize: {
          "formula.Title": 382,
          "note.tags": 134,
          "file.mtime": 165,
          "file.ctime": 183,
        },
      },
      // Type-based views for each task type
      ...settings.taskTypes.map((taskType) => ({
        type: "table" as const,
        name: pluralize(taskType.name),
        filters: FilterBuilder.and(
          FilterBuilder.inFolder(settings.tasksFolder),
          FilterBuilder.inProject(project.name),
          FilterBuilder.ofCategory(taskType.name)
        ).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.PROJECT_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.PROJECT),
      })),
      // Priority-based views for each type
      ...settings.taskTypes.flatMap((taskType) =>
        settings.taskPriorities.map((priority) => ({
          type: "table" as const,
          name: `${pluralize(taskType.name)} • ${priority.name} priority`,
          filters: FilterBuilder.and(
            FilterBuilder.inFolder(settings.tasksFolder),
            FilterBuilder.inProject(project.name),
            FilterBuilder.ofCategory(taskType.name),
            FilterBuilder.withPriority(priority.name)
          ).toFilterObject(),
          order: resolveViewOrder(VIEW_ORDERS.PROJECT_MAIN),
          sort: resolveSortConfig(SORT_CONFIGS.PROJECT),
        }))
      ),
    ],
  };

  return yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}
