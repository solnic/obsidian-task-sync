/**
 * Default settings configuration for the Task Sync plugin
 */

import { TaskSyncSettings } from "./types";
import { PROPERTY_SETS } from "../../../services/base-definitions/BaseConfigurations";

export const DEFAULT_SETTINGS: TaskSyncSettings = {
  tasksFolder: "Tasks",
  projectsFolder: "Projects",
  areasFolder: "Areas",
  templateFolder: "Templates",
  dailyNotesFolder: "Daily Notes",
  useTemplater: false,
  defaultTaskTemplate: "Task.md",
  defaultProjectTemplate: "project-template.md",
  defaultAreaTemplate: "area-template.md",
  defaultParentTaskTemplate: "parent-task-template.md",
  // Base-related defaults
  basesFolder: "Bases",
  tasksBaseFile: "Tasks.base",
  autoGenerateBases: true,
  autoUpdateBaseViews: true,
  // Task categories defaults
  taskTypes: [
    { name: "Task", color: "blue" },
    { name: "Bug", color: "red" },
    { name: "Feature", color: "green" },
    { name: "Improvement", color: "purple" },
    { name: "Chore", color: "gray" },
  ],
  // Task priorities defaults
  taskPriorities: [
    { name: "Low", color: "green" },
    { name: "Medium", color: "yellow" },
    { name: "High", color: "orange" },
    { name: "Urgent", color: "red" },
  ],
  // Task statuses defaults
  taskStatuses: [
    { name: "Backlog", color: "gray", isDone: false, isInProgress: false },
    { name: "In Progress", color: "blue", isDone: false, isInProgress: true },
    { name: "Done", color: "green", isDone: true, isInProgress: false },
  ],
  // Individual area/project bases defaults
  areaBasesEnabled: true,
  projectBasesEnabled: true,
  autoSyncAreaProjectBases: true,
  // Task property ordering defaults
  taskPropertyOrder: [...PROPERTY_SETS.TASK_FRONTMATTER],
  // GitHub integration defaults
  githubIntegration: {
    enabled: false,
    personalAccessToken: "",
    repositories: [],
    defaultRepository: "",
    issueFilters: {
      state: "open",
      assignee: "",
      labels: [],
    },
    labelTypeMapping: {
      bug: "Bug",
      enhancement: "Feature",
      feature: "Feature",
      improvement: "Improvement",
      chore: "Chore",
      documentation: "Chore",
    },
  },
};

/**
 * Default folder paths for quick setup
 */
export const DEFAULT_FOLDER_PATHS = {
  tasks: "Tasks",
  projects: "Projects",
  areas: "Areas",
  templates: "Templates",
  bases: "Bases",
} as const;

/**
 * Default template file names
 */
export const DEFAULT_TEMPLATE_NAMES = {
  task: "task-template.md",
  project: "project-template.md",
  area: "area-template.md",
} as const;

/**
 * Validation patterns for settings
 */
export const VALIDATION_PATTERNS = {
  folderName: /^[^<>:"\\|?*\x00-\x1f]*$/, // Allow forward slashes for folder paths
  fileName: /^[^<>:"/\\|?*\x00-\x1f]+\.[a-zA-Z0-9]+$/,
} as const;
