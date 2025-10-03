/**
 * Apple Calendar Service
 * Handles integration with Apple Calendar using CalDAV via tsdav library
 * Implements the CalendarService interface for the new architecture
 */

import { Plugin, requestUrl } from "obsidian";
import { SchemaCache } from "../cache/SchemaCache";
import {
  AppleCalendarsSchema,
  AppleCalendarEventsSchema,
  AppleCalendars,
  AppleCalendarEvents,
} from "../cache/schemas/apple-calendar";
import { AppleCalendar } from "../types/apple-calendar";
import {
  Calendar,
  CalendarEvent,
  CalendarEventFetchOptions,
  CalendarEventCreateData,
  CalendarEventCreateResult,
} from "../types/calendar";
import { CalendarService } from "./CalendarService";
import type { TaskSyncSettings } from "../types/settings";
import { generateId, generatePrefixedId } from "../utils/idGenerator";
import ICAL from "ical.js";

// Simple CalDAV calendar interface
interface SimpleCalDAVCalendar {
  url: string;
  displayName: string;
  ctag: string;
  color?: string;
}

export class AppleCalendarService implements CalendarService {
  readonly serviceName = "apple-calendar";

  private plugin: Plugin;
  private settings: TaskSyncSettings;
  private calendarsCache?: SchemaCache<AppleCalendars>;
  private eventsCache?: SchemaCache<AppleCalendarEvents>;
  private baseUrl: string = "https://caldav.icloud.com";
  private credentials?: { username: string; password: string };
  private calendarHomeUrl?: string;

  constructor(settings: TaskSyncSettings, plugin: Plugin) {
    this.settings = settings;
    this.plugin = plugin;
    this.initializeCredentials();
  }

  /**
   * Initialize CalDAV credentials
   */
  private initializeCredentials(): void {
    const config = this.settings.integrations.appleCalendar;
    if (config?.enabled && config.username && config.appSpecificPassword) {
      this.credentials = {
        username: config.username,
        password: config.appSpecificPassword,
      };
    }
  }

  /**
   * Setup Apple Calendar-specific caches
   */
  private async setupCaches(): Promise<void> {
    this.calendarsCache = new SchemaCache(
      this.plugin,
      "apple-calendars",
      AppleCalendarsSchema
    );
    this.eventsCache = new SchemaCache(
      this.plugin,
      "apple-calendar-events",
      AppleCalendarEventsSchema
    );
  }

  /**
   * Preload Apple Calendar caches from persistent storage
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
   * Update settings reference
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
    this.initializeCredentials();
  }

  /**
   * Check if Apple Calendar integration is enabled
   */
  isEnabled(): boolean {
    return this.settings.integrations.appleCalendar?.enabled ?? false;
  }

  /**
   * Check if the current platform supports Apple Calendar integration
   * CalDAV works on all platforms, but we focus on iCloud Calendar
   */
  isPlatformSupported(): boolean {
    return true; // CalDAV works on all platforms
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    // Clean up any resources if needed
    this.credentials = undefined;
    this.calendarHomeUrl = undefined;
  }

  /**
   * Clear all Apple Calendar caches
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
   * Cleanup method - no longer needed
   */
  cleanup(): void {
    // No cleanup needed for custom CalDAV implementation
  }

