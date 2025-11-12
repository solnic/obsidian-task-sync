/**
 * Google Calendar Service
 * Handles integration with Google Calendar using Google Calendar API v3
 * Implements the CalendarService interface for the new architecture
 */

import { Plugin, requestUrl } from "obsidian";
import { SchemaCache } from "../../../cache/SchemaCache";
import {
  GoogleCalendarsSchema,
  GoogleCalendarEventsSchema,
  GoogleCalendars,
  GoogleCalendarEvents,
  GoogleCalendar as GoogleCalendarType,
} from "../../../cache/schemas/google-calendar";
import {
  Calendar,
  CalendarEvent,
  CalendarEventFetchOptions,
  CalendarEventCreateData,
  CalendarEventCreateResult,
} from "../../../types/calendar";
import { CalendarService } from "./CalendarService";
import type { TaskSyncSettings } from "../../../types/settings";
import { GoogleOAuthService } from "../../../utils/oauth/GoogleOAuthService";

// Google Calendar API response types
interface GoogleCalendarListResponse {
  items?: Array<{
    id: string;
    summary?: string;
    description?: string;
    backgroundColor?: string;
    foregroundColor?: string;
    timeZone?: string;
    primary?: boolean;
    accessRole?: string;
  }>;
}

interface GoogleCalendarEventDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

interface GoogleCalendarEventItem {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  htmlLink?: string;
  created?: string;
  updated?: string;
  status?: string;
  visibility?: string;
  organizer?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEventItem[];
}

interface GoogleCalendarApiRequestBody {
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleCalendarEventDateTime;
  end?: GoogleCalendarEventDateTime;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

export class GoogleCalendarService implements CalendarService {
  readonly serviceName = "google-calendar";

  private plugin: Plugin;
  private settings: TaskSyncSettings;
  private calendarsCache?: SchemaCache<GoogleCalendars>;
  private eventsCache?: SchemaCache<GoogleCalendarEvents>;
  private baseUrl: string = "https://www.googleapis.com/calendar/v3";
  private oauthService?: GoogleOAuthService;
  private saveSettings: () => Promise<void>;
  private tokenRefreshPromise: Promise<string | null> | null = null; // Prevent concurrent refreshes

  // Track pending requests to prevent duplicate concurrent fetches
  private pendingEventRequests: Map<string, Promise<CalendarEvent[]>> = new Map();  constructor(
    settings: TaskSyncSettings,
    plugin: Plugin,
    saveSettings: () => Promise<void>
  ) {
    this.settings = settings;
    this.plugin = plugin;
    this.saveSettings = saveSettings;
    this.oauthService = new GoogleOAuthService(settings, saveSettings);
  }

  /**
   * Setup Google Calendar-specific caches
   */
  private async setupCaches(): Promise<void> {
    this.calendarsCache = new SchemaCache(
      this.plugin,
      "google-calendars",
      GoogleCalendarsSchema
    );
    this.eventsCache = new SchemaCache(
      this.plugin,
      "google-calendar-events",
      GoogleCalendarEventsSchema
    );
  }

  /**
   * Preload Google Calendar caches from persistent storage
   */
  private async preloadCaches(): Promise<void> {
    const caches = [this.calendarsCache, this.eventsCache];

    await Promise.all(
      caches.map(async (cache) => {
        if (cache) {
          await cache.preloadFromStorage();
        }
      })
    );
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.setupCaches();
  }

  /**
   * Load the service - preload caches from persistent storage
   * Should be called after initialize() during the load phase
   */
  async load(): Promise<void> {
    await this.preloadCaches();
  }

  /**
   * Check if Google Calendar integration is enabled
   */
  isEnabled(): boolean {
    return this.settings.integrations.googleCalendar?.enabled ?? false;
  }

  /**
   * Check if the current platform supports Google Calendar integration
   * Google Calendar API works on all platforms
   */
  isPlatformSupported(): boolean {
    return true;
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    // Clean up any resources if needed
  }

  /**
   * Clear all Google Calendar caches
   */
  async clearCache(): Promise<void> {
    if (this.calendarsCache) {
      await this.calendarsCache.clear();
    }
    if (this.eventsCache) {
      await this.eventsCache.clear();
    }
    this.pendingEventRequests.clear();
  }

