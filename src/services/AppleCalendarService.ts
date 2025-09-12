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

    console.log(`CalDAV ${method} request to: ${url}`);
    if (body) {
      console.log("Request body:", body);
    }

    try {
      const response = await requestUrl({
        url,
        method,
        headers: requestHeaders,
        body,
        throw: false,
      });

      console.log(`CalDAV response: ${response.status}`);
      console.log("Response text:", response.text);

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
      console.log("Attempting iCloud CalDAV discovery for user:", username);

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

      console.log("Well-known response received");

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
        console.log("Found principal URL from well-known:", principalUrl);

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
          console.log("Found calendar home:", calendarHome);
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
          console.log(
            "Constructed calendar home from principal:",
            calendarHome
          );
          this.calendarHomeUrl = calendarHome;
          return calendarHome;
        }
      } else {
        console.log("No principal URL found in well-known response");
      }
    } catch (error) {
      console.log(
        "Well-known discovery failed, trying direct approach:",
        error
      );
    }

    // Fallback: try to construct the URL directly
    // iCloud typically uses a pattern like /[user-id]/calendars/
    // where user-id is often the part before @ in the email
    const userPart = username.split("@")[0];
    const directCalendarHome = `/${userPart}/calendars/`;

    console.log("Using direct calendar home pattern:", directCalendarHome);
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
    console.log("Parsing calendar list response...");
    console.log(`Response length: ${xml.length} characters`);

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
      console.log(`Found ${responses.length} response elements`);

      responses.forEach((response, index) => {
        console.log(`Processing calendar response ${index + 1}`);

        // Extract href
        const hrefElement = response.querySelector("href");
        if (!hrefElement) {
          console.log("No href found in response");
          return;
        }

        const href = hrefElement.textContent?.trim();
        if (!href) {
          console.log("Empty href found");
          return;
        }

        console.log(`Found href: ${href}`);

        // Skip the parent directory
        if (href === basePath || href === basePath.replace(/\/$/, "")) {
          console.log("Skipping parent directory");
          return;
        }

        // Check if it's a calendar (has calendar resourcetype)
        const resourceTypeElement = response.querySelector("resourcetype");
        if (!resourceTypeElement) {
          console.log("No resourcetype found");
          return;
        }

        const calendarElement = resourceTypeElement.querySelector("calendar");
        if (!calendarElement) {
          console.log("Not a calendar resource, skipping");
          return;
        }

        // Extract display name
        const displayNameElement = response.querySelector("displayname");
        const displayName =
          displayNameElement?.textContent?.trim() ||
          href.split("/").pop() ||
          href;

        console.log(`Found calendar: ${displayName} at ${href}`);

        // Extract ctag
        const ctagElement = response.querySelector("getctag");
        const ctag = ctagElement?.textContent?.trim() || "";

        calendars.push({
          url: href,
          displayName,
          ctag,
        });
      });

      console.log(`Calendars found: ${calendars.length}`);
      console.log(
        "Calendar names:",
        calendars.map((cal) => cal.displayName)
      );

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

      console.log(`Total calendars found: ${calendars.length}`);
      console.log(`Target calendars to process: ${targetCalendars.length}`);
      console.log(
        "Target calendars:",
        targetCalendars.map((cal) => `${cal.displayName} (${cal.url})`)
      );

      const allEvents: CalendarEvent[] = [];

      for (const calendar of targetCalendars) {
        console.log(`Processing calendar: ${calendar.displayName}`);
        const events = await this.fetchCalendarEvents(
          calendar,
          startDate,
          endDate
        );
        console.log(
          `Calendar ${calendar.displayName} returned ${events.length} events`
        );
        allEvents.push(...events);
      }

      console.log(`Total events collected: ${allEvents.length}`);

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
    console.log(
      `Fetching events from calendar: ${calendar.displayName} (${calendar.url})`
    );
    console.log(
      `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    const startFormatted =
      startDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const endFormatted =
      endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    console.log(`Formatted date range: ${startFormatted} to ${endFormatted}`);

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
    console.log(
      `Found ${events.length} events in calendar ${calendar.displayName}`
    );

    return events;
  }

  /**
   * Parse calendar events response XML
   */
  private parseCalendarEventsResponse(
    xml: string,
    calendar: SimpleCalDAVCalendar
  ): CalendarEvent[] {
    console.log(
      `Parsing events response for calendar: ${calendar.displayName}`
    );
    console.log(`Response length: ${xml.length} characters`);

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
      console.log(`Found ${responses.length} event response elements`);

      responses.forEach((response, index) => {
        console.log(`Processing event response ${index + 1}`);

        // Extract calendar data
        const calendarDataElement = response.querySelector("calendar-data");
        if (!calendarDataElement) {
          console.log("No calendar data found in response");
          return;
        }

        const icalData = calendarDataElement.textContent?.trim();
        if (!icalData) {
          console.log("Empty calendar data found");
          return;
        }

        console.log(
          `Found iCal data (${icalData.length} chars):`,
          icalData.substring(0, 200) + "..."
        );

        if (!icalData.includes("BEGIN:VEVENT")) {
          console.log("iCal data does not contain VEVENT");
          return;
        }

        // Parse the iCal data
        const event = this.parseICalEvent(icalData, calendar);
        if (event) {
          console.log(`Successfully parsed event: ${event.title}`);
          events.push(event);
        } else {
          console.log("Failed to parse iCal event");
        }
      });

      console.log(
        `Total responses processed: ${responses.length}, events parsed: ${events.length}`
      );
      return events;
    } catch (error) {
      console.error("Error parsing calendar events XML:", error);
      return events;
    }
  }

  /**
   * Parse iCal event data
   */
  private parseICalEvent(
    icalData: string,
    calendar: SimpleCalDAVCalendar
  ): CalendarEvent | null {
    try {
      const lines = icalData.split(/\r?\n/);
      const calendarObj: Calendar = {
        id: calendar.url,
        name: calendar.displayName,
        visible: true,
      };

      const event: Partial<CalendarEvent> = {
        calendar: calendarObj,
        url: calendar.url,
      };

      for (const line of lines) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":");

        switch (key) {
          case "UID":
            event.id = value;
            break;
          case "SUMMARY":
            event.title = value;
            break;
          case "DTSTART":
            event.startDate = this.parseICalDate(value);
            break;
          case "DTEND":
            event.endDate = this.parseICalDate(value);
            break;
          case "LOCATION":
            event.location = value;
            break;
          case "DESCRIPTION":
            event.description = value;
            break;
        }
      }

      // Check if we have required fields
      if (!event.id || !event.title || !event.startDate) {
        return null;
      }

      // Set default end date if not provided
      if (!event.endDate) {
        event.endDate = event.startDate;
      }

      // Determine if it's an all-day event
      const startDateStr = event.startDate?.toString() || "";
      const allDay = !startDateStr.includes("T");

      return {
        id: event.id!,
        title: event.title!,
        startDate: event.startDate!,
        endDate: event.endDate!,
        allDay,
        location: event.location,
        description: event.description,
        calendar: event.calendar!,
        url: event.url!,
      };
    } catch (error) {
      console.error("Error parsing iCal event:", error);
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
        console.error("No credentials configured");
        return false;
      }

      console.log("Testing CalDAV connection...");

      // First, try a simple OPTIONS request to test basic connectivity
      try {
        await this.makeCalDAVRequest("/", "OPTIONS");
        console.log("Basic connectivity test passed");
      } catch (error) {
        console.error("Basic connectivity test failed:", error);
        return false;
      }

      // Try to discover calendar home to test credentials
      const calendarHome = await this.discoverCalendarHome();
      console.log("Calendar home discovered:", calendarHome);

      // Try to list calendars to fully test permissions
      const calendars = await this.fetchCalendarList(calendarHome);
      console.log("Found calendars:", calendars.length);

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
   * Parse iCal date string to JavaScript Date
   */
  private parseICalDate(dateStr: string): Date {
    if (!dateStr) {
      return new Date();
    }

    // Handle different iCal date formats
    if (dateStr.length === 8) {
      // YYYYMMDD format (all-day)
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-based
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    } else if (dateStr.includes("T")) {
      // ISO format or YYYYMMDDTHHMMSS format
      if (dateStr.includes("-")) {
        return new Date(dateStr);
      } else {
        // YYYYMMDDTHHMMSSZ format
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(dateStr.substring(9, 11));
        const minute = parseInt(dateStr.substring(11, 13));
        const second = parseInt(dateStr.substring(13, 15));
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      }
    }

    return new Date(dateStr);
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
