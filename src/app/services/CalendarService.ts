/**
 * Abstract Calendar Service Interface
 * Defines the contract that all calendar providers must implement
 * Enables support for multiple calendar providers (Apple Calendar, Google Calendar, Outlook, etc.)
 */

import type { Calendar, CalendarEvent, CalendarEventFetchOptions } from "../types/calendar";

/**
 * Abstract interface that all calendar service implementations must follow
 * This enables pluggable calendar providers while maintaining consistent API
 */
export interface CalendarService {
  /** Unique identifier for this calendar service */
  readonly serviceName: string;

  /** Whether this service is supported on the current platform */
  isPlatformSupported(): boolean;

  /** Whether this service is currently enabled in settings */
  isEnabled(): boolean;

  /** Get all available calendars from this service */
  getCalendars(): Promise<Calendar[]>;

  /** 
   * Get events from specified calendars within a date range 
   * @param calendarIds - Array of calendar IDs to fetch from (empty array = all calendars)
   * @param startDate - Start date for event range
   * @param endDate - End date for event range
   * @param options - Optional fetch options for filtering
   */
  getEvents(
    calendarIds: string[],
    startDate: Date,
    endDate: Date,
    options?: CalendarEventFetchOptions
  ): Promise<CalendarEvent[]>;

  /** Get events for today from specified calendars */
  getTodayEvents(calendarIds?: string[]): Promise<CalendarEvent[]>;

  /** Check if the service has necessary permissions to access calendar data */
  checkPermissions(): Promise<boolean>;

  /** Request permissions if needed (platform-specific implementation) */
  requestPermissions(): Promise<boolean>;

  /** Clear any cached calendar data */
  clearCache(): Promise<void>;

  /** Initialize the service with any required setup */
  initialize?(): Promise<void>;

  /** Clean up resources when service is no longer needed */
  dispose?(): void;
}

/**
 * Registry for managing multiple calendar services
 * Allows the CalendarExtension to work with multiple calendar providers
 */
export class CalendarServiceRegistry {
  private services = new Map<string, CalendarService>();

  /**
   * Register a calendar service
   */
  register(service: CalendarService): void {
    if (this.services.has(service.serviceName)) {
      throw new Error(
        `Calendar service '${service.serviceName}' is already registered`
      );
    }
    this.services.set(service.serviceName, service);
  }

  /**
   * Unregister a calendar service
   */
  unregister(serviceName: string): void {
    this.services.delete(serviceName);
  }

  /**
   * Get a specific calendar service by name
   */
  getService(serviceName: string): CalendarService | undefined {
    return this.services.get(serviceName);
  }

  /**
   * Get all registered calendar services
   */
  getAllServices(): CalendarService[] {
    return Array.from(this.services.values());
  }

  /**
   * Get all enabled calendar services
   */
  getEnabledServices(): CalendarService[] {
    return this.getAllServices().filter(service => service.isEnabled());
  }

  /**
   * Get all platform-supported calendar services
   */
  getSupportedServices(): CalendarService[] {
    return this.getAllServices().filter(service => service.isPlatformSupported());
  }

  /**
   * Clear all registered services
   */
  clear(): void {
    // Dispose of all services before clearing
    for (const service of this.services.values()) {
      if (service.dispose) {
        service.dispose();
      }
    }
    this.services.clear();
  }
}

// Global calendar service registry instance
export const calendarServiceRegistry = new CalendarServiceRegistry();
