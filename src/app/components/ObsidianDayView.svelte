<script lang="ts">
  import { onMount } from "svelte";
  import type { CalendarEvent } from "../types/calendar";
  import type { Task } from "../core/entities";
  import moment from "moment";

  interface Props {
    events?: CalendarEvent[];
    tasks?: Task[];
    selectedDate?: Date;
  }

  // Helper function to get today at midnight
  function getTodayAtMidnight(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  let {
    events = [],
    tasks = [],
    selectedDate = $bindable(getTodayAtMidnight()),
  }: Props = $props();

  // Zoom management
  let zoomLevel = $state(1); // Default zoom level

  onMount(() => {
    // Set default zoom level
    zoomLevel = 1;
  });

  interface ZoomLevel {
    startHour: number;
    endHour: number;
    hourHeight: number;
  }

  const ZOOM_LEVELS: ZoomLevel[] = [
    { startHour: 6, endHour: 22, hourHeight: 40 }, // Most zoomed out
    { startHour: 7, endHour: 21, hourHeight: 50 }, // Default
    { startHour: 8, endHour: 20, hourHeight: 60 }, // Zoomed in
    { startHour: 9, endHour: 19, hourHeight: 80 }, // Most zoomed in
  ];

  let currentZoom = $derived(ZOOM_LEVELS[zoomLevel]);
  let currentDate = $derived(selectedDate);

  // Zoom functions
  function zoomIn() {
    if (zoomLevel < ZOOM_LEVELS.length - 1) {
      zoomLevel++;
    }
  }

  function zoomOut() {
    if (zoomLevel > 0) {
      zoomLevel--;
    }
  }

  const goToPreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    selectedDate = newDate;
  };

  const goToNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    selectedDate = newDate;
  };

  const goToToday = () => {
    selectedDate = getTodayAtMidnight();
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const getEventsForHour = (hour: number): CalendarEvent[] => {
    if (!events || events.length === 0) {
      return [];
    }

    const filteredEvents = events.filter((event) => {
      const eventMoment = moment(event.startDate);
      const currentMoment = moment(currentDate);
      const eventHour = eventMoment.hour();
      const sameDay = eventMoment.isSame(currentMoment, "day");

      return eventHour === hour && sameDay;
    });

    return filteredEvents;
  };

  const formatEventTime = (event: CalendarEvent): string => {
    const start = moment(event.startDate);
    const end = moment(event.endDate);
    return `${start.format("h:mm A")} - ${end.format("h:mm A")}`;
  };

  const formatDate = (date: Date) => {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayName = days[date.getDay()];
    const dayNumber = date.getDate();
    return { dayName, dayNumber };
  };

  let { dayName, dayNumber } = $derived(formatDate(currentDate));

  let timeSlots = $derived(
    (() => {
      const slots = [];
      for (
        let hour = currentZoom.startHour;
        hour <= currentZoom.endHour;
        hour++
      ) {
        slots.push(hour);
      }
      return slots;
    })()
  );

  // Pre-compute events for each hour to avoid dynamic function calls in template
  let eventsByHour = $derived(
    (() => {
      const result: Record<number, CalendarEvent[]> = {};
      if (timeSlots && events && events.length > 0) {
        timeSlots.forEach((hour) => {
          const hourEvents = getEventsForHour(hour);
          result[hour] = hourEvents;
        });
      }
      return result;
    })()
  );
</script>

<div class="obsidian-day-view" data-testid="obsidian-day-view">
  <!-- Header with zoom controls (left), date navigation (center), today button (right) -->
  <div class="obsidian-day-view__header" data-testid="obsidian-day-view-header">
    <!-- Zoom Controls (Left) -->
    <div
      class="obsidian-day-view__zoom-controls"
      data-testid="obsidian-day-view-zoom-controls"
    >
      <button
        class="obsidian-day-view__zoom-btn"
        data-testid="obsidian-day-view-zoom-out-btn"
        onclick={zoomOut}
        disabled={zoomLevel === 0}
        title="Zoom out (show more hours)"
      >
        −
      </button>
      <button
        class="obsidian-day-view__zoom-btn"
        data-testid="obsidian-day-view-zoom-in-btn"
        onclick={zoomIn}
        disabled={zoomLevel === ZOOM_LEVELS.length - 1}
        title="Zoom in (show fewer hours)"
      >
        +
      </button>
    </div>

    <!-- Date Navigation (Center) -->
    <div class="obsidian-day-view__date-navigation">
      <button
        class="obsidian-day-view__nav-btn"
        onclick={goToPreviousDay}
        title="Previous day"
      >
        ←
      </button>
      <div class="obsidian-day-view__date">
        <div class="obsidian-day-view__day-name">{dayName}</div>
        <div class="obsidian-day-view__day-number">{dayNumber}</div>
      </div>
      <button
        class="obsidian-day-view__nav-btn"
        onclick={goToNextDay}
        title="Next day"
      >
        →
      </button>
    </div>

    <!-- Today Button (Right) -->
    <button
      class="obsidian-day-view__today-btn"
      onclick={goToToday}
      title="Go to today"
    >
      Today
    </button>
  </div>

  <!-- Planned Tasks Section (shown when tasks are available) -->
  {#if tasks && tasks.length > 0}
    <div
      class="obsidian-day-view__tasks-section"
      data-testid="obsidian-day-view-tasks"
    >
      <div class="obsidian-day-view__tasks-header">
        <h4>📋 Planned Tasks ({tasks.length})</h4>
      </div>
      <div class="obsidian-day-view__tasks-list">
        {#each tasks as task (task.id)}
          <div
            class="obsidian-day-view__task"
            data-testid="obsidian-day-view-task"
          >
            <div class="obsidian-day-view__task-content">
              <span class="obsidian-day-view__task-title">{task.title}</span>
              {#if task.doDate}
                <span class="obsidian-day-view__task-time">
                  {new Date(task.doDate).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Time slots container -->
  <div
    class="obsidian-day-view__content"
    data-testid="obsidian-day-view-content"
  >
    <div
      class="obsidian-day-view__time-column"
      data-testid="obsidian-day-view-time-column"
    >
      {#each timeSlots as hour}
        <div
          class="obsidian-day-view__time-slot"
          data-testid="obsidian-day-view-time-slot"
          data-hour={hour}
          style="height: {currentZoom.hourHeight}px"
        >
          <div
            class="obsidian-day-view__time-label"
            data-testid="obsidian-day-view-time-label"
          >
            {formatHour(hour)}
          </div>
          <div class="obsidian-day-view__time-content">
            {#each eventsByHour[hour] || [] as event (event.id)}
              <div
                class="obsidian-day-view__event {zoomLevel <= 1
                  ? 'obsidian-day-view__event--compact'
                  : ''}"
                data-testid="obsidian-day-view-event"
                style="background-color: {event.calendar?.color ||
                  '#3b82f6'}; color: white;"
                role="button"
                tabindex="0"
                data-event-id={event.id}
                data-event-title={event.title}
                data-calendar-name={event.calendar?.name}
                data-calendar-color={event.calendar?.color}
              >
                {#if zoomLevel <= 1}
                  <!-- Compact layout for low zoom levels -->
                  <div
                    class="obsidian-day-view__event-content-compact"
                    data-testid="obsidian-day-view-event-content-compact"
                  >
                    <span
                      class="obsidian-day-view__event-title"
                      data-testid="obsidian-day-view-event-title"
                      >{event.title}</span
                    >
                    <span
                      class="obsidian-day-view__event-time"
                      data-testid="obsidian-day-view-event-time"
                      >{formatEventTime(event)}</span
                    >
                  </div>
                {:else}
                  <!-- Standard layout for higher zoom levels -->
                  <div
                    class="obsidian-day-view__event-title"
                    data-testid="obsidian-day-view-event-title"
                  >
                    {event.title}
                  </div>
                  <div
                    class="obsidian-day-view__event-time"
                    data-testid="obsidian-day-view-event-time"
                  >
                    {formatEventTime(event)}
                  </div>
                {/if}

                <!-- Event overlay with actions -->
                <div
                  class="obsidian-day-view__event-overlay"
                  data-testid="obsidian-day-view-event-overlay"
                >
                  <div
                    class="obsidian-day-view__event-actions"
                    data-testid="obsidian-day-view-event-actions"
                  >
                    <!-- Event actions removed for simplified calendar view -->
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .obsidian-day-view__tasks-section {
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    padding: 16px;
    margin-bottom: 8px;
  }

  .obsidian-day-view__tasks-header h4 {
    margin: 0 0 12px 0;
    color: var(--text-normal);
    font-size: 16px;
    font-weight: 600;
  }

  .obsidian-day-view__tasks-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .obsidian-day-view__task {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 12px;
    transition: background-color 0.2s ease;
  }

  .obsidian-day-view__task:hover {
    background: var(--background-modifier-hover);
  }

  .obsidian-day-view__task-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .obsidian-day-view__task-title {
    color: var(--text-normal);
    font-weight: 500;
    flex: 1;
  }

  .obsidian-day-view__task-time {
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 400;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .obsidian-day-view__task-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }
</style>
