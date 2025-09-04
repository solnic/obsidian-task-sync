/**
 * Static Base Configurations
 * Declarative configuration objects for base definitions
 * Replaces getter methods with composable static objects
 */

import { BaseProperty, BaseView, BaseConfig } from '../BaseManager';
import { TaskSyncSettings } from '../../main';
import * as yaml from 'js-yaml';
import pluralize from 'pluralize';

// ============================================================================
// CORE TYPES
// ============================================================================

export interface PropertyDefinition {
  name: string;
  type: 'string' | 'checkbox' | 'array' | 'boolean';
  default?: any;
  link?: boolean; // For internal usage, specifies that this property is used for linking with other notes
  displayName?: string;
}

export interface BaseFormulas {
  [key: string]: string;
}

export interface ViewTemplate {
  type: 'table' | 'kanban' | 'calendar';
  name: string;
  filters?: {
    and?: string[];
    or?: string[];
  };
  order?: string[];
  sort?: Array<{
    property: string;
    direction: 'ASC' | 'DESC';
  }>;
  columnSize?: Record<string, number>;
}

export interface BaseConfiguration {
  formulas: BaseFormulas;
  properties: readonly PropertyDefinition[];
  viewTemplates: ViewTemplate[];
}

export interface ConfigurationContext {
  settings: TaskSyncSettings;
  name?: string;
  type?: 'project' | 'area';
  projectsAndAreas?: Array<{ name: string; path: string; type: 'project' | 'area' }>;
}

// ============================================================================
// PROPERTY DEFINITIONS
// ============================================================================

export namespace Properties {
  // Common properties
  export const TITLE: PropertyDefinition = {
    name: "Title",
    type: "string"
  };

  export const DONE: PropertyDefinition = {
    name: "Done",
    type: "checkbox",
    default: false
  };

  export const CREATED_AT: PropertyDefinition = {
    name: "Created At",
    type: "string"
  };

  export const UPDATED_AT: PropertyDefinition = {
    name: "Updated At",
    type: "string"
  };

  // Task-specific properties (in order from screenshot)
  export const AREAS: PropertyDefinition = {
    name: "Areas",
    type: "string",
    link: true
  };

  export const PROJECT: PropertyDefinition = {
    name: "Project",
    type: "string",
    link: true
  };

  export const TYPE: PropertyDefinition = {
    name: "Type",
    type: "string"
  };

  export const PRIORITY: PropertyDefinition = {
    name: "Priority",
    type: "string"
  };

  export const STATUS: PropertyDefinition = {
    name: "Status",
    type: "string",
    default: "Backlog"
  };

  export const PARENT_TASK: PropertyDefinition = {
    name: "Parent task",
    type: "string",
    link: true
  };

  export const SUB_TASKS: PropertyDefinition = {
    name: "Sub-tasks",
    type: "string",
    link: true
  };

  export const TAGS: PropertyDefinition = {
    name: "tags",
    type: "array"
  };

  // Area/Project specific properties
  export const NAME: PropertyDefinition = {
    name: "Name",
    type: "string"
  };
}

// ============================================================================
// PROPERTY ARRAYS (defining order)
// ============================================================================

export const PROPERTY_DEFINITIONS = {
  task: [
    Properties.TITLE,
    Properties.TYPE,
    Properties.AREAS,
    Properties.PARENT_TASK,
    Properties.SUB_TASKS,
    Properties.TAGS,
    Properties.PROJECT,
    Properties.DONE,
    Properties.STATUS,
    Properties.PRIORITY
  ],

  // Properties for area bases (showing tasks, but excluding Areas since we're already filtering by area)
  areaBase: [
    Properties.TITLE,
    Properties.TYPE,
    Properties.PARENT_TASK,
    Properties.SUB_TASKS,
    Properties.TAGS,
    Properties.PROJECT,
    Properties.DONE,
    Properties.STATUS,
    Properties.PRIORITY
  ],

  // Properties for project bases (showing tasks, but excluding Project since we're already filtering by project)
  projectBase: [
    Properties.TITLE,
    Properties.TYPE,
    Properties.AREAS,
    Properties.PARENT_TASK,
    Properties.SUB_TASKS,
    Properties.TAGS,
    Properties.DONE,
    Properties.STATUS,
    Properties.PRIORITY
  ],

  // Properties for area/project files themselves (not for bases showing tasks)
  area: [
    Properties.NAME,
    Properties.PROJECT
  ],

  project: [
    Properties.NAME,
    Properties.AREAS
  ]
} as const;

// ============================================================================
// STATIC FORMULAS
// ============================================================================

