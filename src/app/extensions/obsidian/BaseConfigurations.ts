/**
 * Obsidian Base Configurations
 * Generates Obsidian Bases YAML configurations using the property registry
 * This is Obsidian-specific because it generates .base files for Obsidian Bases plugin
 */

import * as yaml from "js-yaml";
import { TaskSyncSettings } from "../../types/settings";
import { PROPERTY_REGISTRY } from "./PropertyRegistry";
import {
  FilterCondition,
  PropertyFilter,
  FileSystemFilter,
  CustomFilter,
  CompositeFilter,
  FilterBuilder,
} from "../../types/filters";

// ============================================================================
// PROPERTY SETS - Define which properties are used in each base type
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
// VIEW ORDERS - Define column orders for different base types
// ============================================================================

export const VIEW_ORDERS = {
  TASKS_MAIN: [
    "formula.Title",
    PROPERTY_REGISTRY.CATEGORY.name,
    PROPERTY_REGISTRY.PRIORITY.name,
    PROPERTY_REGISTRY.AREAS.name,
    PROPERTY_REGISTRY.PROJECT.name,
    PROPERTY_REGISTRY.DONE.name,
    PROPERTY_REGISTRY.STATUS.name,
    PROPERTY_REGISTRY.DO_DATE.name,
    PROPERTY_REGISTRY.DUE_DATE.name,
    PROPERTY_REGISTRY.TAGS.name,
    PROPERTY_REGISTRY.CREATED_AT.name,
    PROPERTY_REGISTRY.UPDATED_AT.name,
  ],
  TASKS_TYPE: [
    "formula.Title",
    PROPERTY_REGISTRY.PROJECT.name,
    PROPERTY_REGISTRY.DONE.name,
    PROPERTY_REGISTRY.CREATED_AT.name,
    PROPERTY_REGISTRY.UPDATED_AT.name,
  ],
  AREA_MAIN: [
    "formula.Title",
    PROPERTY_REGISTRY.PRIORITY.name,
    PROPERTY_REGISTRY.PROJECTS.name,
    PROPERTY_REGISTRY.DONE.name,
    PROPERTY_REGISTRY.STATUS.name,
    PROPERTY_REGISTRY.TAGS.name,
    PROPERTY_REGISTRY.CREATED_AT.name,
    PROPERTY_REGISTRY.UPDATED_AT.name,
  ],
  PROJECT_MAIN: [
    "formula.Title",
    PROPERTY_REGISTRY.PRIORITY.name,
    PROPERTY_REGISTRY.AREAS.name,
    PROPERTY_REGISTRY.DONE.name,
    PROPERTY_REGISTRY.STATUS.name,
    PROPERTY_REGISTRY.TAGS.name,
    PROPERTY_REGISTRY.CREATED_AT.name,
    PROPERTY_REGISTRY.UPDATED_AT.name,
  ],
} as const;

// ============================================================================
// SORT CONFIGURATIONS
// ============================================================================

export const SORT_CONFIGS = {
  TASK: [
    { property: PROPERTY_REGISTRY.PRIORITY.name, direction: "asc" },
    { property: PROPERTY_REGISTRY.DO_DATE.name, direction: "asc" },
    { property: PROPERTY_REGISTRY.CREATED_AT.name, direction: "desc" },
  ],
  AREA: [
    { property: PROPERTY_REGISTRY.PRIORITY.name, direction: "asc" },
    { property: PROPERTY_REGISTRY.CREATED_AT.name, direction: "desc" },
  ],
  PROJECT: [
    { property: PROPERTY_REGISTRY.PRIORITY.name, direction: "asc" },
    { property: PROPERTY_REGISTRY.CREATED_AT.name, direction: "desc" },
  ],
} as const;

// ============================================================================
// FILTER PRESETS
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
// HELPER INTERFACES
// ============================================================================

