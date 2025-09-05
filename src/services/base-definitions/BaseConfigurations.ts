/**
 * Base Configurations
 * Simplified declarative base generation system
 */

import { TaskSyncSettings } from '../../main';
import * as yaml from 'js-yaml';
import pluralize from 'pluralize';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface PropertyDefinition {
  name: string;
  type: 'string' | 'number' | 'checkbox' | 'array' | 'date';
  source?: string;
  link?: boolean;
  default?: any;
}

export interface ProjectAreaInfo {
  name: string;
  path: string;
  type: 'project' | 'area';
}

// ============================================================================
// SINGLE SOURCE OF TRUTH FOR ALL PROPERTIES
// ============================================================================

export const PROPERTY_REGISTRY: Record<string, PropertyDefinition> = {
  TITLE: { name: "Title", type: "string", source: "formula.Title" },
  TYPE: { name: "Type", type: "string" },
  PRIORITY: { name: "Priority", type: "string" },
  AREAS: { name: "Areas", type: "array", link: true, default: [] },
  PROJECT: { name: "Project", type: "string", link: true },
  DONE: { name: "Done", type: "checkbox", default: false },
  STATUS: { name: "Status", type: "string", default: "Backlog" },
  PARENT_TASK: { name: "Parent task", type: "string", link: true },
  SUB_TASKS: { name: "Sub-tasks", type: "array", link: true },
  TAGS: { name: "tags", type: "array" },
  CREATED_AT: { name: "Created At", type: "string", source: "file.ctime" },
  UPDATED_AT: { name: "Updated At", type: "string", source: "file.mtime" }
};

// ============================================================================
// PROPERTY SETS FOR DIFFERENT CONTEXTS
// ============================================================================

