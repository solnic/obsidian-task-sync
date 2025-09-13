/**
 * Apple Calendar Service
 * Handles integration with Apple Calendar using CalDAV via tsdav library
 */

import { AbstractService } from "./AbstractService";
import { CacheManager } from "../cache/CacheManager";
import { SchemaCache } from "../cache/SchemaCache";
import {
  AppleCalendarsSchema,
  AppleCalendarEventsSchema,
  AppleCalendars,
  AppleCalendarEvents,
} from "../cache/schemas/apple-calendar";
import {
  AppleCalendar,
  AppleCalendarEvent,
  AppleCalendarAttendee,
  AppleCalendarConfig,
  AppleCalendarResult,
  AppleCalendarError,
  AppleCalendarFilter,
} from "../types/apple-calendar";
import {
  Calendar,
  CalendarEvent,
  CalendarService,
  CalendarEventFetchOptions,
} from "../types/calendar";
import { TaskSyncSettings } from "../components/ui/settings/types";
import { requestUrl } from "obsidian";
import ICAL from "ical.js";

// Simple CalDAV calendar interface
interface SimpleCalDAVCalendar {
  url: string;
  displayName: string;
  ctag: string;
}

// Simple CalDAV event interface
interface SimpleCalDAVEvent {
  url: string;
  etag: string;
  data: string;
}

export class AppleCalendarService
  extends AbstractService
  implements CalendarService
{
  readonly serviceName = "apple-calendar";

  private calendarsCache?: SchemaCache<AppleCalendars>;
  private eventsCache?: SchemaCache<AppleCalendarEvents>;
  private baseUrl: string = "https://caldav.icloud.com";
  private credentials?: { username: string; password: string };
  private calendarHomeUrl?: string;

  constructor(settings: TaskSyncSettings) {
    super(settings);
    this.initializeCredentials();
  }

  /**
   * Initialize CalDAV credentials
   */
  private initializeCredentials(): void {
    const config = this.settings.appleCalendarIntegration;
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
  protected async setupCaches(): Promise<void> {
    this.calendarsCache = this.createCache(
      "apple-calendars",
      AppleCalendarsSchema
    );
    this.eventsCache = this.createCache(
      "apple-calendar-events",
      AppleCalendarEventsSchema
    );
  }

  /**
   * Preload Apple Calendar caches from persistent storage
   */
  protected async preloadCaches(): Promise<void> {
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
   * Initialize the service with cache manager
   */
  async initialize(cacheManager: CacheManager): Promise<void> {
    await super.initialize(cacheManager);
  }

  /**
   * Update settings reference
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.updateSettingsInternal(newSettings.appleCalendarIntegration);
  }

  /**
   * Update internal settings (for event system)
   */
  updateSettingsInternal(newSettings: AppleCalendarConfig): void {
    if (this.settings.appleCalendarIntegration) {
      Object.assign(this.settings.appleCalendarIntegration, newSettings);
    }
  }

  /**
   * Check if Apple Calendar integration is enabled
   */
  isEnabled(): boolean {
    return this.settings.appleCalendarIntegration?.enabled ?? false;
  }

  /**
   * Check if the current platform supports Apple Calendar integration
   * CalDAV works on all platforms, but we focus on iCloud Calendar
   */
  isPlatformSupported(): boolean {
    return true; // CalDAV works on all platforms
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
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <c:supported-calendar-component-set />
    <d:getctag />
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

        calendars.push({
          url: href,
          displayName,
          ctag,
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
    return {
      id: calendar.url,
      name: calendar.displayName,
      visible: true,
      description: "",
      color: "#007AFF", // Default blue color
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
    options?: CalendarEventFetchOptions
  ): Promise<CalendarEvent[]> {
    if (!this.credentials) {
      throw new Error("CalDAV credentials not configured");
    }

    try {
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

      // Cache the results
      if (this.eventsCache) {
        const cacheKey = `events-${startDate.toISOString()}-${endDate.toISOString()}`;
        const appleEvents = allEvents.map((event) => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          allDay: event.allDay,
          location: event.location || "",
          description: event.description || "",
          calendar: {
            id: event.calendar.id,
            name: event.calendar.name,
            visible: event.calendar.visible,
            description: event.calendar.description || "",
            color: event.calendar.color || "#007AFF",
            account: "iCloud",
            type: "calendar",
          },
          url: event.url || "",
          status: "confirmed" as const,
          availability: "busy" as const,
          attendees: [] as AppleCalendarAttendee[],
          organizer: undefined as AppleCalendarAttendee | undefined,
          recurrenceRule: undefined as string | undefined,
        }));
        await this.eventsCache.set(cacheKey, appleEvents);
      }

      return allEvents;
    } catch (error: any) {
      throw new Error(`Failed to fetch events: ${error.message}`);
    }
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

    const events = this.parseCalendarEventsResponse(response, calendar);
    return events;
  }

  /**
   * Parse calendar events response XML
   */
  private parseCalendarEventsResponse(
    xml: string,
    calendar: SimpleCalDAVCalendar
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
        const event = this.parseICalEvent(icalData, calendar);
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
   * Parse iCal event data using ical.js library
   */
  private parseICalEvent(
    icalData: string,
    calendar: SimpleCalDAVCalendar
  ): CalendarEvent | null {
    try {
      const calendarObj: Calendar = {
        id: calendar.url,
        name: calendar.displayName,
        visible: true,
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
      const startDate = event.startDate
        ? event.startDate.toJSDate()
        : new Date();
      const endDate = event.endDate ? event.endDate.toJSDate() : startDate;

      // Determine if it's an all-day event
      const allDay = event.startDate ? event.startDate.isDate : false;

      const finalEvent: CalendarEvent = {
        id: event.uid || `${calendar.url}-${Date.now()}`,
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
}
