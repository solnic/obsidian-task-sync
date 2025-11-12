/**
 * Abstract Calendar Integration Types
 * Defines interfaces that can be implemented by different calendar providers
 */

/**
 * Generic calendar interface that can be implemented by different providers
 */
export interface Calendar {
  /** Unique identifier for the calendar */
  id: string;

  /** Display name of the calendar */
  name: string;

  /** Description of the calendar */
  description?: string;

  /** Color of the calendar */
  color?: string;

  /** Whether the calendar is currently visible/enabled */
  visible: boolean;

  /** Provider name (e.g., "Apple Calendar", "Google Calendar") */
  provider?: string;

  /** Provider-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Generic calendar event interface that can be implemented by different providers
 */
export interface CalendarEvent {
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

  /** The calendar this event belongs to */
  calendar: Calendar;

  /** Event URL (if available) */
  url?: string;

  /** Provider-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Calendar event creation data
 */
export interface CalendarEventCreateData {
  /** Event title */
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
  allDay?: boolean;

  /** Target calendar ID */
  calendarId: string;

  /** Reminder settings (in minutes before event) */
  reminders?: number[];

  /** Additional provider-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Result of creating a calendar event
 */
export interface CalendarEventCreateResult {
  /** Whether the creation was successful */
  success: boolean;

  /** The created event (if successful) */
  event?: CalendarEvent;

  /** Error message (if failed) */
  error?: string;

  /** External event ID for tracking */
  externalEventId?: string;

  /** URL to the created event */
  eventUrl?: string;
}

/**
 * Calendar service interface that must be implemented by all calendar providers
 */
export interface CalendarService {
  /** Service name/identifier */
  readonly serviceName: string;

  /** Whether this service is supported on the current platform */
  isPlatformSupported(): boolean;

  /** Whether this service is currently enabled */
  isEnabled(): boolean;

  /** Get all available calendars */
  getCalendars(): Promise<Calendar[]>;

  /** Get events from specified calendars within a date range */
  getEvents(
    calendarIds: string[],
    startDate: Date,
    endDate: Date,
    options?: CalendarEventFetchOptions
  ): Promise<CalendarEvent[]>;

  /** Get events for today */
  getTodayEvents(calendarIds?: string[]): Promise<CalendarEvent[]>;

  /** Create a new calendar event */
  createEvent(
    eventData: CalendarEventCreateData
  ): Promise<CalendarEventCreateResult>;

  /** Update an existing calendar event */
  updateEvent(
    eventId: string,
    eventData: Partial<CalendarEventCreateData>
  ): Promise<CalendarEventCreateResult>;

  /** Delete a calendar event */
  deleteEvent(eventId: string): Promise<boolean>;

  /** Check if the service has necessary permissions */
  checkPermissions(): Promise<boolean>;

  /** Request permissions if needed */
  requestPermissions(): Promise<boolean>;

  /** Clear any cached data */
  clearCache(): Promise<void>;
}

/**
 * Options for fetching calendar events
 */
export interface CalendarEventFetchOptions {
  /** Include all-day events */
  includeAllDay?: boolean;

  /** Include only events with specific statuses */
  statusFilter?: string[];

  /** Search text in event title or description */
  searchText?: string;

  /** Maximum number of events to return */
  limit?: number;

  /** Additional provider-specific options */
  providerOptions?: Record<string, any>;
}

/**
 * Calendar event formatting interface
 */
export interface CalendarEventFormatter {
  /** Format a single event for display */
  formatEvent(
    event: CalendarEvent,
    options?: CalendarEventFormatOptions
  ): string;

  /** Format multiple events for display */
  formatEvents(
    events: CalendarEvent[],
    options?: CalendarEventFormatOptions
  ): string;

  /** Format events grouped by calendar */
  formatEventsByCalendar(
    events: CalendarEvent[],
    options?: CalendarEventFormatOptions
  ): string;
}

/**
 * Calendar event formatting options
 */
export interface CalendarEventFormatOptions {
  /** Whether to include time in the output */
  includeTime?: boolean;

  /** Whether to include location */
  includeLocation?: boolean;

  /** Whether to include description/notes */
  includeDescription?: boolean;

  /** Time format preference */
  timeFormat?: "12h" | "24h";

  /** Whether to group events by calendar */
  groupByCalendar?: boolean;

  /** Whether to show calendar name for each event */
  showCalendarName?: boolean;

  /** Custom date format string */
  dateFormat?: string;

  /** Markdown formatting options */
  markdown?: {
    /** Use bullet points for events */
    useBullets?: boolean;

    /** Use checkboxes for events */
    useCheckboxes?: boolean;

    /** Header level for calendar names (when grouping) */
    calendarHeaderLevel?: number;
  };
}

/**
 * Calendar integration configuration
 */
export interface CalendarIntegrationConfig {
  /** Whether calendar integration is enabled */
  enabled: boolean;

  /** Default calendar service to use */
  defaultService?: string;

  /** Service-specific configurations */
  serviceConfigs: Record<string, any>;

  /** Default formatting options */
  defaultFormatOptions: CalendarEventFormatOptions;
}
