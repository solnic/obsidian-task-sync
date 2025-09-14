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
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "gray",
  "teal",
  "indigo",
] as const;

export type TaskTypeColor = (typeof TASK_TYPE_COLORS)[number];

// Task priority interface with color support
export interface TaskPriority {
  name: string;
  color: string;
}

// Available colors for task priorities
export const TASK_PRIORITY_COLORS = [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "gray",
  "teal",
  "indigo",
] as const;

export type TaskPriorityColor = (typeof TASK_PRIORITY_COLORS)[number];

// Task status interface with color support
export interface TaskStatus {
  name: string;
  color: string;
  isDone: boolean; // Indicates if this status represents a completed/done state
  isInProgress: boolean; // Indicates if this status represents an active/in-progress state
}

// Available colors for task statuses
export const TASK_STATUS_COLORS = [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "gray",
  "teal",
  "indigo",
] as const;

export type TaskStatusColor = (typeof TASK_STATUS_COLORS)[number];

// GitHub integration interfaces
export interface GitHubIssueFilters {
  state: "open" | "closed" | "all";
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

// Apple Reminders integration interfaces
export interface AppleRemindersIntegrationSettings {
  enabled: boolean;
  includeCompletedReminders: boolean;
  reminderLists: string[]; // Array of reminder list names to sync
  syncInterval: number; // Sync interval in minutes
  excludeAllDayReminders: boolean;
  defaultTaskType: string; // Default task type for imported reminders
  importNotesAsDescription: boolean;
  preservePriority: boolean;
}

// Apple Calendar integration interfaces
export interface AppleCalendarIntegrationSettings {
  enabled: boolean;
  username: string; // Apple ID for iCloud Calendar
  appSpecificPassword: string; // App-specific password for CalDAV
  selectedCalendars: string[]; // Array of calendar names to include
  includeAllDayEvents: boolean;
  includeBusyEvents: boolean;
  includeFreeEvents: boolean;
  daysAhead: number; // Number of days to look ahead for events
  daysBehind: number; // Number of days to look back for events
  includeLocation: boolean;
  includeNotes: boolean;
  timeFormat: "12h" | "24h";
  defaultArea: string; // Default area for imported calendar events
  // Day view configuration
  startHour: number; // Start hour for day view (0-23)
  endHour: number; // End hour for day view (1-24)
  timeIncrement: number; // Time increment in minutes (15, 30, 60)
  // Task scheduling configuration
  schedulingEnabled: boolean; // Whether task scheduling is enabled
  defaultSchedulingCalendar: string; // Default calendar for scheduling tasks
  defaultEventDuration: number; // Default event duration in minutes
  defaultReminders: number[]; // Default reminders (in minutes before event)
  includeTaskDetailsInEvent: boolean; // Whether to include task details in event description
}

export interface TaskSyncSettings {
  tasksFolder: string;
  projectsFolder: string;
  areasFolder: string;
  templateFolder: string;
  dailyNotesFolder: string;
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
  // Apple Reminders integration settings
  appleRemindersIntegration: AppleRemindersIntegrationSettings;
  // Apple Calendar integration settings
  appleCalendarIntegration: AppleCalendarIntegrationSettings;
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
