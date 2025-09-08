/**
 * Settings types and interfaces for the Task Sync plugin
 */

// Task category interface with color support
export interface TaskType {
  name: string;
  color: string;
}

// Available colors for task categories
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
  isDone: boolean; // Indicates if this status represents a completed/done state
  isInProgress: boolean; // Indicates if this status represents an active/in-progress state
}

// Available colors for task statuses
export const TASK_STATUS_COLORS = [
  'blue', 'red', 'green', 'yellow', 'purple', 'orange', 'pink', 'gray', 'teal', 'indigo'
] as const;

export type TaskStatusColor = typeof TASK_STATUS_COLORS[number];

// GitHub integration interfaces
export interface GitHubIssueFilters {
  state: 'open' | 'closed' | 'all';
  assignee: string; // 'me' for current user, username, or empty for all
  labels: string[];
}

export interface GitHubIntegrationSettings {
  enabled: boolean;
  personalAccessToken: string;
  repositories: string[]; // Array of 'owner/repo' strings
  defaultRepository: string; // Default 'owner/repo' string
  issueFilters: GitHubIssueFilters;
  labelTypeMapping: Record<string, string>; // Map GitHub labels to task types
}

export interface TaskSyncSettings {
  tasksFolder: string;
  projectsFolder: string;
  areasFolder: string;
  templateFolder: string;
  useTemplater: boolean;
  defaultTaskTemplate: string;
  defaultProjectTemplate: string;
  defaultAreaTemplate: string;
  defaultParentTaskTemplate: string;
  // Base-related settings
  basesFolder: string;
  tasksBaseFile: string;
  autoGenerateBases: boolean;
  autoUpdateBaseViews: boolean;
  // Task categories configuration
  taskTypes: TaskType[];
  // Task priorities configuration
  taskPriorities: TaskPriority[];
  // Task statuses configuration
  taskStatuses: TaskStatus[];
  // Individual area/project bases
  areaBasesEnabled: boolean;
  projectBasesEnabled: boolean;
  autoSyncAreaProjectBases: boolean;
  // Task property ordering
  taskPropertyOrder: string[];
  // GitHub integration settings
  githubIntegration: GitHubIntegrationSettings;
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
  folderPath?: string; // Limit suggestions to files in this folder
  validateFile?: (file: string) => ValidationResult;
}
