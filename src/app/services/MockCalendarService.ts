/**
 * Mock Calendar Service for development and testing
 * Provides sample calendar events for daily planning
 */

import type { 
  CalendarService, 
  Calendar, 
  CalendarEvent, 
  CalendarEventFetchOptions,
  CalendarEventCreateData,
  CalendarEventCreateResult 
} from "../types/calendar";
import { generateId } from "../utils/idGenerator";

export class MockCalendarService implements CalendarService {
  readonly serviceName = "mock-calendar";
  private enabled: boolean = false;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  isPlatformSupported(): boolean {
    return true; // Mock service is always supported
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async getCalendars(): Promise<Calendar[]> {
    return [
      {
        id: "work-calendar",
        name: "Work Calendar",
        description: "Work-related events and meetings",
        color: "#3b82f6",
        visible: true,
      },
      {
        id: "personal-calendar",
        name: "Personal Calendar",
        description: "Personal events and appointments",
        color: "#10b981",
        visible: true,
      },
    ];
  }

  async getEvents(
    calendarIds: string[],
    startDate: Date,
    endDate: Date,
    options?: CalendarEventFetchOptions
  ): Promise<CalendarEvent[]> {
    if (!this.enabled) {
      return [];
    }

    const calendars = await this.getCalendars();
    const targetCalendars = calendarIds.length > 0 
      ? calendars.filter(cal => calendarIds.includes(cal.id))
      : calendars;

    const events: CalendarEvent[] = [];

    // Generate mock events for each day in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      // Add a morning meeting for work calendar
      if (targetCalendars.some(cal => cal.id === "work-calendar")) {
        const meetingStart = new Date(currentDate);
        meetingStart.setHours(9, 0, 0, 0);
        const meetingEnd = new Date(currentDate);
        meetingEnd.setHours(10, 0, 0, 0);

        events.push({
          id: `work-meeting-${currentDate.toISOString().split('T')[0]}`,
          title: "Daily Standup",
          description: "Team daily standup meeting",
          location: "Conference Room A",
          startDate: meetingStart,
          endDate: meetingEnd,
          allDay: false,
          calendar: targetCalendars.find(cal => cal.id === "work-calendar")!,
          url: "https://example.com/meeting",
        });
      }

      // Add an afternoon appointment for personal calendar
      if (targetCalendars.some(cal => cal.id === "personal-calendar")) {
        const appointmentStart = new Date(currentDate);
        appointmentStart.setHours(14, 30, 0, 0);
        const appointmentEnd = new Date(currentDate);
        appointmentEnd.setHours(15, 30, 0, 0);

        events.push({
          id: `personal-appointment-${currentDate.toISOString().split('T')[0]}`,
          title: "Doctor Appointment",
          description: "Annual checkup",
          location: "Medical Center",
          startDate: appointmentStart,
          endDate: appointmentEnd,
          allDay: false,
          calendar: targetCalendars.find(cal => cal.id === "personal-calendar")!,
          url: "https://example.com/appointment",
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return events;
  }

  async getTodayEvents(calendarIds?: string[]): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getEvents(calendarIds || [], startOfDay, endOfDay);
  }

  async createEvent(eventData: CalendarEventCreateData): Promise<CalendarEventCreateResult> {
    // Mock implementation - just return success
    const calendars = await this.getCalendars();
    const calendar = calendars.find(cal => cal.id === eventData.calendarId);
    
    if (!calendar) {
      return {
        success: false,
        error: `Calendar with id ${eventData.calendarId} not found`,
      };
    }

    const event: CalendarEvent = {
      id: generateId(),
      title: eventData.title,
      description: eventData.description,
      location: eventData.location,
      startDate: eventData.startDate,
      endDate: eventData.endDate,
      allDay: eventData.allDay || false,
      calendar,
      url: "https://example.com/created-event",
    };

    return {
      success: true,
      event,
      externalEventId: event.id,
      eventUrl: event.url,
    };
  }

  async updateEvent(
    eventId: string,
    eventData: Partial<CalendarEventCreateData>
  ): Promise<CalendarEventCreateResult> {
    // Mock implementation - just return success
    return {
      success: true,
      externalEventId: eventId,
    };
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    // Mock implementation - just return success
    return true;
  }

  async checkPermissions(): Promise<boolean> {
    return true; // Mock service always has permissions
  }

  async requestPermissions(): Promise<boolean> {
    return true; // Mock service always grants permissions
  }

  async clearCache(): Promise<void> {
    // Mock service has no cache to clear
  }
}

// Export a singleton instance for use in the application
export const mockCalendarService = new MockCalendarService(false);
