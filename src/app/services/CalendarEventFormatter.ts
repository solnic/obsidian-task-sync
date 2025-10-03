/**
 * Calendar Event Formatter
 * Formats calendar events for insertion into daily notes
 */

import {
  CalendarEvent,
  CalendarEventFormatter,
  CalendarEventFormatOptions,
} from "../types/calendar";

export class DefaultCalendarEventFormatter implements CalendarEventFormatter {
  /**
   * Format a single event for display
   */
  formatEvent(event: CalendarEvent, options?: CalendarEventFormatOptions): string {
    const opts = this.getDefaultOptions(options);
    const timeStr = this.formatEventTime(event, opts);
    const locationStr = opts.includeLocation && event.location ? ` @ ${event.location}` : "";
    const calendarStr = opts.showCalendarName ? ` (${event.calendar.name})` : "";
    const descriptionStr = opts.includeDescription && event.description 
      ? `\n  ${event.description}` 
      : "";

    if (opts.markdown?.useCheckboxes) {
      return `- [ ] ${timeStr}${event.title}${locationStr}${calendarStr}${descriptionStr}`;
    } else if (opts.markdown?.useBullets) {
      return `- ${timeStr}${event.title}${locationStr}${calendarStr}${descriptionStr}`;
    } else {
      return `${timeStr}${event.title}${locationStr}${calendarStr}${descriptionStr}`;
    }
  }

  /**
   * Format multiple events for display
   */
  formatEvents(events: CalendarEvent[], options?: CalendarEventFormatOptions): string {
    const opts = this.getDefaultOptions(options);
    
    if (opts.groupByCalendar) {
      return this.formatEventsByCalendar(events, options);
    }

    // Sort events by start time
    const sortedEvents = events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    
    return sortedEvents.map(event => this.formatEvent(event, opts)).join('\n');
  }

  /**
   * Format events grouped by calendar
   */
  formatEventsByCalendar(events: CalendarEvent[], options?: CalendarEventFormatOptions): string {
    const opts = this.getDefaultOptions(options);
    const groupedEvents = this.groupEventsByCalendar(events);
    const sections: string[] = [];

    for (const [calendarName, calendarEvents] of Object.entries(groupedEvents)) {
      const headerLevel = '#'.repeat(opts.markdown?.calendarHeaderLevel || 3);
      const header = `${headerLevel} ${calendarName}`;
      
      const sortedEvents = calendarEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      const eventsList = sortedEvents.map(event => 
        this.formatEvent(event, { ...opts, showCalendarName: false })
      ).join('\n');

      sections.push(`${header}\n\n${eventsList}`);
    }

    return sections.join('\n\n');
  }

  /**
   * Format event time based on options
   */
  private formatEventTime(event: CalendarEvent, options: CalendarEventFormatOptions): string {
    if (!options.includeTime) {
      return "";
    }

    if (event.allDay) {
      return "All day: ";
    }

    const timeFormat = options.timeFormat === "12h" ? "12h" : "24h";
    const startTime = this.formatTime(event.startDate, timeFormat);
    const endTime = this.formatTime(event.endDate, timeFormat);

    // If events are on the same day, just show times
    if (this.isSameDay(event.startDate, event.endDate)) {
      return `${startTime}-${endTime}: `;
    } else {
      // Multi-day event
      const startDate = this.formatDate(event.startDate);
      const endDate = this.formatDate(event.endDate);
      return `${startDate} ${startTime} - ${endDate} ${endTime}: `;
    }
  }

  /**
   * Format time according to 12h or 24h format
   */
  private formatTime(date: Date, format: "12h" | "24h"): string {
    if (format === "12h") {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    }
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  /**
   * Check if two dates are on the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  /**
   * Group events by calendar name
   */
  private groupEventsByCalendar(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
    return events.reduce((groups, event) => {
      const calendarName = event.calendar.name;
      if (!groups[calendarName]) {
        groups[calendarName] = [];
      }
      groups[calendarName].push(event);
      return groups;
    }, {} as Record<string, CalendarEvent[]>);
  }

  /**
   * Get default formatting options
   */
  private getDefaultOptions(options?: CalendarEventFormatOptions): CalendarEventFormatOptions {
    return {
      includeTime: true,
      includeLocation: true,
      includeDescription: false,
      timeFormat: "24h",
      groupByCalendar: false,
      showCalendarName: true,
      markdown: {
        useBullets: true,
        useCheckboxes: false,
        calendarHeaderLevel: 3,
      },
      ...options,
    };
  }
}