export const PROPERTY_SETS = {
  TASK_FRONTMATTER: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS'],
  TASKS_BASE: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS', 'CREATED_AT', 'UPDATED_AT'],
  AREA_BASE: ['TITLE', 'TYPE', 'PRIORITY', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS', 'CREATED_AT', 'UPDATED_AT'],
  PROJECT_BASE: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS', 'CREATED_AT', 'UPDATED_AT']
} as const;

// ============================================================================
// SIMPLE VIEW ORDERS USING PROPERTY KEYS
// ============================================================================

export const VIEW_ORDERS = {
  TASKS_MAIN: ['DONE', 'TITLE', 'PROJECT', 'TYPE', 'CREATED_AT', 'UPDATED_AT'],
  TASKS_TYPE: ['DONE', 'TITLE', 'PROJECT', 'CREATED_AT', 'UPDATED_AT'],
  AREA_MAIN: ['DONE', 'TITLE', 'PROJECT', 'TYPE', 'CREATED_AT', 'UPDATED_AT'],
  PROJECT_MAIN: ['DONE', 'TITLE', 'AREAS', 'TYPE', 'CREATED_AT', 'UPDATED_AT']
} as const;

// ============================================================================
// SIMPLE SORT CONFIGURATIONS
// ============================================================================

export const SORT_CONFIGS = {
  MAIN: [
    { property: 'DONE', direction: 'ASC' as const },
    { property: 'UPDATED_AT', direction: 'DESC' as const },
    { property: 'CREATED_AT', direction: 'DESC' as const },
    { property: 'TITLE', direction: 'ASC' as const }
  ],
  AREA: [
    { property: 'DONE', direction: 'ASC' as const },
    { property: 'UPDATED_AT', direction: 'DESC' as const },
    { property: 'TITLE', direction: 'ASC' as const }
  ]
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
function generatePropertiesSection(propertyKeys: readonly string[]): Record<string, any> {
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
      ...(prop.default !== undefined && { default: prop.default })
    };
  });

  // Add metadata properties with displayName
  if (propertyKeys.includes('CREATED_AT')) {
    properties['file.ctime'] = { displayName: 'Created At' };
  }
  if (propertyKeys.includes('UPDATED_AT')) {
    properties['file.mtime'] = { displayName: 'Updated At' };
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
function resolveSortConfig(sortConfig: readonly { property: string; direction: 'ASC' | 'DESC' }[]): Array<{ property: string; direction: 'ASC' | 'DESC' }> {
  return sortConfig.map(sort => ({
    property: resolvePropertySource(sort.property),
    direction: sort.direction
  }));
}

// ============================================================================
// BASE GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate Tasks base configuration
 */
export function generateTasksBase(settings: TaskSyncSettings, projectsAndAreas: ProjectAreaInfo[]): string {
  const config = {
    formulas: {
      Title: 'link(file.name, Title)'
    },
    properties: generatePropertiesSection(PROPERTY_SETS.TASKS_BASE),
    views: [
      // Main Tasks view
      {
        type: 'table',
        name: 'Tasks',
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `Areas.contains(link("${projectsAndAreas.find(p => p.type === 'area')?.name || 'Task Sync'}"))`,
            `note["Parent task"].isEmpty()`
          ]
        },
        order: resolveViewOrder(VIEW_ORDERS.TASKS_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.MAIN),
        columnSize: {
          'formula.Title': 382,
          'note.tags': 134,
          'file.mtime': 165,
          'file.ctime': 183
        }
      },
      // All task types views
      ...settings.taskTypes.map(taskType => ({
        type: 'table' as const,
        name: `All ${pluralize(taskType.name)}`,
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `Areas.contains(link("${projectsAndAreas.find(p => p.type === 'area')?.name || 'Task Sync'}"))`,
            `Type == "${taskType.name}"`,
            `note["Parent task"].isEmpty()`
          ]
        },
        order: resolveViewOrder(VIEW_ORDERS.TASKS_TYPE),
        sort: resolveSortConfig(SORT_CONFIGS.MAIN)
      })),
      // Priority-based views for each type
      ...settings.taskTypes.flatMap(taskType =>
        settings.taskPriorities.map(priority => ({
          type: 'table' as const,
          name: `${pluralize(taskType.name)} • ${priority.name} priority`,
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Areas.contains(link("${projectsAndAreas.find(p => p.type === 'area')?.name || 'Task Sync'}"))`,
              `Type == "${taskType.name}"`,
              `Priority == "${priority.name}"`
            ]
          },
          order: resolveViewOrder(VIEW_ORDERS.TASKS_TYPE),
          sort: resolveSortConfig(SORT_CONFIGS.MAIN)
        }))
      )
    ]
  };

  return yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
}

/**
 * Generate Area base configuration
 */
export function generateAreaBase(settings: TaskSyncSettings, area: ProjectAreaInfo): string {
  const config = {
    formulas: {
      Title: 'link(file.name, Title)'
    },
    properties: generatePropertiesSection(PROPERTY_SETS.AREA_BASE),
    views: [
      // Main Tasks view
      {
        type: 'table',
        name: 'Tasks',
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `Areas.contains(link("${area.name}"))`,
            `note["Parent task"].isEmpty()`
          ]
        },
        order: resolveViewOrder(VIEW_ORDERS.AREA_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.AREA),
        columnSize: {
          'formula.Title': 382,
          'note.tags': 134,
          'file.mtime': 165,
          'file.ctime': 183
        }
      },
      // All task types views
      ...settings.taskTypes.map(taskType => ({
        type: 'table' as const,
        name: `All ${pluralize(taskType.name)}`,
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `Areas.contains(link("${area.name}"))`,
            `Type == "${taskType.name}"`,
            `note["Parent task"].isEmpty()`
          ]
        },
        order: resolveViewOrder(VIEW_ORDERS.AREA_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.AREA)
      })),
      // Priority-based views for each type
      ...settings.taskTypes.flatMap(taskType =>
        settings.taskPriorities.map(priority => ({
          type: 'table' as const,
          name: `${pluralize(taskType.name)} • ${priority.name} priority`,
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Areas.contains(link("${area.name}"))`,
              `Type == "${taskType.name}"`,
              `Priority == "${priority.name}"`
            ]
          },
          order: resolveViewOrder(VIEW_ORDERS.AREA_MAIN),
          sort: resolveSortConfig(SORT_CONFIGS.AREA)
        }))
      )
    ]
  };

  return yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
}

/**
 * Generate Project base configuration
 */
