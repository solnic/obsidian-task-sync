/**
 * Settings types for the Task Sync plugin
 * Comprehensive settings including all integrations and task configuration
 */

// Task category interface with color support
export interface TaskType {
  name: string;
  color: string; // Hex color code (e.g., "#3b82f6")
}

// Task priority interface with color support
export interface TaskPriority {
  name: string;
  color: string; // Hex color code (e.g., "#ef4444")
}

// Task status interface with color support
export interface TaskStatus {
  name: string;
  color: string; // Hex color code (e.g., "#10b981")
  isDone: boolean; // Indicates if this status represents a completed/done state
  isInProgress: boolean; // Indicates if this status represents an active/in-progress state
}

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

// Default settings with comprehensive configuration
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
    { name: "Task", color: "#3b82f6" },
    { name: "Bug", color: "#ef4444" },
    { name: "Feature", color: "#10b981" },
    { name: "Improvement", color: "#8b5cf6" },
    { name: "Chore", color: "#6b7280" },
  ],
  // Task priorities defaults
  taskPriorities: [
    { name: "Low", color: "#10b981" },
    { name: "Medium", color: "#f59e0b" },
    { name: "High", color: "#f97316" },
    { name: "Urgent", color: "#ef4444" },
  ],
  // Task statuses defaults
  taskStatuses: [
    { name: "Backlog", color: "#6b7280", isDone: false, isInProgress: false },
    {
      name: "In Progress",
      color: "#3b82f6",
      isDone: false,
      isInProgress: true,
    },
    { name: "Done", color: "#10b981", isDone: true, isInProgress: false },
  ],
  // Individual area/project bases defaults
  areaBasesEnabled: true,
  projectBasesEnabled: true,
  autoSyncAreaProjectBases: true,
  // Task property ordering defaults - simplified for now
  taskPropertyOrder: [
    "title",
    "status",
    "priority",
    "type",
    "area",
    "project",
    "due",
    "created",
    "updated",
  ],
  // Integration defaults
  integrations: {
    github: {
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
    },
    appleReminders: {
      enabled: false,
      includeCompletedReminders: false,
      reminderLists: [], // Empty array means sync all lists
      syncInterval: 60, // 60 minutes
      excludeAllDayReminders: false,
      defaultTaskType: "Task",
      importNotesAsDescription: true,
      preservePriority: true,
    },
    appleCalendar: {
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
