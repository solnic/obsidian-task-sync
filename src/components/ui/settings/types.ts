/**
 * Settings types and interfaces for the Task Sync plugin
 */

// Task type interface with color support
export interface TaskType {
  name: string;
  color: string;
}

// Available colors for task types
export const TASK_TYPE_COLORS = [
  'blue', 'red', 'green', 'yellow', 'purple', 'orange', 'pink', 'gray', 'teal', 'indigo'
] as const;

export type TaskTypeColor = typeof TASK_TYPE_COLORS[number];

// Task priority interface with color support
export interface TaskPriority {
  name: string;
  color: string;
}

// Available colors for task priorities
export const TASK_PRIORITY_COLORS = [
  'blue', 'red', 'green', 'yellow', 'purple', 'orange', 'pink', 'gray', 'teal', 'indigo'
] as const;

export type TaskPriorityColor = typeof TASK_PRIORITY_COLORS[number];

// Task status interface with color support
export interface TaskStatus {
  name: string;
  color: string;
}

// Available colors for task statuses
export const TASK_STATUS_COLORS = [
  'blue', 'red', 'green', 'yellow', 'purple', 'orange', 'pink', 'gray', 'teal', 'indigo'
] as const;

export type TaskStatusColor = typeof TASK_STATUS_COLORS[number];

export interface TaskSyncSettings {
  tasksFolder: string;
  projectsFolder: string;
  areasFolder: string;
  templateFolder: string;
  useTemplater: boolean;
  defaultTaskTemplate: string;
  defaultProjectTemplate: string;
  defaultAreaTemplate: string;
  // Base-related settings
  basesFolder: string;
  tasksBaseFile: string;
  autoGenerateBases: boolean;
  autoUpdateBaseViews: boolean;
  // Task types configuration
  taskTypes: TaskType[];
  // Task priorities configuration
  taskPriorities: TaskPriority[];
  // Task statuses configuration
  taskStatuses: TaskStatus[];
  // Individual area/project bases
  areaBasesEnabled: boolean;
  projectBasesEnabled: boolean;
  autoSyncAreaProjectBases: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface SettingsSection {
  id: string;
  title: string;
  description?: string;
  render: (container: HTMLElement) => void;
}

export interface FolderSuggestOptions {
  placeholder?: string;
  allowEmpty?: boolean;
  validatePath?: (path: string) => ValidationResult;
}

export interface FileSuggestOptions {
  placeholder?: string;
  allowEmpty?: boolean;
  fileExtensions?: string[];
  validateFile?: (file: string) => ValidationResult;
}
