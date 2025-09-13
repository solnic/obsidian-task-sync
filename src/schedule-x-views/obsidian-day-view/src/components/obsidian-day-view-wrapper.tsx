import { PreactViewComponent } from "../create-view";
import { useState, useEffect } from "preact/hooks";
import { CalendarEvent } from "@schedule-x/calendar";

interface ZoomLevel {
  startHour: number;
  endHour: number;
  hourHeight: number;
}

const ZOOM_LEVELS: ZoomLevel[] = [
  { startHour: 6, endHour: 22, hourHeight: 40 },   // Most zoomed out
  { startHour: 7, endHour: 21, hourHeight: 50 },   // Default
  { startHour: 8, endHour: 20, hourHeight: 60 },   // Zoomed in
  { startHour: 9, endHour: 19, hourHeight: 80 },   // Most zoomed in
];

export const ObsidianDayViewWrapper: PreactViewComponent = ({ $app }) => {
  const [zoomLevel, setZoomLevel] = useState(1); // Default to second level
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const currentZoom = ZOOM_LEVELS[zoomLevel];

  useEffect(() => {
    // Subscribe to app events and date changes
    if ($app.calendarEvents?.value) {
      setEvents($app.calendarEvents.value);
    }

    if ($app.datePickerState?.selectedDate?.value) {
      setCurrentDate(new Date($app.datePickerState.selectedDate.value.toString()));
    }
  }, [$app]);

  const zoomIn = () => {
    if (zoomLevel < ZOOM_LEVELS.length - 1) {
      setZoomLevel(zoomLevel + 1);
    }
  };

  const zoomOut = () => {
    if (zoomLevel > 0) {
      setZoomLevel(zoomLevel - 1);
    }
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const renderTimeSlots = () => {
    const slots = [];
    for (let hour = currentZoom.startHour; hour <= currentZoom.endHour; hour++) {
      slots.push(
        <div
          key={hour}
          className="obsidian-day-view__time-slot"
          style={{ height: `${currentZoom.hourHeight}px` }}
        >
          <div className="obsidian-day-view__time-label">
            {formatHour(hour)}
          </div>
          <div className="obsidian-day-view__time-content">
            {renderEventsForHour(hour)}
          </div>
        </div>
      );
    }
    return slots;
  };

  const renderEventsForHour = (hour: number) => {
    const hourEvents = events.filter(event => {
      const eventStart = new Date(event.start);
      const eventHour = eventStart.getHours();
      return eventHour === hour && isSameDay(eventStart, currentDate);
    });

    return hourEvents.map((event, index) => (
      <div
        key={`${event.id}-${index}`}
        className="obsidian-day-view__event"
        style={{ backgroundColor: event.color || '#3b82f6' }}
      >
        <div className="obsidian-day-view__event-title">{event.title}</div>
        <div className="obsidian-day-view__event-time">
          {formatEventTime(event)}
        </div>
      </div>
    ));
  };

  const formatEventTime = (event: CalendarEvent): string => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const formatDate = (date: Date): string => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dayName = days[date.getDay()];
    const dayNumber = date.getDate();
    return { dayName, dayNumber };
  };

  const { dayName, dayNumber } = formatDate(currentDate);

  return (
    <div className="obsidian-day-view">
      {/* Header with date and zoom controls */}
      <div className="obsidian-day-view__header">
        <div className="obsidian-day-view__date">
          <div className="obsidian-day-view__day-name">{dayName}</div>
          <div className="obsidian-day-view__day-number">{dayNumber}</div>
        </div>
        <div className="obsidian-day-view__zoom-controls">
          <button
            className="obsidian-day-view__zoom-btn"
            onClick={zoomOut}
            disabled={zoomLevel === 0}
            title="Zoom out (show more hours)"
          >
            -
          </button>
          <button
            className="obsidian-day-view__zoom-btn"
            onClick={zoomIn}
            disabled={zoomLevel === ZOOM_LEVELS.length - 1}
            title="Zoom in (show fewer hours)"
          >
            +
          </button>
        </div>
      </div>

      {/* Time slots container */}
      <div className="obsidian-day-view__content">
        <div className="obsidian-day-view__time-column">
          {renderTimeSlots()}
        </div>
      </div>
    </div>
  );
};
