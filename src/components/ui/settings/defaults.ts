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
    orgRepoMappings: [],
  },
  // Apple Reminders integration defaults
  appleRemindersIntegration: {
    enabled: false,
    includeCompletedReminders: false,
    reminderLists: [], // Empty array means sync all lists
    syncInterval: 60, // 60 minutes
    excludeAllDayReminders: false,
    defaultTaskType: "Task",
    importNotesAsDescription: true,
    preservePriority: true,
  },
  // Apple Calendar integration defaults
  appleCalendarIntegration: {
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