  /**
   * Generate a cache key for event requests
   * Normalizes dates to day-level to ensure same-day requests hit the cache
   */
  private getEventCacheKey(startDate: Date, endDate: Date): string {
    // Normalize dates to day-level (YYYY-MM-DD) to avoid cache misses due to time precision
    const startDay = startDate.toISOString().split('T')[0];
    const endDay = endDate.toISOString().split('T')[0];
    return `events-${startDay}-${endDay}`;
  }

  /**
   * Get access token for Google Calendar API
   * Automatically refreshes token if expired
   */
  private async getAccessToken(): Promise<string | null> {
    const config = this.settings.integrations.googleCalendar;
    if (!config?.accessToken) {
      console.warn("[GoogleCalendar] No access token configured");
      return null;
    }

    // Check if token is expired and refresh if needed
    if (this.oauthService && this.oauthService.isTokenExpired()) {
      // If a refresh is already in progress, wait for it
      if (this.tokenRefreshPromise) {
        console.log("[GoogleCalendar] Token refresh already in progress, waiting...");
        return this.tokenRefreshPromise;
      }

      // Start a new refresh
      this.tokenRefreshPromise = (async () => {
        try {
          console.log("[GoogleCalendar] Access token expired, refreshing...");
          const tokens = await this.oauthService!.refreshAccessToken();

          // Save the new tokens and expiry
          await this.oauthService!.saveTokens(tokens);
          console.log("[GoogleCalendar] Access token refreshed and saved successfully");

          return tokens.accessToken;
        } catch (error) {
          console.error("[GoogleCalendar] Failed to refresh access token:", error);
          return null;
        } finally {
          // Clear the promise so future calls can refresh again if needed
          this.tokenRefreshPromise = null;
        }
      })();

      return this.tokenRefreshPromise;
    }

    return config.accessToken;
  }

  /**
   * Make a request to Google Calendar API
   */
  private async makeGoogleCalendarRequest(
    endpoint: string,
    method: string = "GET",
    body?: GoogleCalendarApiRequestBody
  ): Promise<any> {
    console.log(`[GoogleCalendar] API Request: ${method} ${endpoint}`);

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error(
        "Google Calendar access token not configured or expired. Please re-authenticate in Settings."
      );
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await requestUrl({
        url,
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        throw: false,
      });

      if (response.status >= 400) {
        console.error(`[GoogleCalendar] API Error: ${response.status} for ${method} ${endpoint}`);
        throw new Error(
          `Google Calendar API request failed: ${response.status} ${response.text}`
        );
      }

      console.log(`[GoogleCalendar] API Success: ${method} ${endpoint}`);
      return response.json;
    } catch (error: any) {
      console.error(`[GoogleCalendar] API request error for ${method} ${endpoint}:`, error);
      throw new Error(`Google Calendar API request failed: ${error.message}`);
    }
  }

  /**
   * Get all available calendars
   * Checks cache first, only fetches from API if cache is empty
   */
  async getCalendars(): Promise<Calendar[]> {
    // Check cache first
    if (this.calendarsCache) {
      const cached = await this.calendarsCache.get("calendars");
      if (cached && cached.length > 0) {
        console.log(`[GoogleCalendar] Using ${cached.length} cached calendars`);
        return cached.map(this.convertToGenericCalendar);
      }
    }

    // Cache miss - fetch from API
    console.log("[GoogleCalendar] No cached calendars, fetching from API");
    try {
      const response = await this.makeGoogleCalendarRequest("/users/me/calendarList") as GoogleCalendarListResponse;

      if (!response.items) {
        console.log("[GoogleCalendar] No calendars returned from API");
        return [];
      }

      const googleCalendars: GoogleCalendarType[] = response.items.map(
        (item) => ({
          id: item.id,
          name: item.summary || item.id,
          description: item.description,
          backgroundColor: item.backgroundColor,
          foregroundColor: item.foregroundColor,
          timeZone: item.timeZone,
          summary: item.summary,
          primary: item.primary,
          accessRole: item.accessRole,
        })
      );

      console.log(`[GoogleCalendar] Fetched ${googleCalendars.length} calendars, caching...`);

      // Cache the results
      if (this.calendarsCache) {
        await this.calendarsCache.set("calendars", googleCalendars);
      }

      return googleCalendars.map(this.convertToGenericCalendar);
    } catch (error: any) {
      console.error("[GoogleCalendar] Failed to fetch calendars:", error);
      throw new Error(`Failed to fetch Google calendars: ${error.message}`);
    }
  }

