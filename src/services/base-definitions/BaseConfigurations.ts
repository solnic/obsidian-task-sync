/**
 * Base Configurations
 * Simplified declarative base generation system using entity-based configurations
 */

import * as yaml from "js-yaml";
import pluralize from "pluralize";

import { TaskSyncSettings } from "../../main";
import { PROPERTY_REGISTRY, PropertyDefinition } from "../../types/properties";
import { FilterCondition, FilterBuilder } from "../../types/filters";

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
// VIEW ORDERS (using entity configurations)
// ============================================================================

export const VIEW_ORDERS = {
  TASKS_MAIN: [
    "DONE",
    "TITLE",
    "PROJECT",
    "CATEGORY",
    "CREATED_AT",
    "UPDATED_AT",
  ] as const,
  TASKS_TYPE: ["DONE", "TITLE", "PROJECT", "CREATED_AT", "UPDATED_AT"] as const,
  AREA_MAIN: [
    "DONE",
    "TITLE",
    "PROJECTS",
    "CATEGORY",
    "CREATED_AT",
    "UPDATED_AT",
  ] as const,
  PROJECT_MAIN: [
    "DONE",
    "TITLE",
    "AREAS",
    "CATEGORY",
    "CREATED_AT",
    "UPDATED_AT",
  ] as const,
} as const;

// ============================================================================
// SIMPLE SORT CONFIGURATIONS
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
    { property: "AREAS", direction: "ASC" as const },
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
 * Resolve property key to its source value for use in views
 */
function resolvePropertySource(propertyKey: string): string {
  const prop = PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
  if (!prop) return propertyKey;

  // For properties with source, use the source value
  if (prop.source) return prop.source;

  // For properties without source, use the property name directly
  return prop.name;
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

/**
 * Resolve view order from property keys to source values
 */
function resolveViewOrder(propertyKeys: readonly string[]): string[] {
  return propertyKeys.map(resolvePropertySource);
}

/**
 * Resolve sort configuration from property keys to source values
 */
function resolveSortConfig(
  sortConfig: readonly { property: string; direction: "ASC" | "DESC" }[]
): Array<{ property: string; direction: "ASC" | "DESC" }> {
  return sortConfig.map((sort) => ({
    property: resolvePropertySource(sort.property),
    direction: sort.direction,
  }));
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
          "note.tags": 134,
          "file.mtime": 165,
          "file.ctime": 183,
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
            FilterBuilder.ofCategory(taskType.name),
            FilterBuilder.withPriority(priority.name)
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
          "note.tags": 134,
          "file.mtime": 165,
          "file.ctime": 183,
        },
      },
      // All task types views
      ...settings.taskTypes.map((taskType) => ({
        type: "table" as const,
        name: `All ${pluralize(taskType.name)}`,
        filters: FilterBuilder.and(
          FilterBuilder.inFolder(settings.tasksFolder),
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
            FilterBuilder.inArea(area.name),
            FilterBuilder.ofCategory(taskType.name),
            FilterBuilder.withPriority(priority.name)
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
      // All task types views
      ...settings.taskTypes.map((taskType) => ({
        type: "table" as const,
        name: `All ${pluralize(taskType.name)}`,
        filters: FilterBuilder.and(
          FilterBuilder.inFolder(settings.tasksFolder),
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

/**
 * Generate Parent Task base configuration
 */
export function generateParentTaskBase(
  settings: TaskSyncSettings,
  parentTaskName: string
): string {
  const config = {
    formulas: {
      Title: "link(file.name, Title)",
    },
    properties: generatePropertiesSection(PROPERTY_SETS.TASKS_BASE),
    views: [
      // Child tasks view
      {
        type: "table",
        name: "Child Tasks",
        filters: FILTER_PRESETS.CHILD_TASKS(
          settings,
          parentTaskName
        ).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.TASKS_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.TASK),
      },
      // All related tasks (parent + children)
      {
        type: "table",
        name: "All Related",
        filters: FILTER_PRESETS.RELATED_TASKS(
          settings,
          parentTaskName
        ).toFilterObject(),
        order: resolveViewOrder(VIEW_ORDERS.TASKS_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.TASK),
      },
    ],
  };

  return yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

// ============================================================================
// FRONT-MATTER GENERATION
// ============================================================================

/**
 * Generate front-matter properties for task files
 */
export function generateTaskFrontMatter(): PropertyDefinition[] {
  return PROPERTY_SETS.TASK_FRONTMATTER.map((key) => {
    const prop = PROPERTY_REGISTRY[key as keyof typeof PROPERTY_REGISTRY];
    return { ...prop };
  });
}

/**
 * Generate front-matter properties for project files
 */
export function generateProjectFrontMatter(): PropertyDefinition[] {
  return [
    { key: "name", name: "Name", type: "string", frontmatter: true }, // Use Name instead of Title for projects
    { key: "type", name: "Type", type: "string", frontmatter: true },
    PROPERTY_REGISTRY.AREAS,
    PROPERTY_REGISTRY.TAGS,
  ];
}

/**
 * Generate front-matter properties for area files
 */
export function generateAreaFrontMatter(): PropertyDefinition[] {
  return [
    { key: "name", name: "Name", type: "string", frontmatter: true }, // Use Name instead of Title for areas
    { key: "type", name: "Type", type: "string", frontmatter: true },
    PROPERTY_REGISTRY.TAGS,
  ];
}