  /**
   * Make a CalDAV request using Obsidian's requestUrl
   */
  private async makeCalDAVRequest(
    path: string,
    method: string = "GET",
    body?: string,
    headers: Record<string, string> = {}
  ): Promise<string> {
    if (!this.credentials) {
      throw new Error("CalDAV credentials not configured");
    }

    // Ensure path starts with /
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${this.baseUrl}${normalizedPath}`;

    const auth = btoa(
      `${this.credentials.username}:${this.credentials.password}`
    );

    const requestHeaders = {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/xml; charset=utf-8",
      "User-Agent": "Obsidian Task Sync Plugin/1.0",
      ...headers,
    };

    try {
      const response = await requestUrl({
        url,
        method,
        headers: requestHeaders,
        body,
        throw: false,
      });

      if (response.status >= 400) {
        throw new Error(
          `CalDAV request failed: ${response.status} ${response.text}`
        );
      }

      return response.text;
    } catch (error: any) {
      console.error("CalDAV request error:", error);
      throw new Error(`CalDAV request failed: ${error.message}`);
    }
  }

  /**
   * Discover calendar home URL for the user
   */
  private async discoverCalendarHome(): Promise<string> {
    if (this.calendarHomeUrl) {
      return this.calendarHomeUrl;
    }

    // For iCloud, try a simpler approach first
    const username = this.credentials!.username;

    // Try to extract the user ID from a well-known URL first
    try {
      // Try the well-known CalDAV URL first
      const wellKnownResponse = await this.makeCalDAVRequest(
        "/.well-known/caldav",
        "PROPFIND",
        `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`,
        { Depth: "0" }
      );

      // Extract principal URL from response - try multiple patterns
      let principalMatch = wellKnownResponse.match(
        /<current-user-principal[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/
      );

      if (!principalMatch) {
        principalMatch = wellKnownResponse.match(
          /<d:current-user-principal[^>]*>[\s\S]*?<d:href[^>]*>([^<]+)<\/d:href>/
        );
      }

      if (principalMatch) {
        const principalUrl = principalMatch[1];

        // Now get calendar home from principal
        const calendarHomeResponse = await this.makeCalDAVRequest(
          principalUrl,
          "PROPFIND",
          `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`,
          { Depth: "0" }
        );

        const calendarHomeMatch = calendarHomeResponse.match(
          /<c:calendar-home-set[^>]*>[\s\S]*?<d:href[^>]*>([^<]+)<\/d:href>/
        );

        if (calendarHomeMatch) {
          const calendarHome = calendarHomeMatch[1];
          this.calendarHomeUrl = calendarHome;
          return calendarHome;
        } else {
          // If we have a principal URL but no calendar home, construct it
          // iCloud principal URLs are like /18427300139/principal/
          // and calendar homes are like /18427300139/calendars/
          const calendarHome = principalUrl.replace(
            "/principal/",
            "/calendars/"
          );
          this.calendarHomeUrl = calendarHome;
          return calendarHome;
        }
      }
    } catch (error) {
      // Fall through to direct approach
    }

    // Fallback: try to construct the URL directly
    // iCloud typically uses a pattern like /[user-id]/calendars/
    // where user-id is often the part before @ in the email
    const userPart = username.split("@")[0];
    const directCalendarHome = `/${userPart}/calendars/`;

    this.calendarHomeUrl = directCalendarHome;
    return directCalendarHome;
  }

  /**
   * Get all available calendars
   */
  async getCalendars(): Promise<Calendar[]> {
    if (!this.credentials) {
      throw new Error("CalDAV credentials not configured");
    }

    try {
      const calendarHome = await this.discoverCalendarHome();
      const calendars = await this.fetchCalendarList(calendarHome);

      // Convert to Apple Calendar format
      const appleCalendars = calendars.map(
        this.convertFromSimpleCalDAVCalendar
      );

      // Cache the results
      if (this.calendarsCache) {
        await this.calendarsCache.set("calendars", appleCalendars);
      }

      return appleCalendars.map(this.convertToGenericCalendar);
    } catch (error: any) {
      throw new Error(`Failed to fetch calendars: ${error.message}`);
    }
  }

  /**
   * Fetch list of calendars from CalDAV server
   */
  private async fetchCalendarList(
    calendarHome: string
  ): Promise<SimpleCalDAVCalendar[]> {
    const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:ic="http://apple.com/ns/ical/">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <c:supported-calendar-component-set />
    <d:getctag />
    <ic:calendar-color />
    <cs:calendar-color />
  </d:prop>
</d:propfind>`;

    const response = await this.makeCalDAVRequest(
      calendarHome,
      "PROPFIND",
      propfindBody,
      { Depth: "1" }
    );

    return this.parseCalendarListResponse(response, calendarHome);
  }

  /**
   * Parse calendar list response XML
   */
  private parseCalendarListResponse(
    xml: string,
    basePath: string
  ): SimpleCalDAVCalendar[] {
    const calendars: SimpleCalDAVCalendar[] = [];

    try {
      // Use DOMParser for proper XML parsing
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");

      // Check for parsing errors
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        console.error("XML parsing error:", parserError.textContent);
        return calendars;
      }

      // Get all response elements
      const responses = doc.querySelectorAll("response");

      responses.forEach((response) => {
        // Extract href
        const hrefElement = response.querySelector("href");
        if (!hrefElement) {
          return;
        }

        const href = hrefElement.textContent?.trim();
        if (!href) {
          return;
        }

        // Skip the parent directory
        if (href === basePath || href === basePath.replace(/\/$/, "")) {
          return;
        }

        // Check if it's a calendar (has calendar resourcetype)
        const resourceTypeElement = response.querySelector("resourcetype");
        if (!resourceTypeElement) {
          return;
        }

        const calendarElement = resourceTypeElement.querySelector("calendar");
        if (!calendarElement) {
          return;
        }

        // Extract display name
        const displayNameElement = response.querySelector("displayname");
        const displayName =
          displayNameElement?.textContent?.trim() ||
          href.split("/").pop() ||
          href;

        // Extract ctag
        const ctagElement = response.querySelector("getctag");
        const ctag = ctagElement?.textContent?.trim() || "";

        // Extract calendar color (try both Apple and CalendarServer namespaces)
        const appleColorElement = response.querySelector("calendar-color");
        const calendarServerColorElement =
          response.querySelector("calendar-color");
        let color =
          appleColorElement?.textContent?.trim() ||
          calendarServerColorElement?.textContent?.trim();

        // Clean up color format (remove alpha if present, ensure # prefix)
        if (color) {
          color = color.replace(/^#?([A-Fa-f0-9]{6})[A-Fa-f0-9]{2}?$/, "#$1");
          if (!color.startsWith("#")) {
            color = "#" + color;
          }
        }

        calendars.push({
          url: href,
          displayName,
          ctag,
          color,
        });
      });

      return calendars;
    } catch (error) {
      console.error("Error parsing calendar list XML:", error);
      return calendars;
    }
  }