  /**
   * Get events from specified calendars within a date range
   */
  async getEvents(
    calendarIds: string[],
    startDate: Date,
    endDate: Date,
    _options?: CalendarEventFetchOptions
  ): Promise<CalendarEvent[]> {
    // Log with stack trace to identify caller
    const stack = new Error().stack?.split('\n').slice(2, 4).join('\n') || 'unknown';
    console.log(`[GoogleCalendar] getEvents called for ${calendarIds.length || 'all'} calendars from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`[GoogleCalendar] Call stack: ${stack}`);

    // Generate cache key based on date range only
    const cacheKey = this.getEventCacheKey(startDate, endDate);
    console.log(`[GoogleCalendar] Cache key: ${cacheKey}`);

    // Check persistent cache FIRST before doing any other work
    if (this.eventsCache) {
      const cachedEvents = await this.eventsCache.get(cacheKey);
      if (cachedEvents && cachedEvents.length > 0) {
        console.log(`[GoogleCalendar] ✓ Using cached events (${cachedEvents.length} events from persistent cache)`);
        // Get calendars only when we need them for cached events
        const calendars = await this.getCalendars();
        const calendarMap = new Map(calendars.map(cal => [cal.id, cal]));

        return cachedEvents.map(event => {
          const calendar = calendarMap.get(event.calendar.id);
          return this.parseGoogleCalendarEvent({
            id: event.id,
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: event.start,
            end: event.end,
            htmlLink: event.htmlLink,
            status: event.status,
            visibility: event.visibility,
            organizer: event.organizer,
            attendees: event.attendees,
            reminders: event.reminders,
          }, calendar || this.convertToGenericCalendar(event.calendar));
        });
      }
      console.log(`[GoogleCalendar] ✗ No cached events found`);
    }

    // Cache miss - need to fetch from API
    // Get access token and calendars
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("Google Calendar access token not configured or expired");
    }

    // Get calendars from cache if available to avoid redundant API calls
    const calendars = await this.getCalendars();
    const targetCalendarIds =
      calendarIds.length > 0
        ? calendarIds
        : calendars.map((cal) => cal.id);

    // Check if there's already a pending request for this data
    const pendingRequest = this.pendingEventRequests.get(cacheKey);
    if (pendingRequest) {
      console.log(`[GoogleCalendar] Request already in progress, waiting for result...`);
      return pendingRequest;
    }

    // Create new request promise
    const requestPromise = (async () => {
      try {
        console.log(`[GoogleCalendar] Fetching events from ${targetCalendarIds.length} calendars`);
        const allEvents: CalendarEvent[] = [];

        for (const calendarId of targetCalendarIds) {
          try {
            const events = await this.fetchCalendarEvents(
              calendarId,
              startDate,
              endDate
            );
            allEvents.push(...events);
          } catch (error) {
            console.error(
              `[GoogleCalendar] Failed to fetch events from calendar ${calendarId}:`,
              error
            );
            // Continue with other calendars
          }
        }

        console.log(`[GoogleCalendar] Fetched total of ${allEvents.length} events`);

        // Cache the results in persistent storage
        if (this.eventsCache && allEvents.length > 0) {
          // Convert to schema format for caching
          const eventsToCache = allEvents.map(event => ({
            id: event.id,
            summary: event.title,
            description: event.description,
            location: event.location,
            start: {
              dateTime: event.allDay ? undefined : event.startDate.toISOString(),
              date: event.allDay ? event.startDate.toISOString().split('T')[0] : undefined,
            },
            end: {
              dateTime: event.allDay ? undefined : event.endDate.toISOString(),
              date: event.allDay ? event.endDate.toISOString().split('T')[0] : undefined,
            },
            calendar: {
              id: event.calendar.id,
              name: event.calendar.name,
              description: event.calendar.description,
              backgroundColor: event.calendar.color,
              foregroundColor: event.calendar.metadata?.foregroundColor,
              timeZone: event.calendar.metadata?.timeZone,
              primary: event.calendar.metadata?.primary,
              accessRole: event.calendar.metadata?.accessRole,
            },
            htmlLink: event.url,
            status: event.metadata?.status,
            visibility: event.metadata?.visibility,
            organizer: event.metadata?.organizer,
            attendees: event.metadata?.attendees,
            reminders: event.metadata?.reminders,
          }));

          await this.eventsCache.set(cacheKey, eventsToCache);
          console.log(`[GoogleCalendar] ✓ Cached ${allEvents.length} events to persistent storage with key: ${cacheKey}`);
        }

        return allEvents;
      } finally {
        // Remove from pending requests
        this.pendingEventRequests.delete(cacheKey);
      }
    })();

    // Track pending request
    this.pendingEventRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Fetch events from a specific calendar
   */
  private async fetchCalendarEvents(
    calendarId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    const endpoint = `/calendars/${encodeURIComponent(
      calendarId
    )}/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

    const response = await this.makeGoogleCalendarRequest(endpoint) as GoogleCalendarEventsResponse;

    if (!response.items) {
      console.log(`[GoogleCalendar] No events found for calendar ${calendarId}`);
      return [];
    }

    // Get calendar details from cache to avoid redundant API calls
    const calendars = await this.getCalendars();
    const calendar = calendars.find((cal: Calendar) => cal.id === calendarId);

    if (!calendar) {
      console.warn(`[GoogleCalendar] Calendar ${calendarId} not found in cache`);
      return [];
    }

    const events: CalendarEvent[] = response.items
      .map((item) => {
        try {
          return this.parseGoogleCalendarEvent(item, calendar);
        } catch (error) {
          console.error(`[GoogleCalendar] Failed to parse event:`, error, item);
          return null;
        }
      })
      .filter((event: CalendarEvent | null) => event !== null) as CalendarEvent[];

    console.log(`[GoogleCalendar] Parsed ${events.length} events from calendar ${calendarId}`);
    return events;
  }

  /**
   * Parse a Google Calendar event from the API response
   */
  private parseGoogleCalendarEvent(
    item: GoogleCalendarEventItem,
    calendar: Calendar
  ): CalendarEvent {
    // Determine if it's an all-day event
    const allDay = !!item.start.date && !item.start.dateTime;

    // Parse start and end dates
    let startDate: Date;
    let endDate: Date;

    if (allDay) {
      // For all-day events, use the date field
      startDate = new Date(item.start.date);
      endDate = new Date(item.end.date);
    } else {
      // For timed events, use the dateTime field
      startDate = new Date(item.start.dateTime);
      endDate = new Date(item.end.dateTime);
    }

    return {
      id: item.id,
      title: item.summary || "Untitled Event",
      description: item.description || "",
      location: item.location || "",
      startDate,
      endDate,
      allDay,
      calendar,
      url: item.htmlLink,
      metadata: {
        status: item.status,
        visibility: item.visibility,
        organizer: item.organizer,
        attendees: item.attendees,
        reminders: item.reminders,
      },
    };
  }

  /**
   * Get events for today
   */
  async getTodayEvents(calendarIds?: string[]): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    return this.getEvents(calendarIds || [], startOfDay, endOfDay);
  }

