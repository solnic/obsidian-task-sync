import type { CalendarEvent } from "../types/calendar";

/**
 * Filter events by selected calendar IDs
 *
 * @param eventList - List of calendar events to filter
 * @param calendarIds - Array of calendar IDs to include
 * @param totalAvailableCalendars - Total number of available calendars
 * @returns Filtered list of calendar events
 */
export function filterByCalendars(
  eventList: CalendarEvent[],
  calendarIds: string[],
  totalAvailableCalendars: number
): CalendarEvent[] {
  // If no calendars selected or all calendars selected, show all events
  if (
    calendarIds.length === 0 ||
    calendarIds.length === totalAvailableCalendars
  ) {
    return eventList;
  }

  // Filter events by selected calendar IDs
  return eventList.filter(
    (event) => event.calendar && calendarIds.includes(event.calendar.id)
  );
}

/**
 * Filter events by search query
 *
 * @param query - Search query string
 * @param eventList - List of calendar events to filter
 * @returns Filtered list of calendar events
 */
export function searchEvents(
  query: string,
  eventList: CalendarEvent[]
): CalendarEvent[] {
  if (!query.trim()) {
    return eventList;
  }

  const lowerQuery = query.toLowerCase();
  return eventList.filter(
    (event) =>
      event.title.toLowerCase().includes(lowerQuery) ||
      (event.description &&
        event.description.toLowerCase().includes(lowerQuery)) ||
      (event.location && event.location.toLowerCase().includes(lowerQuery)) ||
      (event.calendar?.name &&
        event.calendar.name.toLowerCase().includes(lowerQuery))
  );
}
