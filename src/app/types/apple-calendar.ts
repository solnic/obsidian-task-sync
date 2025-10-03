/**
 * Apple Calendar Integration Types
 * Defines interfaces for Apple Calendar data structures and configuration
 */

/**
 * Apple Calendar configuration interface
 * Extends the base TaskSyncConfig with Apple Calendar specific options
 */
export interface AppleCalendarConfig {
  /** Whether Apple Calendar integration is enabled */
  enabled: boolean;

  /** Specific calendars to include (empty array means all calendars) */
  selectedCalendars: string[];

  /** Whether to include all-day events */
  includeAllDayEvents: boolean;

  /** Whether to include events marked as busy */
  includeBusyEvents: boolean;

  /** Whether to include events marked as free */
  includeFreeEvents: boolean;

  /** Number of days to look ahead for events */
  daysAhead: number;

  /** Number of days to look back for events */
  daysBehind: number;

  /** Whether to include event location in output */
  includeLocation: boolean;

  /** Whether to include event notes in output */
  includeNotes: boolean;

  /** Format for event time display */
  timeFormat: "12h" | "24h";
}

/**
 * Apple Calendar interface
 * Represents a calendar from Apple Calendar app
 */
export interface AppleCalendar {
  /** Unique identifier for the calendar */
  id: string;

  /** Display name of the calendar */
  name: string;

  /** Description of the calendar */
  description?: string;

  /** Color of the calendar (hex color code) */
  color?: string;

  /** Whether the calendar is currently visible */
  visible: boolean;

  /** Account name this calendar belongs to */
  account?: string;

  /** Calendar type (local, iCloud, Exchange, etc.) */
  type?: string;
}

/**
 * Apple Calendar Event interface
 * Represents a single event from Apple Calendar
 */
export interface AppleCalendarEvent {
  /** Unique identifier for the event */
  id: string;

  /** Title/summary of the event */
  title: string;

  /** Event description/notes */
  description?: string;

  /** Event location */
  location?: string;

  /** Start date and time */
  startDate: Date;

  /** End date and time */
  endDate: Date;

  /** Whether this is an all-day event */
  allDay: boolean;

  /** Event status (confirmed, tentative, cancelled) */
  status: "confirmed" | "tentative" | "cancelled";

  /** Event availability (busy, free) */
  availability: "busy" | "free";

  /** The calendar this event belongs to */
  calendar: AppleCalendar;

  /** Event URL (if available) */
  url?: string;

  /** Attendees list */
  attendees?: AppleCalendarAttendee[];

  /** Organizer information */
  organizer?: AppleCalendarAttendee;

  /** Recurrence rule (if recurring event) */
  recurrenceRule?: string;

  /** Creation date */
  creationDate?: Date;

  /** Last modification date */
  modificationDate?: Date;
}

/**
 * Apple Calendar Attendee interface
 * Represents an attendee of a calendar event
 */
export interface AppleCalendarAttendee {
  /** Attendee name */
  name?: string;

  /** Attendee email */
  email: string;

  /** Attendance status */
  status: "accepted" | "declined" | "tentative" | "pending";

  /** Whether this attendee is the organizer */
  isOrganizer?: boolean;
}

/**
 * Apple Calendar service error types
 * Specific error types that can occur when working with Apple Calendar
 */
export enum AppleCalendarError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  CALENDAR_APP_UNAVAILABLE = "CALENDAR_APP_UNAVAILABLE",
  PLATFORM_NOT_SUPPORTED = "PLATFORM_NOT_SUPPORTED",
  CALENDAR_NOT_FOUND = "CALENDAR_NOT_FOUND",
  EVENT_NOT_FOUND = "EVENT_NOT_FOUND",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN"
}

/**
 * Apple Calendar service result interface
 * Wraps results from Apple Calendar operations with error handling
 */
export interface AppleCalendarResult<T> {
  /** Whether the operation was successful */
  success: boolean;

  /** The result data (if successful) */
  data?: T;

  /** Error information (if failed) */
  error?: {
    type: AppleCalendarError;
    message: string;
    originalError?: any;
  };
}

/**
 * Apple Calendar filter options
 * Options for filtering events during fetch operations
 */
export interface AppleCalendarFilter {
  /** Include all-day events */
  includeAllDay?: boolean;

  /** Include only specific calendars */
  calendarNames?: string[];

  /** Date range for events */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Event status filter */
  statusFilter?: ("confirmed" | "tentative" | "cancelled")[];

  /** Availability filter */
  availabilityFilter?: ("busy" | "free")[];

  /** Search text in event title or description */
  searchText?: string;
}

/**
 * Calendar event formatting options
 * Options for formatting calendar events when inserting into notes
 */
export interface CalendarEventFormatOptions {
  /** Whether to include time in the output */
  includeTime: boolean;

  /** Whether to include location */
  includeLocation: boolean;

  /** Whether to include description/notes */
  includeDescription: boolean;

  /** Time format preference */
  timeFormat: "12h" | "24h";

  /** Whether to group events by calendar */
  groupByCalendar: boolean;

  /** Whether to show calendar name for each event */
  showCalendarName: boolean;

  /** Custom date format string */
  dateFormat?: string;
}
