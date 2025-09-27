/**
 * Settings types for the Task Sync plugin
 * Comprehensive settings including all integrations and task configuration
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

// Organization/Repository mapping configuration
export interface GitHubOrgRepoMapping {
  /** Organization name (e.g., 'microsoft') */
  organization?: string;
  /** Repository name in format 'owner/repo' (e.g., 'microsoft/vscode') */
  repository?: string;
  /** Target area to assign to imported tasks */
  targetArea?: string;
  /** Target project to assign to imported tasks */
  targetProject?: string;
  /** Priority of this mapping (higher numbers take precedence) */
  priority?: number;
}

export interface GitHubIntegrationSettings {
  enabled: boolean;
  personalAccessToken: string;
  repositories: string[]; // Array of 'owner/repo' strings
  defaultRepository: string; // Default 'owner/repo' string
  issueFilters: GitHubIssueFilters;
  labelTypeMapping: Record<string, string>; // Map GitHub labels to task types
  orgRepoMappings: GitHubOrgRepoMapping[]; // Map organizations/repositories to areas/projects
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
  zoomLevel: number; // Zoom level for day view (0-3)
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
  // Integrations
  integrations: {
    github: GitHubIntegrationSettings;
    appleReminders: AppleRemindersIntegrationSettings;
    appleCalendar: AppleCalendarIntegrationSettings;
  };
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface SettingsSection {
  id: string;
  title: string;
  description?: string;
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

// Default folder and template configurations
const DEFAULT_FOLDER_SETTINGS = {
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
} as const;

// Default base-related configurations
const DEFAULT_BASE_SETTINGS = {
  basesFolder: "Bases",
  tasksBaseFile: "Tasks.base",
  autoGenerateBases: true,
  autoUpdateBaseViews: true,
  areaBasesEnabled: true,
  projectBasesEnabled: true,
  autoSyncAreaProjectBases: true,
} as const;

// Default task type configurations
const DEFAULT_TASK_TYPES: TaskType[] = [
  { name: "Task", color: "blue" },
  { name: "Bug", color: "red" },
  { name: "Feature", color: "green" },
  { name: "Improvement", color: "purple" },
  { name: "Chore", color: "gray" },
];

// Default task priority configurations
const DEFAULT_TASK_PRIORITIES: TaskPriority[] = [
  { name: "Low", color: "green" },
  { name: "Medium", color: "yellow" },
  { name: "High", color: "orange" },
  { name: "Urgent", color: "red" },
];

// Default task status configurations
const DEFAULT_TASK_STATUSES: TaskStatus[] = [
  { name: "Backlog", color: "gray", isDone: false, isInProgress: false },
  { name: "In Progress", color: "blue", isDone: false, isInProgress: true },
  { name: "Done", color: "green", isDone: true, isInProgress: false },
];

// Default task property ordering
const DEFAULT_TASK_PROPERTY_ORDER = [
  "title",
  "status",
  "priority",
  "type",
  "area",
  "project",
  "due",
  "created",
  "updated",
] as const;

// Default GitHub integration settings
const DEFAULT_GITHUB_SETTINGS: GitHubIntegrationSettings = {
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
  orgRepoMappings: [],
};

// Default Apple Reminders integration settings
const DEFAULT_APPLE_REMINDERS_SETTINGS: AppleRemindersIntegrationSettings = {
  enabled: false,
  includeCompletedReminders: false,
  reminderLists: [], // Empty array means sync all lists
  syncInterval: 60, // 60 minutes
  excludeAllDayReminders: false,
  defaultTaskType: "Task",
  importNotesAsDescription: true,
  preservePriority: true,
};

// Default Apple Calendar integration settings
const DEFAULT_APPLE_CALENDAR_SETTINGS: AppleCalendarIntegrationSettings = {
  enabled: false,
  username: "", // Apple ID
  appSpecificPassword: "", // App-specific password
  selectedCalendars: [], // Empty array means include all calendars
  includeAllDayEvents: true,
  includeBusyEvents: true,
  includeFreeEvents: false,
  daysAhead: 1, // Look ahead 1 day
  daysBehind: 0, // Don't look back
  includeLocation: true,
  includeNotes: false,
  timeFormat: "24h" as const,
  defaultArea: "", // Default area for imported calendar events
  // Day view configuration defaults
  startHour: 8, // Start at 8 AM
  endHour: 18, // End at 6 PM
  timeIncrement: 15, // 15-minute increments
  zoomLevel: 1, // Default zoom level (second level)
  // Task scheduling defaults
  schedulingEnabled: false, // Disabled by default
  defaultSchedulingCalendar: "", // No default calendar
  defaultEventDuration: 60, // 1 hour default duration
  defaultReminders: [15], // 15 minutes before event
  includeTaskDetailsInEvent: true, // Include task details by default
};

// Composed default settings from focused configuration objects
export const DEFAULT_SETTINGS: TaskSyncSettings = {
  ...DEFAULT_FOLDER_SETTINGS,
  ...DEFAULT_BASE_SETTINGS,
  taskTypes: DEFAULT_TASK_TYPES,
  taskPriorities: DEFAULT_TASK_PRIORITIES,
  taskStatuses: DEFAULT_TASK_STATUSES,
  taskPropertyOrder: [...DEFAULT_TASK_PROPERTY_ORDER],
  integrations: {
    github: DEFAULT_GITHUB_SETTINGS,
    appleReminders: DEFAULT_APPLE_REMINDERS_SETTINGS,
    appleCalendar: DEFAULT_APPLE_CALENDAR_SETTINGS,
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
