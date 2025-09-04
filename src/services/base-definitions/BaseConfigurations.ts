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

export interface BaseFormulas {
  [key: string]: string;
}

export interface BaseProperties {
  [key: string]: BaseProperty;
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
  properties: BaseProperties;
  viewTemplates: ViewTemplate[];
}

export interface ConfigurationContext {
  settings: TaskSyncSettings;
  name?: string;
  type?: 'project' | 'area';
  projectsAndAreas?: Array<{ name: string; path: string; type: 'project' | 'area' }>;
}

// ============================================================================
// STATIC FORMULAS
// ============================================================================

export const FORMULAS = {
  common: {
    Type: 'Type',
    Title: 'link(file.name, Title)'
  }
} as const;

// ============================================================================
// STATIC PROPERTIES
// ============================================================================

export const PROPERTIES = {
  common: {
    'file.name': { displayName: 'Title' },
    'note.Done': { displayName: 'Done' },
    'file.ctime': { displayName: 'Created At' },
    'file.mtime': { displayName: 'Updated At' }
  },

  task: {
    'note.Status': { displayName: 'Done' },
    'note.tags': { displayName: 'Tags' },
    'note.Areas': { displayName: 'Areas' },
    'note.Project': { displayName: 'Project' },
    'note.Priority': { displayName: 'Priority' },
    'note.Parent task': { displayName: 'Parent task' },
    'note.Sub-tasks': { displayName: 'Sub-tasks' }
  },

  area: {
    'note.Project': { displayName: 'Project' }
  },

  project: {
    'note.Areas': { displayName: 'Areas' }
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
      'formula.Type',
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
      'formula.Type',
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
      'formula.Type',
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

export const FRONTMATTER_FIELDS = {
  task: {
    Title: { required: true, type: 'string' },
    Type: { required: false, type: 'string', default: 'Task' },
    Areas: { required: false, type: 'string' },
    'Parent task': { required: false, type: 'string' },
    'Sub-tasks': { required: false, type: 'string' },
    tags: { required: false, type: 'array' },
    Project: { required: false, type: 'string' },
    Done: { required: false, type: 'boolean', default: false },
    Status: { required: false, type: 'string', default: 'Backlog' },
    Priority: { required: false, type: 'string' }
  },

  project: {
    Title: { required: true, type: 'string' },
    Name: { required: true, type: 'string' },
    Type: { required: true, type: 'string', default: 'Project' },
    Areas: { required: false, type: 'string' }
  },

  area: {
    Title: { required: true, type: 'string' },
    Name: { required: true, type: 'string' },
    Type: { required: true, type: 'string', default: 'Area' }
  }
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
    properties: { ...PROPERTIES.common, ...PROPERTIES.task },
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
      // Type-specific views
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .map(taskType => ({
          type: 'table' as const,
          name: pluralize(taskType.name),
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Type == "${taskType.name}"`
            ]
          },
          order: [...VIEW_ORDERS.tasks.type],
          sort: [...SORT_CONFIGS.main]
        })),
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
            'formula.Type',
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
            'formula.Type',
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
    properties: { ...PROPERTIES.common, ...PROPERTIES.area },
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
      // Type-specific views
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .map(taskType => ({
          type: 'table' as const,
          name: pluralize(taskType.name),
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Areas.contains(link("${area.name}"))`,
              `Type == "${taskType.name}"`
            ]
          },
          order: [...VIEW_ORDERS.area.type],
          sort: [...SORT_CONFIGS.main]
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
 * Generate Project base configuration
 */
export function generateProjectBase(settings: TaskSyncSettings, project: ProjectAreaInfo): string {
  const config: BaseConfig = {
    formulas: FORMULAS.common,
    properties: { ...PROPERTIES.common, ...PROPERTIES.project },
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
      // Type-specific views
      ...settings.taskTypes
        .filter(taskType => taskType.name !== 'Task')
        .map(taskType => ({
          type: 'table' as const,
          name: pluralize(taskType.name),
          filters: {
            and: [
              `file.folder == "${settings.tasksFolder}"`,
              `Project.contains(link("${project.name}"))`,
              `Type == "${taskType.name}"`
            ]
          },
          order: [...VIEW_ORDERS.project.type],
          sort: [...SORT_CONFIGS.main]
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
