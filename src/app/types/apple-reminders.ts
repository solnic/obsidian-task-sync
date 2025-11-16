/**
 * Apple Reminders Integration Types
 * Defines interfaces for Apple Reminders data structures and configuration
 */

/**
 * Raw AppleScript reminder object as returned by "properties of reminder"
 * This represents the exact structure returned by AppleScript
 */
export interface AppleScriptReminder {
  /** Unique identifier string */
  id: string;

  /** Reminder title/name */
  name: string;

  /** Reminder body/notes content - AppleScript returns string or "missing value" */
  body: string;

  /** Completion status */
  completed: boolean;

  /** Completion date (if completed) - AppleScript returns string or "missing value" */
  completionDate: string | null;

  /** Creation date - AppleScript returns string like "Thursday, 29 May 2025 at 20:37:46" */
  creationDate: string;

  /** Last modification date - AppleScript returns string like "Friday, 22 August 2025 at 21:26:12" */
  modificationDate: string;

  /** Due date (if set) - AppleScript returns string or "missing value" */
  dueDate: string | null;

  /** Remind me date (if set) - AppleScript returns string or "missing value" */
  remindMeDate: string | null;

  /** Priority level (0-9) */
  priority: number;

  /** Whether this is an all-day reminder */
  allDay: boolean;
}

/**
 * Raw AppleScript list object as returned by "properties of list"
 * This represents the exact structure returned by AppleScript
 */
export interface AppleScriptList {
  /** Unique identifier string */
  id: string;

  /** List name */
  name: string;

  /** List color */
  color: string;
}

/**
 * Apple Reminders configuration interface
 * Extends the base TaskSyncConfig with Apple Reminders specific options
 */
export interface AppleRemindersConfig {
  /** Whether Apple Reminders integration is enabled */
  enabled: boolean;

  /** Whether to include completed reminders in sync */
  includeCompletedReminders: boolean;

  /** Specific reminder lists to sync (empty array means all lists) */
  reminderLists: string[];

  /** How often to sync reminders (in minutes) */
  syncInterval: number;

  /** Whether to exclude all-day reminders */
  excludeAllDayReminders: boolean;

  /** Default task type for imported reminders */
  defaultTaskType: string;

  /** Whether to import reminder notes as task descriptions */
  importNotesAsDescription: boolean;

  /** Whether to preserve reminder priority levels */
  preservePriority: boolean;
}

/**
 * Apple Reminders List interface
 * Represents a reminder list from Apple Reminders
 */
export interface AppleRemindersList {
  /** Unique identifier for the list */
  id: string;

  /** Display name of the list */
  name: string;

  /** Color of the list (if available) */
  color?: string;

  /** Number of reminders in the list */
  reminderCount?: number;
}

/**
 * Apple Reminder interface
 * Represents a single reminder from Apple Reminders
 */
export interface AppleReminder {
  /** Unique identifier for the reminder */
  id: string;

  /** Title/summary of the reminder */
  title: string;

  /** Notes/body content of the reminder */
  notes?: string;

  /** Whether the reminder is completed */
  completed: boolean;

  /** Completion date (if completed) */
  completionDate?: Date;

  /** Creation date */
  creationDate?: Date;

  /** Modification date */
  modificationDate?: Date;

  /** Due date (if set) */
  dueDate?: Date;

  /** Reminder timestamps (from "remind me date" field) */
  reminders?: Date[];

  /** Priority level (0-9, where 0 is no priority) */
  priority: number;

  /** The list this reminder belongs to */
  list: AppleRemindersList;

  /** Whether this is an all-day reminder */
  allDay?: boolean;

  /** URL for the reminder (reminder:// protocol) */
  url?: string;
}

/**
 * Apple Reminders permission states
 * Represents the various permission states for accessing reminders
 */
export enum AppleRemindersPermission {
  NOT_DETERMINED = "notDetermined",
  DENIED = "denied",
  AUTHORIZED = "authorized",
  RESTRICTED = "restricted",
}

/**
 * Apple Reminders service error types
 * Specific error types that can occur when working with Apple Reminders
 */
export enum AppleRemindersError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  REMINDERS_APP_UNAVAILABLE = "REMINDERS_APP_UNAVAILABLE",
  PLATFORM_NOT_SUPPORTED = "PLATFORM_NOT_SUPPORTED",
  LIST_NOT_FOUND = "LIST_NOT_FOUND",
  REMINDER_NOT_FOUND = "REMINDER_NOT_FOUND",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

/**
 * Apple Reminders service result interface
 * Wraps results from Apple Reminders operations with error handling
 */
export interface AppleRemindersResult<T> {
  /** Whether the operation was successful */
  success: boolean;

  /** The result data (if successful) */
  data?: T;

  /** Error information (if failed) */
  error?: {
    type: AppleRemindersError;
    message: string;
    originalError?: any;
  };
}

/**
 * Apple Reminders sync status interface
 * Tracks the status of reminder synchronization
 */
export interface AppleRemindersSyncStatus {
  /** Last successful sync timestamp */
  lastSyncTime?: Date;

  /** Number of reminders synced in last operation */
  lastSyncCount: number;

  /** Whether sync is currently in progress */
  syncInProgress: boolean;

  /** Any errors from the last sync */
  lastSyncError?: string;

  /** Lists that were synced */
  syncedLists: string[];
}

/**
 * Apple Reminders filter options
 * Options for filtering reminders during fetch operations
 */
export interface AppleRemindersFilter {
  /** Include completed reminders */
  includeCompleted?: boolean;

  /** Include only specific lists */
  listNames?: string[];

  /** Date range for due dates */
  dueDateRange?: {
    start?: Date;
    end?: Date;
  };

  /** Priority range (0-9) */
  priorityRange?: {
    min?: number;
    max?: number;
  };

  /** Exclude all-day reminders */
  excludeAllDay?: boolean;
}
