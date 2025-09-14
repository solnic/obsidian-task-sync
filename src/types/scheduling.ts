/**
 * Abstract Scheduling Integration Types
 * Defines interfaces for external scheduling services that can create events from tasks
 */

import { Task } from "./entities";
import { CalendarEvent, Calendar } from "./calendar";

/**
 * Configuration for scheduling a task as an external event
 */
export interface TaskSchedulingConfig {
  /** Target calendar for the scheduled event */
  targetCalendar?: string;

  /** Start date and time for the event */
  startDate: Date;

  /** End date and time for the event (optional, defaults to 1 hour after start) */
  endDate?: Date;

  /** Whether this should be an all-day event */
  allDay?: boolean;

  /** Location for the event */
  location?: string;

  /** Additional notes/description for the event */
  notes?: string;

  /** Whether to include task details in event description */
  includeTaskDetails?: boolean;

  /** Reminder settings (in minutes before event) */
  reminders?: number[];
}

/**
 * Result of scheduling a task
 */
export interface TaskSchedulingResult {
  /** Whether the scheduling was successful */
  success: boolean;

  /** The created calendar event (if successful) */
  event?: CalendarEvent;

  /** Error message (if failed) */
  error?: string;

  /** External event ID for tracking */
  externalEventId?: string;

  /** URL to the created event */
  eventUrl?: string;
}

/**
 * Metadata about a scheduled task
 * Used to track the relationship between tasks and calendar events
 */
export interface ScheduledTaskMetadata {
  /** Task file path */
  taskPath: string;

  /** Task title */
  taskTitle: string;

  /** External event ID */
  externalEventId: string;

  /** Calendar service name */
  calendarService: string;

  /** Target calendar ID/name */
  targetCalendar: string;

  /** When the task was scheduled */
  scheduledAt: Date;

  /** Event start date */
  eventStartDate: Date;

  /** Event end date */
  eventEndDate: Date;

  /** Whether it's an all-day event */
  allDay: boolean;

  /** External event URL */
  eventUrl?: string;

  /** Scheduling configuration used */
  schedulingConfig?: TaskSchedulingConfig;
}

/**
 * Abstract interface for external scheduling services
 * Services that can create calendar events from tasks should implement this
 */
export interface SchedulingService {
  /** Service name/identifier */
  readonly serviceName: string;

  /** Whether this service is supported on the current platform */
  isPlatformSupported(): boolean;

  /** Whether this service is currently enabled */
  isEnabled(): boolean;

  /** Get available calendars for scheduling */
  getAvailableCalendars(): Promise<Calendar[]>;

  /** Schedule a task as a calendar event */
  scheduleTask(
    task: Task,
    config: TaskSchedulingConfig
  ): Promise<TaskSchedulingResult>;

  /** Update an existing scheduled event */
  updateScheduledEvent(
    externalEventId: string,
    config: TaskSchedulingConfig
  ): Promise<TaskSchedulingResult>;

  /** Cancel/delete a scheduled event */
  cancelScheduledEvent(externalEventId: string): Promise<boolean>;

  /** Check if a task is already scheduled */
  isTaskScheduled(taskPath: string): Promise<boolean>;

  /** Get scheduling metadata for a task */
  getSchedulingMetadata(taskPath: string): Promise<ScheduledTaskMetadata | null>;

  /** Clear any cached scheduling data */
  clearSchedulingCache(): Promise<void>;
}

/**
 * Configuration for the scheduling system
 */
export interface SchedulingIntegrationConfig {
  /** Whether scheduling integration is enabled */
  enabled: boolean;

  /** Default scheduling service to use */
  defaultService?: string;

  /** Default calendar for scheduling tasks */
  defaultCalendar?: string;

  /** Default event duration in minutes */
  defaultDuration?: number;

  /** Default reminders (in minutes before event) */
  defaultReminders?: number[];

  /** Whether to include task details in event description by default */
  includeTaskDetailsByDefault?: boolean;

  /** Service-specific configurations */
  serviceConfigs: Record<string, any>;
}