export function generateProjectBase(settings: TaskSyncSettings, project: ProjectAreaInfo): string {
  const config = {
    formulas: {
      Title: 'link(file.name, Title)'
    },
    properties: generatePropertiesSection(PROPERTY_SETS.PROJECT_BASE),
    views: [
      // Main Tasks view
      {
        type: 'table',
        name: 'Tasks',
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `Project.contains(link("${project.name}"))`,
            `note["Parent task"].isEmpty()`
          ]
        },
        order: resolveViewOrder(VIEW_ORDERS.PROJECT_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.MAIN),
        columnSize: {
          'formula.Title': 382,
          'note.tags': 134,
          'file.mtime': 165,
          'file.ctime': 183
        }
      },
      // All task types views
      ...settings.taskTypes.map(taskType => ({
        type: 'table' as const,
        name: `All ${pluralize(taskType.name)}`,
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `Project.contains(link("${project.name}"))`,
            `Type == "${taskType.name}"`,
            `note["Parent task"].isEmpty()`
          ]
        },
        order: resolveViewOrder(VIEW_ORDERS.PROJECT_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.MAIN)
      })),
      // Priority-based views for each type
      ...settings.taskTypes.flatMap(taskType =>
        settings.taskPriorities.map(priority => ({
          type: 'table' as const,
          name: `${pluralize(taskType.name)} • ${priority.name} priority`,
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Project.contains(link("${project.name}"))`,
              `Type == "${taskType.name}"`,
              `Priority == "${priority.name}"`
            ]
          },
          order: resolveViewOrder(VIEW_ORDERS.PROJECT_MAIN),
          sort: resolveSortConfig(SORT_CONFIGS.MAIN)
        }))
      )
    ]
  };

  return yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
}

/**
 * Generate Parent Task base configuration
 */
export function generateParentTaskBase(settings: TaskSyncSettings, parentTaskName: string): string {
  const config = {
    formulas: {
      Title: 'link(file.name, Title)'
    },
    properties: generatePropertiesSection(PROPERTY_SETS.TASKS_BASE),
    views: [
      // Sub-tasks view
      {
        type: 'table',
        name: 'Sub-tasks',
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `"Parent task".contains(link("${parentTaskName}"))`
          ]
        },
        order: resolveViewOrder(VIEW_ORDERS.TASKS_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.MAIN)
      },
      // All related tasks (parent + sub-tasks)
      {
        type: 'table',
        name: 'All Related',
        filters: {
          or: [
            `file.name == "${parentTaskName}"`,
            `"Parent task".contains(link("${parentTaskName}"))`
          ]
        },
        order: resolveViewOrder(VIEW_ORDERS.TASKS_MAIN),
        sort: resolveSortConfig(SORT_CONFIGS.MAIN)
      }
    ]
  };

  return yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
}

// ============================================================================
// FRONT-MATTER GENERATION
// ============================================================================

/**
 * Generate front-matter properties for task files
 */
export function generateTaskFrontMatter(): PropertyDefinition[] {
  return PROPERTY_SETS.TASK_FRONTMATTER.map(key => {
    const prop = PROPERTY_REGISTRY[key as keyof typeof PROPERTY_REGISTRY];
    return { ...prop };
  });
}

/**
 * Generate front-matter properties for project files
 */
export function generateProjectFrontMatter(): PropertyDefinition[] {
  // Projects need Name (as Title), Type, and Areas properties in that order
  return [
    { name: "Name", type: "string" }, // Use Name instead of Title for projects
    { name: "Type", type: "string" },
    PROPERTY_REGISTRY.AREAS
  ];
}

/**
 * Generate front-matter properties for area files
 */
export function generateAreaFrontMatter(): PropertyDefinition[] {
  // Areas need Name (as Title), Type, and Project properties in that order
  return [
    { name: "Name", type: "string" }, // Use Name instead of Title for areas
    { name: "Type", type: "string" },
    PROPERTY_REGISTRY.PROJECT
  ];
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Legacy Properties namespace for backward compatibility
 */
export const Properties = PROPERTY_REGISTRY;

/**
 * Legacy FILTER_GENERATORS for backward compatibility
 */
export const FILTER_GENERATORS = {
  excludeSubTasks: () => '!"Parent task" || "Parent task" == null'
};

/**
 * Legacy FRONTMATTER_FIELDS for backward compatibility
 * Convert property definitions to schema objects expected by refresh functionality
 */
export const FRONTMATTER_FIELDS = {
  task: (() => {
    const schema: Record<string, any> = {};
    generateTaskFrontMatter().forEach(prop => {
      schema[prop.name] = {
        type: prop.type,
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.link && { link: prop.link })
      };
    });
    return schema;
  })(),
  project: (() => {
    const schema: Record<string, any> = {};
    generateProjectFrontMatter().forEach(prop => {
      schema[prop.name] = {
        type: prop.type,
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.link && { link: prop.link })
      };
    });
    return schema;
  })(),
  area: (() => {
    const schema: Record<string, any> = {};
    generateAreaFrontMatter().forEach(prop => {
      schema[prop.name] = {
        type: prop.type,
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.link && { link: prop.link })
      };
    });
    return schema;
  })()
};
