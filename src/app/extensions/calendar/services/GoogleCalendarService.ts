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
  GoogleCalendarEvent as GoogleCalendarEventType,
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
import { generateId } from "../../../utils/idGenerator";
import { GoogleOAuthService } from "../../../utils/oauth/GoogleOAuthService";

export class GoogleCalendarService implements CalendarService {
  readonly serviceName = "google-calendar";

  private plugin: Plugin;
  private settings: TaskSyncSettings;
  private calendarsCache?: SchemaCache<GoogleCalendars>;
  private eventsCache?: SchemaCache<GoogleCalendarEvents>;
  private baseUrl: string = "https://www.googleapis.com/calendar/v3";
  private oauthService?: GoogleOAuthService;
  private saveSettings: () => Promise<void>;

  constructor(
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
  }

  /**
   * Get access token for Google Calendar API
   * Automatically refreshes token if expired
   */
  private async getAccessToken(): Promise<string | null> {
    const config = this.settings.integrations.googleCalendar;
    if (!config?.accessToken) {
      return null;
    }

    // Check if token is expired and refresh if needed
    if (this.oauthService && this.oauthService.isTokenExpired()) {
      try {
        console.log("Access token expired, refreshing...");
        const tokens = await this.oauthService.refreshAccessToken();

        // Tokens are saved by the OAuth service
        console.log("Access token refreshed successfully");

        return tokens.accessToken;
      } catch (error) {
        console.error("Failed to refresh access token:", error);
        return null;
      }
    }

    return config.accessToken;
  }

  /**
   * Make a request to Google Calendar API
   */
  private async makeGoogleCalendarRequest(
    endpoint: string,
    method: string = "GET",
    body?: any
  ): Promise<any> {
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
        throw new Error(
          `Google Calendar API request failed: ${response.status} ${response.text}`
        );
      }

      return response.json;
    } catch (error: any) {
      console.error("Google Calendar API request error:", error);
      throw new Error(`Google Calendar API request failed: ${error.message}`);
    }
  }

  /**
   * Get all available calendars
   */
  async getCalendars(): Promise<Calendar[]> {
    try {
      const response = await this.makeGoogleCalendarRequest("/users/me/calendarList");

      if (!response.items) {
        return [];
      }

      const googleCalendars: GoogleCalendarType[] = response.items.map(
        (item: any) => ({
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

      // Cache the results
      if (this.calendarsCache) {
        await this.calendarsCache.set("calendars", googleCalendars);
      }

      return googleCalendars.map(this.convertToGenericCalendar);
    } catch (error: any) {
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
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error("Google Calendar access token not configured or expired");
    }

    // Get all calendars if no specific calendars are requested
    const calendars = await this.getCalendars();
    const targetCalendarIds =
      calendarIds.length > 0
        ? calendarIds
        : calendars.map((cal) => cal.id);

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
          `Failed to fetch events from calendar ${calendarId}:`,
          error
        );
        // Continue with other calendars
      }
    }

    return allEvents;
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

    const response = await this.makeGoogleCalendarRequest(endpoint);

    if (!response.items) {
      return [];
    }

    // Get calendar details for this calendar
    const calendars = await this.getCalendars();
    const calendar = calendars.find((cal) => cal.id === calendarId);

    if (!calendar) {
      return [];
    }

    const events: CalendarEvent[] = response.items
      .map((item: any) => {
        try {
          return this.parseGoogleCalendarEvent(item, calendar);
        } catch (error) {
          console.error("Failed to parse Google Calendar event:", error, item);
          return null;
        }
      })
      .filter((event: CalendarEvent | null) => event !== null) as CalendarEvent[];

    return events;
  }

  /**
   * Parse a Google Calendar event from the API response
   */
  private parseGoogleCalendarEvent(
    item: any,
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
      const eventBody: any = {
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

      // Get calendar details
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

      const eventBody: any = {};

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

      // Get calendar details
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
          // Continue to next calendar
          continue;
        }
      }

      return false;
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      return false;
    }
  }
}