export const FORMULAS = {
  common: {
    Title: 'link(file.name, Title)'
  },

  area: {
    Name: 'link(file.name, Name)'
  },

  project: {
    Name: 'link(file.name, Name)'
  }
} as const;



// ============================================================================
// VIEW ORDER CONFIGURATIONS
// ============================================================================

export const VIEW_ORDERS = {
  tasks: {
    main: [
      'Status',
      'formula.Title',
      'note.Type',
      'tags',
      'file.mtime',
      'file.ctime',
      'Areas',
      'Project'
    ],
    type: [
      'Status',
      'formula.Title',
      'tags',
      'file.mtime',
      'file.ctime',
      'Areas',
      'Project'
    ]
  },

  area: {
    main: [
      'Done',
      'formula.Title',
      'Project',
      'note.Type',
      'file.ctime',
      'file.mtime'
    ],
    type: [
      'Done',
      'formula.Title',
      'Project',
      'file.ctime',
      'file.mtime'
    ]
  },

  project: {
    main: [
      'Done',
      'formula.Title',
      'Areas',
      'note.Type',
      'file.ctime',
      'file.mtime'
    ],
    type: [
      'Done',
      'formula.Title',
      'Areas',
      'file.ctime',
      'file.mtime'
    ]
  }
} as const;

// ============================================================================
// SORT CONFIGURATIONS
// ============================================================================

export const SORT_CONFIGS = {
  main: [
    { property: 'file.mtime', direction: 'DESC' as const },
    { property: 'formula.Title', direction: 'ASC' as const }
  ],

  area: [
    { property: 'file.mtime', direction: 'ASC' as const },
    { property: 'formula.Title', direction: 'ASC' as const }
  ]
} as const;

// ============================================================================
// VIEW TEMPLATES
// ============================================================================

export const VIEW_TEMPLATES = {
  tasks: {
    main: {
      type: 'table' as const,
      name: 'Tasks',
      order: VIEW_ORDERS.tasks.main,
      sort: SORT_CONFIGS.main
    },

    all: {
      type: 'table' as const,
      name: 'All',
      order: VIEW_ORDERS.tasks.main,
      sort: SORT_CONFIGS.main
    }
  },

  area: {
    main: {
      type: 'table' as const,
      name: 'Tasks',
      order: VIEW_ORDERS.area.main,
      sort: SORT_CONFIGS.area,
      columnSize: {
        'formula.Title': 382,
        'note.tags': 134,
        'file.mtime': 165,
        'file.ctime': 183
      }
    }
  },

  project: {
    main: {
      type: 'table' as const,
      name: 'Tasks',
      order: VIEW_ORDERS.project.main,
      sort: SORT_CONFIGS.main
    }
  }
} as const;

// ============================================================================
// FILTER GENERATORS
// ============================================================================

export const FILTER_GENERATORS = {
  tasksFolder: (settings: TaskSyncSettings) => `file.folder == "${settings.tasksFolder}"`,

  area: (areaName: string) => `Areas.contains(link("${areaName}"))`,

  project: (projectName: string) => `Project.contains(link("${projectName}"))`,

  taskType: (typeName: string) => `Type == "${typeName}"`
} as const;

// ============================================================================
// FRONT-MATTER FIELD DEFINITIONS
// ============================================================================

/**
 * Convert property definitions array to front-matter field format
 */
function convertPropertiesToFrontMatterFormat(properties: readonly PropertyDefinition[], defaultType?: string): Record<string, any> {
  const result: Record<string, any> = {};

  properties.forEach(prop => {
    result[prop.name] = {
      type: prop.type,
      ...(prop.default !== undefined && { default: prop.default })
    };
  });

  // Add Type field with default if specified
  if (defaultType) {
    result.Type = { type: 'string', default: defaultType };
  }

  return result;
}

export const FRONTMATTER_FIELDS = {
  task: convertPropertiesToFrontMatterFormat(PROPERTY_DEFINITIONS.task, 'Task'),
  project: convertPropertiesToFrontMatterFormat(PROPERTY_DEFINITIONS.project, 'Project'),
  area: convertPropertiesToFrontMatterFormat(PROPERTY_DEFINITIONS.area, 'Area')
} as const;

// ============================================================================
// BASE GENERATION FUNCTIONS
// ============================================================================

export interface ProjectAreaInfo {
  name: string;
  path: string;
  type: 'project' | 'area';
}

/**
 * Generate Tasks base configuration
 */