  /**
   * Convert simple CalDAV calendar to Apple Calendar format
   */
  private convertFromSimpleCalDAVCalendar(
    calendar: SimpleCalDAVCalendar
  ): AppleCalendar {
    // Define a set of default colors for calendars if no color is provided
    const defaultColors = [
      "#007AFF", // Blue
      "#FF3B30", // Red
      "#FF9500", // Orange
      "#FFCC00", // Yellow
      "#34C759", // Green
      "#5856D6", // Purple
      "#FF2D92", // Pink
      "#64D2FF", // Light Blue
    ];

    // Use calendar color if available, otherwise pick a default color based on calendar name hash
    let color = calendar.color;
    if (!color) {
      const hash = calendar.displayName.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      color = defaultColors[Math.abs(hash) % defaultColors.length];
    }

    return {
      id: calendar.url,
      name: calendar.displayName,
      visible: true,
      description: "",
      color: color,
      account: "iCloud",
      type: "calendar",
    };
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
    if (!this.credentials) {
      throw new Error("CalDAV credentials not configured");
    }

    const calendarHome = await this.discoverCalendarHome();
    const calendars = await this.fetchCalendarList(calendarHome);

    const targetCalendars =
      calendarIds.length > 0
        ? calendars.filter(
            (cal) =>
              calendarIds.includes(cal.displayName) ||
              calendarIds.includes(cal.url)
          )
        : calendars;

    const allEvents: CalendarEvent[] = [];

    for (const calendar of targetCalendars) {
      const events = await this.fetchCalendarEvents(
        calendar,
        startDate,
        endDate
      );
      allEvents.push(...events);
    }
    return allEvents;
  }

  /**
   * Fetch events from a specific calendar
   */
  private async fetchCalendarEvents(
    calendar: SimpleCalDAVCalendar,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    const startFormatted =
      startDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const endFormatted =
      endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${startFormatted}" end="${endFormatted}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

    const response = await this.makeCalDAVRequest(
      calendar.url,
      "REPORT",
      reportBody,
      { Depth: "1" }
    );

    const events = this.parseCalendarEventsResponse(
      response,
      calendar,
      startDate,
      endDate
    );

    return events;
  }