  /**
   * Check if the service has necessary permissions
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return false;
      }

      // Try to fetch calendars to test permissions
      await this.getCalendars();
      return true;
    } catch (error) {
      console.error("Google Calendar permission check failed:", error);
      return false;
    }
  }

  /**
   * Request permissions if needed
   */
  async requestPermissions(): Promise<boolean> {
    // OAuth flow should be handled in the settings UI
    // This method just checks if we have valid credentials
    return this.checkPermissions();
  }

  /**
   * Get the OAuth service instance
   */
  getOAuthService(): GoogleOAuthService | undefined {
    return this.oauthService;
  }

  /**
   * Update settings and OAuth service
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
    if (this.oauthService) {
      this.oauthService.updateConfig();
    }
  }

  /**
   * Convert Google Calendar to generic Calendar interface
   */
  private convertToGenericCalendar(calendar: GoogleCalendarType): Calendar {
    return {
      id: calendar.id,
      name: calendar.name,
      description: calendar.description,
      color: calendar.backgroundColor,
      visible: true,
      provider: "Google Calendar",
      metadata: {
        foregroundColor: calendar.foregroundColor,
        timeZone: calendar.timeZone,
        primary: calendar.primary,
        accessRole: calendar.accessRole,
        provider: "google",
      },
    };
  }