export function generateTasksBase(settings: TaskSyncSettings, projectsAndAreas: ProjectAreaInfo[]): string {
  const config: BaseConfig = {
    formulas: FORMULAS.common,
    properties: PROPERTY_DEFINITIONS.task,
    views: [
      // Main Tasks view
      {
        type: 'table',
        name: 'Tasks',
        filters: { and: [`file.folder == "${settings.tasksFolder}"`] },
        order: [...VIEW_ORDERS.tasks.main],
        sort: [...SORT_CONFIGS.main]
      },
      // All view
      {
        type: 'table',
        name: 'All',
        filters: { and: [`file.folder == "${settings.tasksFolder}"`] },
        order: [...VIEW_ORDERS.tasks.main],
        sort: [...SORT_CONFIGS.main]
      },
      // Type-specific views (renamed to "All X")
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .map(taskType => ({
          type: 'table' as const,
          name: `All ${pluralize(taskType.name)}`,
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Type == "${taskType.name}"`
            ]
          },
          order: [...VIEW_ORDERS.tasks.type],
          sort: [...SORT_CONFIGS.main]
        })),
      // Priority-based views for each type
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .flatMap(taskType =>
          settings.taskPriorities.map(priority => ({
            type: 'table' as const,
            name: `${pluralize(taskType.name)} • ${priority.name} priority`,
            filters: {
              and: [
                `file.folder == "${settings.tasksFolder}"`,
                `Type == "${taskType.name}"`,
                `Priority == "${priority.name}"`
              ]
            },
            order: [...VIEW_ORDERS.tasks.type],
            sort: [...SORT_CONFIGS.main]
          }))
        ),
      // Area views
      ...projectsAndAreas
        .filter(item => item.type === 'area')
        .map(area => ({
          type: 'table' as const,
          name: area.name,
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Areas.contains(link("${area.name}"))`
            ]
          },
          order: [
            'Status',
            'formula.Title',
            'note.Type',
            'tags',
            'file.mtime',
            'file.ctime',
            'Project'
          ],
          sort: [...SORT_CONFIGS.area],
          columnSize: {
            'formula.Title': 382,
            'note.tags': 134,
            'file.mtime': 165,
            'file.ctime': 183
          }
        })),
      // Project views
      ...projectsAndAreas
        .filter(item => item.type === 'project')
        .map(project => ({
          type: 'table' as const,
          name: project.name,
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Project.contains(link("${project.name}"))`
            ]
          },
          order: [
            'Status',
            'formula.Title',
            'note.Type',
            'tags',
            'file.mtime',
            'file.ctime',
            'Areas'
          ],
          sort: [...SORT_CONFIGS.area]
        }))
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
  const config: BaseConfig = {
    formulas: FORMULAS.common,
    properties: PROPERTY_DEFINITIONS.areaBase,
    views: [
      // Main Tasks view
      {
        type: 'table',
        name: 'Tasks',
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `Areas.contains(link("${area.name}"))`
          ]
        },
        order: [...VIEW_ORDERS.area.main],
        sort: [...SORT_CONFIGS.area],
        columnSize: {
          'formula.Title': 382,
          'note.tags': 134,
          'file.mtime': 165,
          'file.ctime': 183
        }
      },
      // Type-specific views (renamed to "All X")
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .map(taskType => ({
          type: 'table' as const,
          name: `All ${pluralize(taskType.name)}`,
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Areas.contains(link("${area.name}"))`,
              `Type == "${taskType.name}"`
            ]
          },
          order: [...VIEW_ORDERS.area.type],
          sort: [...SORT_CONFIGS.main]
        })),
      // Priority-based views for each type
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .flatMap(taskType =>
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
            order: [...VIEW_ORDERS.area.type],
            sort: [...SORT_CONFIGS.main]
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
  const config: BaseConfig = {
    formulas: FORMULAS.common,
    properties: PROPERTY_DEFINITIONS.projectBase,
    views: [
      // Main Tasks view
      {
        type: 'table',
        name: 'Tasks',
        filters: {
          and: [
            `file.folder == "${settings.tasksFolder}"`,
            `Project.contains(link("${project.name}"))`
          ]
        },
        order: [...VIEW_ORDERS.project.main],
        sort: [...SORT_CONFIGS.main]
      },
      // Type-specific views (renamed to "All X")
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .map(taskType => ({
          type: 'table' as const,
          name: `All ${pluralize(taskType.name)}`,
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Project.contains(link("${project.name}"))`,
              `Type == "${taskType.name}"`
            ]
          },
          order: [...VIEW_ORDERS.project.type],
          sort: [...SORT_CONFIGS.main]
        })),
      // Priority-based views for each type
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .flatMap(taskType =>
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
            order: [...VIEW_ORDERS.project.type],
            sort: [...SORT_CONFIGS.main]
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