  /**
   * Parse calendar events response XML
   */
  private parseCalendarEventsResponse(
    xml: string,
    calendar: SimpleCalDAVCalendar,
    requestedStartDate: Date,
    requestedEndDate: Date
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    try {
      // Use DOMParser for proper XML parsing
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");

      // Check for parsing errors
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        console.error("XML parsing error:", parserError.textContent);
        return events;
      }

      // Get all response elements
      const responses = doc.querySelectorAll("response");

      responses.forEach((response) => {
        // Extract calendar data
        const calendarDataElement = response.querySelector("calendar-data");
        if (!calendarDataElement) {
          return;
        }

        const icalData = calendarDataElement.textContent?.trim();
        if (!icalData) {
          return;
        }

        if (!icalData.includes("BEGIN:VEVENT")) {
          return;
        }

        // Parse the iCal data
        const event = this.parseICalEvent(
          icalData,
          calendar,
          requestedStartDate,
          requestedEndDate
        );
        if (event) {
          events.push(event);
        }
      });
      return events;
    } catch (error) {
      console.error("Error parsing calendar events XML:", error);
      return events;
    }
  }

  /**
   * Parse iCal event data using ical.js library and expand recurring events
   */
  private parseICalEvent(
    icalData: string,
    calendar: SimpleCalDAVCalendar,
    requestedStartDate: Date,
    requestedEndDate: Date
  ): CalendarEvent | null {
    try {
      const calendarObj: Calendar = {
        id: calendar.url,
        name: calendar.displayName,
        visible: true,
        color: calendar.color,
      };

      // Parse the iCal data using ical.js
      const jcalData = ICAL.parse(icalData);
      const comp = new ICAL.Component(jcalData);

      // Find the VEVENT component
      const vevent = comp.getFirstSubcomponent("vevent");
      if (!vevent) {
        return null;
      }

      // Create an Event object from the VEVENT component
      const event = new ICAL.Event(vevent);

      // Convert ICAL dates to JavaScript Date objects
      let startDate = event.startDate ? event.startDate.toJSDate() : new Date();
      let endDate = event.endDate ? event.endDate.toJSDate() : startDate;

      // Determine if it's an all-day event
      const allDay = event.startDate ? event.startDate.isDate : false;

      // Check if this is a recurring event that CalDAV has expanded
      // If the original event date is outside our requested range but we got it back,
      // it means CalDAV expanded a recurring event for our date range
      const originalEventDate = new Date(startDate);
      const isOutsideRequestedRange =
        originalEventDate < requestedStartDate ||
        originalEventDate > requestedEndDate;

      if (isOutsideRequestedRange) {
        // For recurring events, we need to adjust the dates to fall within the requested range
        // This is a simplified approach - we'll move the event to the requested date
        // while preserving the time of day
        const originalTime = {
          hours: startDate.getHours(),
          minutes: startDate.getMinutes(),
          seconds: startDate.getSeconds(),
        };

        const duration = endDate.getTime() - startDate.getTime();

        // Set the event to occur on the requested date with the original time
        startDate = new Date(requestedStartDate);
        startDate.setHours(
          originalTime.hours,
          originalTime.minutes,
          originalTime.seconds
        );

        endDate = new Date(startDate.getTime() + duration);
      }

      const finalEvent: CalendarEvent = {
        id: event.uid || generatePrefixedId("calendar"),
        title: event.summary || "Untitled Event",
        startDate,
        endDate,
        allDay,
        location: event.location || "",
        description: event.description || "",
        calendar: calendarObj,
        url: calendar.url,
      };

      return finalEvent;
    } catch (error) {
      console.error("Error parsing iCal event with ical.js:", error);
      return null;
    }
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
      if (!this.credentials) {
        return false;
      }

      // First, try a simple OPTIONS request to test basic connectivity
      try {
        await this.makeCalDAVRequest("/", "OPTIONS");
      } catch (error) {
        return false;
      }

      // Try to discover calendar home to test credentials
      const calendarHome = await this.discoverCalendarHome();

      // Try to list calendars to fully test permissions
      await this.fetchCalendarList(calendarHome);

      return true;
    } catch (error) {
      console.error("Calendar permission check failed:", error);
      return false;
    }
  }

  /**
   * Request permissions if needed
   */
  async requestPermissions(): Promise<boolean> {
    // CalDAV permissions are handled via credentials
    return this.checkPermissions();
  }

  /**
   * Convert Apple Calendar to generic Calendar interface
   */
  private convertToGenericCalendar(calendar: AppleCalendar): Calendar {
    return {
      id: calendar.id,
      name: calendar.name,
      description: calendar.description,
      color: calendar.color,
      visible: calendar.visible,
      metadata: {
        account: calendar.account,
        type: calendar.type,
      },
    };
  }

  /**
   * Create a new calendar event
   */
  async createEvent(
    eventData: CalendarEventCreateData
  ): Promise<CalendarEventCreateResult> {
    if (!this.credentials) {
      return {
        success: false,
        error: "CalDAV credentials not configured",
      };
    }

    try {
      const calendarHome = await this.discoverCalendarHome();
      const calendars = await this.fetchCalendarList(calendarHome);

      // Find the target calendar
      const targetCalendar = calendars.find(
        (cal) =>
          cal.displayName === eventData.calendarId ||
          cal.url.includes(eventData.calendarId)
      );

      if (!targetCalendar) {
        return {
          success: false,
          error: `Calendar not found: ${eventData.calendarId}`,
        };
      }

      // Generate a unique event ID
      const eventId = generateId();
      const eventUrl = `${targetCalendar.url}/${eventId}.ics`;

      // Create iCal content
      const icalContent = this.generateICalContent(eventData, eventId);

      // Send PUT request to create the event
      const response = await requestUrl({
        url: eventUrl,
        method: "PUT",
        headers: {
          Authorization: `Basic ${btoa(
            `${this.credentials.username}:${this.credentials.password}`
          )}`,
          "Content-Type": "text/calendar; charset=utf-8",
          "If-None-Match": "*", // Ensure we're creating a new event
        },
        body: icalContent,
      });

      if (response.status >= 200 && response.status < 300) {
        // Convert the created event data back to CalendarEvent format
        const createdEvent: CalendarEvent = {
          id: eventId,
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          allDay: eventData.allDay || false,
          calendar: this.convertFromSimpleCalDAVCalendar(targetCalendar),
          url: eventUrl,
        };

        return {
          success: true,
          event: createdEvent,
          externalEventId: eventId,
          eventUrl: eventUrl,
        };
      } else {
        return {
          success: false,
          error: `Failed to create event: HTTP ${response.status}`,
        };
      }
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
    if (!this.credentials) {
      return {
        success: false,
        error: "CalDAV credentials not configured",
      };
    }

    try {
      // For now, we'll implement this as a delete + create operation
      // A more sophisticated implementation would fetch the existing event and modify it
      const deleteSuccess = await this.deleteEvent(eventId);
      if (!deleteSuccess) {
        return {
          success: false,
          error: "Failed to delete existing event for update",
        };
      }

      // Create new event with updated data
      if (
        eventData.calendarId &&
        eventData.title &&
        eventData.startDate &&
        eventData.endDate
      ) {
        return await this.createEvent(eventData as CalendarEventCreateData);
      } else {
        return {
          success: false,
          error: "Insufficient data for event update",
        };
      }
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
    if (!this.credentials) {
      return false;
    }

    try {
      const calendarHome = await this.discoverCalendarHome();
      const calendars = await this.fetchCalendarList(calendarHome);

      // Try to find and delete the event from all calendars
      for (const calendar of calendars) {
        const eventUrl = `${calendar.url}/${eventId}.ics`;

        try {
          const response = await requestUrl({
            url: eventUrl,
            method: "DELETE",
            headers: {
              Authorization: `Basic ${btoa(
                `${this.credentials.username}:${this.credentials.password}`
              )}`,
            },
          });

          if (response.status >= 200 && response.status < 300) {
            return true;
          }
        } catch (error) {
          // Continue to next calendar if this one fails
          continue;
        }
      }

      return false;
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      return false;
    }
  }

  /**
   * Generate iCal content for creating a calendar event
   */
  private generateICalContent(
    eventData: CalendarEventCreateData,
    eventId: string
  ): string {
    const now = new Date();
    const formatDate = (date: Date): string => {
      if (eventData.allDay) {
        // For all-day events, use DATE format (YYYYMMDD)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}${month}${day}`;
      } else {
        // For timed events, use DATETIME format (YYYYMMDDTHHMMSSZ)
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      }
    };

    const startDateStr = formatDate(eventData.startDate);
    const endDateStr = formatDate(eventData.endDate);
    const createdDateStr = formatDate(now);

    let icalContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Obsidian Task Sync//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${eventId}`,
      `DTSTAMP:${createdDateStr}`,
      `CREATED:${createdDateStr}`,
      `LAST-MODIFIED:${createdDateStr}`,
      `SUMMARY:${eventData.title.replace(/\n/g, "\\n")}`,
    ];

    // Add date/time properties
    if (eventData.allDay) {
      icalContent.push(`DTSTART;VALUE=DATE:${startDateStr}`);
      icalContent.push(`DTEND;VALUE=DATE:${endDateStr}`);
    } else {
      icalContent.push(`DTSTART:${startDateStr}`);
      icalContent.push(`DTEND:${endDateStr}`);
    }

    // Add optional properties
    if (eventData.description) {
      icalContent.push(
        `DESCRIPTION:${eventData.description.replace(/\n/g, "\\n")}`
      );
    }

    if (eventData.location) {
      icalContent.push(`LOCATION:${eventData.location.replace(/\n/g, "\\n")}`);
    }

    // Add reminders if specified
    if (eventData.reminders && eventData.reminders.length > 0) {
      for (const reminder of eventData.reminders) {
        icalContent.push("BEGIN:VALARM");
        icalContent.push("ACTION:DISPLAY");
        icalContent.push(`TRIGGER:-PT${reminder}M`); // Minutes before event
        icalContent.push(`DESCRIPTION:${eventData.title}`);
        icalContent.push("END:VALARM");
      }
    }

    icalContent.push("END:VEVENT");
    icalContent.push("END:VCALENDAR");

    return icalContent.join("\r\n");
  }
}