  /**
   * Create a new calendar event
   */
  async createEvent(
    eventData: CalendarEventCreateData
  ): Promise<CalendarEventCreateResult> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        error: "Google Calendar access token not configured or expired",
      };
    }

    try {
      const eventBody: GoogleCalendarApiRequestBody = {
        summary: eventData.title,
        description: eventData.description,
        location: eventData.location,
      };

      // Set start and end times
      if (eventData.allDay) {
        // For all-day events, use date format (YYYY-MM-DD)
        const formatDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        eventBody.start = { date: formatDate(eventData.startDate) };
        eventBody.end = { date: formatDate(eventData.endDate) };
      } else {
        // For timed events, use dateTime format (RFC3339)
        eventBody.start = { dateTime: eventData.startDate.toISOString() };
        eventBody.end = { dateTime: eventData.endDate.toISOString() };
      }

      // Add reminders if specified
      if (eventData.reminders && eventData.reminders.length > 0) {
        eventBody.reminders = {
          useDefault: false,
          overrides: eventData.reminders.map((minutes) => ({
            method: "popup",
            minutes,
          })),
        };
      }

      const endpoint = `/calendars/${encodeURIComponent(
        eventData.calendarId
      )}/events`;
      const response = await this.makeGoogleCalendarRequest(
        endpoint,
        "POST",
        eventBody
      );

      // Get calendar details from cache
      const calendars = await this.getCalendars();
      const calendar = calendars.find(
        (cal) => cal.id === eventData.calendarId
      );

      if (!calendar) {
        return {
          success: false,
          error: `Calendar not found: ${eventData.calendarId}`,
        };
      }

      const createdEvent = this.parseGoogleCalendarEvent(response, calendar);

      return {
        success: true,
        event: createdEvent,
        externalEventId: response.id,
        eventUrl: response.htmlLink,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to create event: ${error.message}`,
      };
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    eventId: string,
    eventData: Partial<CalendarEventCreateData>
  ): Promise<CalendarEventCreateResult> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        error: "Google Calendar access token not configured or expired",
      };
    }

    try {
      if (!eventData.calendarId) {
        return {
          success: false,
          error: "Calendar ID is required for updating an event",
        };
      }

      const eventBody: GoogleCalendarApiRequestBody = {};

      if (eventData.title) {
        eventBody.summary = eventData.title;
      }
      if (eventData.description !== undefined) {
        eventBody.description = eventData.description;
      }
      if (eventData.location !== undefined) {
        eventBody.location = eventData.location;
      }

      // Set start and end times if provided
      if (eventData.startDate && eventData.endDate) {
        if (eventData.allDay) {
          const formatDate = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
          };

          eventBody.start = { date: formatDate(eventData.startDate) };
          eventBody.end = { date: formatDate(eventData.endDate) };
        } else {
          eventBody.start = { dateTime: eventData.startDate.toISOString() };
          eventBody.end = { dateTime: eventData.endDate.toISOString() };
        }
      }

      // Add reminders if specified
      if (eventData.reminders) {
        eventBody.reminders = {
          useDefault: false,
          overrides: eventData.reminders.map((minutes) => ({
            method: "popup",
            minutes,
          })),
        };
      }

      const endpoint = `/calendars/${encodeURIComponent(
        eventData.calendarId
      )}/events/${encodeURIComponent(eventId)}`;
      const response = await this.makeGoogleCalendarRequest(
        endpoint,
        "PATCH",
        eventBody
      );

      // Get calendar details from cache
      const calendars = await this.getCalendars();
      const calendar = calendars.find(
        (cal) => cal.id === eventData.calendarId
      );

      if (!calendar) {
        return {
          success: false,
          error: `Calendar not found: ${eventData.calendarId}`,
        };
      }

      const updatedEvent = this.parseGoogleCalendarEvent(response, calendar);

      return {
        success: true,
        event: updatedEvent,
        externalEventId: response.id,
        eventUrl: response.htmlLink,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to update event: ${error.message}`,
      };
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return false;
    }

    try {
      // We need to know which calendar the event belongs to
      // For now, try all calendars until we find it
      const calendars = await this.getCalendars();

      for (const calendar of calendars) {
        try {
          const endpoint = `/calendars/${encodeURIComponent(
            calendar.id
          )}/events/${encodeURIComponent(eventId)}`;
          await this.makeGoogleCalendarRequest(endpoint, "DELETE");
          return true;
        } catch (error) {
          // Log error for debugging, then continue to next calendar
          console.debug(
            `Failed to delete event ${eventId} from calendar ${calendar.id}:`,
            error
          );
        }
      }

      return false;
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      return false;
    }
  }
}