export interface ProjectAreaInfo {
  name: string;
  path: string;
  type: "project" | "area";
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Resolve view order by replacing property names with their display names
 */
function resolveViewOrder(order: readonly string[]): string[] {
  return order.map((item) => {
    // If it's already a formula or file property, return as-is
    if (item.startsWith("formula.") || item.startsWith("file.")) {
      return item;
    }
    // Otherwise, it should be a property name from the registry
    return item;
  });
}

/**
 * Resolve sort configuration by ensuring property names are correct
 */
function resolveSortConfig(
  config: readonly { property: string; direction: string }[]
): { property: string; direction: string }[] {
  return config.map((sort) => ({
    property: sort.property,
    direction: sort.direction,
  }));
}

/**
 * Generate properties section for base YAML using property registry
 */
function generatePropertiesSection(
  propertyKeys: readonly string[]
): Record<string, any> {
  const properties: Record<string, any> = {};

  // Add numbered properties using the registry
  propertyKeys.forEach((key, index) => {
    const prop = PROPERTY_REGISTRY[key as keyof typeof PROPERTY_REGISTRY];
    if (!prop) return;

    properties[index.toString()] = {
      name: prop.name, // Use the name from the registry
      type: prop.type,
      ...(prop.source && { source: prop.source }),
      ...(prop.link && { link: prop.link }),
      ...(prop.default !== undefined && { default: prop.default }),
    };
  });

  // Add metadata properties with displayName
  if (propertyKeys.includes("CREATED_AT")) {
    properties["file.ctime"] = {
      displayName: PROPERTY_REGISTRY.CREATED_AT.name,
    };
  }
  if (propertyKeys.includes("UPDATED_AT")) {
    properties["file.mtime"] = {
      displayName: PROPERTY_REGISTRY.UPDATED_AT.name,
    };
  }

  return properties;
}

/**
 * Simple pluralization helper
 */
function pluralize(word: string): string {
  if (word.endsWith("y")) {
    return word.slice(0, -1) + "ies";
  }
  if (word.endsWith("s") || word.endsWith("sh") || word.endsWith("ch")) {
    return word + "es";
  }
  return word + "s";
}

// ============================================================================
// BASE GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate Tasks base configuration
 */
export function generateTasksBase(
  settings: TaskSyncSettings,
  projectsAndAreas: ProjectAreaInfo[]
): string {
  // Build dynamic filters based on available projects and areas
  const baseFilters: FilterCondition[] = [
    FilterBuilder.inFolder(settings.tasksFolder),
    FilterBuilder.noParentTask(),
  ];

  // Add area/project filters if we have any
  if (projectsAndAreas.length > 0) {
    const areas = projectsAndAreas.filter((p) => p.type === "area");
    const projects = projectsAndAreas.filter((p) => p.type === "project");

    if (areas.length > 0 && projects.length > 0) {
      // If we have both areas and projects, create an OR filter
      baseFilters.push(
        FilterBuilder.or(
          ...areas.map((area) => FilterBuilder.inArea(area.name)),
          ...projects.map((project) => FilterBuilder.inProject(project.name))
        )
      );
    } else if (areas.length > 0) {
      // Only areas available
      if (areas.length === 1) {
        baseFilters.push(FilterBuilder.inArea(areas[0].name));
      } else {
        baseFilters.push(
          FilterBuilder.or(
            ...areas.map((area) => FilterBuilder.inArea(area.name))
          )
        );
      }
    } else if (projects.length > 0) {
      // Only projects available
      if (projects.length === 1) {
        baseFilters.push(FilterBuilder.inProject(projects[0].name));
      } else {
        baseFilters.push(
          FilterBuilder.or(
            ...projects.map((project) => FilterBuilder.inProject(project.name))
          )
        );
      }
    }
  }

  const config = {
    formulas: {
      Title: "link(file.name, Title)",
    },
    properties: generatePropertiesSection(PROPERTY_SETS.TASKS_BASE),
    views: [
      // Main Tasks view
      {
        type: "table",
        name: "Tasks",
        filters: FilterBuilder.and(...baseFilters).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.TASKS_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.TASK),
        columnSize: {
          "formula.Title": 382,
          [PROPERTY_REGISTRY.TAGS.name]: 134,
          [PROPERTY_REGISTRY.UPDATED_AT.name]: 165,
          [PROPERTY_REGISTRY.CREATED_AT.name]: 183,
        },
      },
      // All task types views
      ...settings.taskTypes.map((taskType) => ({
        type: "table" as const,
        name: `All ${pluralize(taskType.name)}`,
        filters: FilterBuilder.and(
          FilterBuilder.inFolder(settings.tasksFolder),
          FilterBuilder.notDone(),
          FilterBuilder.ofCategory(taskType.name),
          FilterBuilder.noParentTask()
        ).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.TASKS_TYPE),
        sort: resolveSortConfig(SORT_CONFIGS.TASK),
      })),
      // Priority-based views for each type
      ...settings.taskTypes.flatMap((taskType) =>
        settings.taskPriorities.map((priority) => ({
          type: "table" as const,
          name: `${pluralize(taskType.name)} • ${priority.name} priority`,
          filters: FilterBuilder.and(
            FilterBuilder.inFolder(settings.tasksFolder),
            FilterBuilder.notDone(),
            FilterBuilder.ofCategory(taskType.name),
            FilterBuilder.withPriority(priority.name),
            FilterBuilder.noParentTask()
          ).toFilterObject(),
          order: resolveViewOrder(VIEW_ORDERS.TASKS_TYPE),
          sort: resolveSortConfig(SORT_CONFIGS.TASK),
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

/**
 * Generate Area base configuration
 */
export function generateAreaBase(
  settings: TaskSyncSettings,
  area: ProjectAreaInfo
): string {
  const config = {
    formulas: {
      Title: "link(file.name, Title)",
    },
    properties: generatePropertiesSection(PROPERTY_SETS.AREA_BASE),
    views: [
      // Main Tasks view
      {
        type: "table",
        name: "Tasks",
        filters: FILTER_PRESETS.AREA_TASKS(
          settings,
          area.name
        ).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.AREA_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.AREA),
        columnSize: {
          "formula.Title": 382,
          [PROPERTY_REGISTRY.TAGS.name]: 134,
          [PROPERTY_REGISTRY.UPDATED_AT.name]: 165,
          [PROPERTY_REGISTRY.CREATED_AT.name]: 183,
        },
      },
      // All task types views
      ...settings.taskTypes.map((taskType) => ({
        type: "table" as const,
        name: `All ${pluralize(taskType.name)}`,
        filters: FilterBuilder.and(
          FilterBuilder.inFolder(settings.tasksFolder),
          FilterBuilder.notDone(),
          FilterBuilder.inArea(area.name),
          FilterBuilder.ofCategory(taskType.name),
          FilterBuilder.noParentTask()
        ).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.AREA_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.AREA),
      })),
      // Priority-based views for each type
      ...settings.taskTypes.flatMap((taskType) =>
        settings.taskPriorities.map((priority) => ({
          type: "table" as const,
          name: `${pluralize(taskType.name)} • ${priority.name} priority`,
          filters: FilterBuilder.and(
            FilterBuilder.inFolder(settings.tasksFolder),
            FilterBuilder.notDone(),
            FilterBuilder.inArea(area.name),
            FilterBuilder.ofCategory(taskType.name),
            FilterBuilder.withPriority(priority.name),
            FilterBuilder.noParentTask()
          ).toFilterObject(),
          order: resolveViewOrder(VIEW_ORDERS.AREA_MAIN),
          sort: resolveSortConfig(SORT_CONFIGS.AREA),
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
        type: "table" as const,
        name: "Tasks",
        filters: FILTER_PRESETS.PROJECT_TASKS(
          settings,
          project.name
        ).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.PROJECT_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.PROJECT),
        columnSize: {
          "formula.Title": 382,
          [PROPERTY_REGISTRY.TAGS.name]: 134,
          [PROPERTY_REGISTRY.UPDATED_AT.name]: 165,
          [PROPERTY_REGISTRY.CREATED_AT.name]: 183,
        },
      },
      // All task types views
      ...settings.taskTypes.map((taskType) => ({
        type: "table" as const,
        name: `All ${pluralize(taskType.name)}`,
        filters: FilterBuilder.and(
          FilterBuilder.inFolder(settings.tasksFolder),
          FilterBuilder.notDone(),
          FilterBuilder.inProject(project.name),
          FilterBuilder.ofCategory(taskType.name),
          FilterBuilder.noParentTask()
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
            FilterBuilder.notDone(),
            FilterBuilder.inProject(project.name),
            FilterBuilder.ofCategory(taskType.name),
            FilterBuilder.withPriority(priority.name),
            FilterBuilder.noParentTask()
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
