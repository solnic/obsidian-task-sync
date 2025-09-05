/**
 * Default settings configuration for the Task Sync plugin
 */

import { TaskSyncSettings } from './types';

export const DEFAULT_SETTINGS: TaskSyncSettings = {
  tasksFolder: 'Tasks',
  projectsFolder: 'Projects',
  areasFolder: 'Areas',
  templateFolder: 'Templates',
  useTemplater: false,
  defaultTaskTemplate: 'task-template.md',
  defaultProjectTemplate: 'project-template.md',
  defaultAreaTemplate: 'area-template.md',
  defaultParentTaskTemplate: 'parent-task-template.md',
  // Base-related defaults
  basesFolder: 'Bases',
  tasksBaseFile: 'Tasks.base',
  autoGenerateBases: true,
  autoUpdateBaseViews: true,
  // Task types defaults
  taskTypes: [
    { name: 'Task', color: 'blue' },
    { name: 'Bug', color: 'red' },
    { name: 'Feature', color: 'green' },
    { name: 'Improvement', color: 'purple' },
    { name: 'Chore', color: 'gray' }
  ],
  // Task priorities defaults
  taskPriorities: [
    { name: 'Low', color: 'green' },
    { name: 'Medium', color: 'yellow' },
    { name: 'High', color: 'orange' },
    { name: 'Urgent', color: 'red' }
  ],
  // Task statuses defaults
  taskStatuses: [
    { name: 'Backlog', color: 'gray', isDone: false },
    { name: 'In Progress', color: 'blue', isDone: false },
    { name: 'Done', color: 'green', isDone: true }
  ],
  // Individual area/project bases defaults
  areaBasesEnabled: true,
  projectBasesEnabled: true,
  autoSyncAreaProjectBases: true
};

/**
 * Default folder paths for quick setup
 */
export const DEFAULT_FOLDER_PATHS = {
  tasks: 'Tasks',
  projects: 'Projects',
  areas: 'Areas',
  templates: 'Templates',
  bases: 'Bases'
} as const;

/**
 * Default template file names
 */
export const DEFAULT_TEMPLATE_NAMES = {
  task: 'task-template.md',
  project: 'project-template.md',
  area: 'area-template.md'
} as const;

/**
 * Validation patterns for settings
 */
export const VALIDATION_PATTERNS = {
  folderName: /^[^<>:"/\\|?*\x00-\x1f]*$/,
  fileName: /^[^<>:"/\\|?*\x00-\x1f]+\.[a-zA-Z0-9]+$/
} as const;
