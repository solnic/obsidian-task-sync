/**
 * Calendar-specific Entity Operations
 * Provides calendar-focused operations (NOT task-related)
 * Handles calendar data management and operations
 */

import type {
  Calendar as CalendarType,
  CalendarEvent,
  CalendarEventFetchOptions,
} from "../../../types/calendar";
import type { CalendarService } from "../services/CalendarService";

/**
 * Calendar-specific Operations
 * Handles calendar data management, event fetching, etc.
 * Note: This is NOT task-related - it's purely for calendar functionality
 */
export class CalendarOperations {
  private calendarServices: CalendarService[] = [];

  constructor(calendarServices: CalendarService[] = []) {
    this.calendarServices = calendarServices;
  }

  /**
   * Add a calendar service to this operations instance
   */
  addCalendarService(service: CalendarService): void {
    this.calendarServices.push(service);
  }

  /**
   * Remove a calendar service from this operations instance
   */
  removeCalendarService(serviceName: string): void {
    this.calendarServices = this.calendarServices.filter(
      (service) => service.serviceName !== serviceName
    );
  }

  /**
   * Get all calendars from all enabled services
   */
  async getAllCalendars(): Promise<CalendarType[]> {
    const allCalendars: CalendarType[] = [];

    for (const service of this.calendarServices) {
      if (service.isEnabled() && service.isPlatformSupported()) {
        try {
          const calendars = await service.getCalendars();
          allCalendars.push(...calendars);
        } catch (error) {
          console.error(
            `Failed to get calendars from ${service.serviceName}:`,
            error
          );
        }
      }
    }

    return allCalendars;
  }

  /**
   * Get calendars from a specific service
   */
  async getCalendarsFromService(
    serviceName: string
  ): Promise<CalendarType[]> {
    const service = this.calendarServices.find(
      (s) => s.serviceName === serviceName
    );

    if (!service) {
      throw new Error(`Calendar service '${serviceName}' not found`);
    }

    if (!service.isEnabled()) {
      throw new Error(`Calendar service '${serviceName}' is not enabled`);
    }

    if (!service.isPlatformSupported()) {
      throw new Error(
        `Calendar service '${serviceName}' is not supported on this platform`
      );
    }

    return await service.getCalendars();
  }

  /**
   * Get events from all enabled services within a date range
   */
  async getAllEvents(
    startDate: Date,
    endDate: Date,
    options?: CalendarEventFetchOptions
  ): Promise<CalendarEvent[]> {
    console.log(`[CalendarOperations] getAllEvents called for ${this.calendarServices.length} services`);

    const allEvents: CalendarEvent[] = [];

    for (const service of this.calendarServices) {
      if (service.isEnabled() && service.isPlatformSupported()) {
        try {
          console.log(`[CalendarOperations] Fetching events from service: ${service.serviceName}`);
          const events = await service.getEvents(
            [],
            startDate,
            endDate,
            options
          );
          console.log(`[CalendarOperations] Service ${service.serviceName} returned ${events.length} events`);
          allEvents.push(...events);
        } catch (error) {
          console.error(
            `[CalendarOperations] Failed to get events from ${service.serviceName}:`,
            error
          );
        }
      }
    }

    console.log(`[CalendarOperations] Total events from all services: ${allEvents.length}`);
    return allEvents;
  }

  /**
   * Get events from specific calendars within a date range
   */
  async getEventsFromCalendars(
    calendarIds: string[],
    startDate: Date,
    endDate: Date,
    options?: CalendarEventFetchOptions
  ): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];

    for (const service of this.calendarServices) {
      if (service.isEnabled() && service.isPlatformSupported()) {
        try {
          const events = await service.getEvents(
            calendarIds,
            startDate,
            endDate,
            options
          );
          allEvents.push(...events);
        } catch (error) {
          console.error(
            `Failed to get events from ${service.serviceName}:`,
            error
          );
        }
      }
    }

    return allEvents;
  }

  /**
   * Get today's events from all enabled services
   */
  async getTodayEvents(calendarIds?: string[]): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];

    for (const service of this.calendarServices) {
      if (service.isEnabled() && service.isPlatformSupported()) {
        try {
          const events = await service.getTodayEvents(calendarIds);
          allEvents.push(...events);
        } catch (error) {
          console.error(
            `Failed to get today's events from ${service.serviceName}:`,
            error
          );
        }
      }
    }

    return allEvents;
  }

  /**
   * Check permissions for all calendar services
   */
  async checkAllPermissions(): Promise<Record<string, boolean>> {
    const permissions: Record<string, boolean> = {};

    for (const service of this.calendarServices) {
      if (service.isPlatformSupported()) {
        try {
          permissions[service.serviceName] = await service.checkPermissions();
        } catch (error) {
          console.error(
            `Failed to check permissions for ${service.serviceName}:`,
            error
          );
          permissions[service.serviceName] = false;
        }
      } else {
        permissions[service.serviceName] = false;
      }
    }

    return permissions;
  }

  /**
   * Request permissions for all calendar services
   */
  async requestAllPermissions(): Promise<Record<string, boolean>> {
    const permissions: Record<string, boolean> = {};

    for (const service of this.calendarServices) {
      if (service.isPlatformSupported()) {
        try {
          permissions[service.serviceName] =
            await service.requestPermissions();
        } catch (error) {
          console.error(
            `Failed to request permissions for ${service.serviceName}:`,
            error
          );
          permissions[service.serviceName] = false;
        }
      } else {
        permissions[service.serviceName] = false;
      }
    }

    return permissions;
  }

  /**
   * Clear cache for all calendar services
   */
  async clearAllCaches(): Promise<void> {
    for (const service of this.calendarServices) {
      try {
        await service.clearCache();
      } catch (error) {
        console.error(
          `Failed to clear cache for ${service.serviceName}:`,
          error
        );
      }
    }
  }

  /**
   * Get enabled calendar services
   */
  getEnabledServices(): CalendarService[] {
    return this.calendarServices.filter(
      (service) => service.isEnabled() && service.isPlatformSupported()
    );
  }

  /**
   * Get a specific calendar service by name
   */
  getService(serviceName: string): CalendarService | undefined {
    return this.calendarServices.find(
      (service) => service.serviceName === serviceName
    );
  }
}

// Export default singleton instance (will be populated by CalendarExtension)
export const calendarOperations = new CalendarOperations();
