<script lang="ts">
  import { onMount } from "svelte";
  import type { CalendarEvent } from "../../types/calendar";
  import moment from "moment";

  export let events: CalendarEvent[] = [];
  export let selectedDate: Date = new Date();
  export let onImportEvent: ((event: CalendarEvent) => Promise<void>) | null =
    null;
  export let importedEvents: Set<string> = new Set();
  export let importingEvents: Set<string> = new Set();
  export let isDailyPlanningMode: boolean = false;

  onMount(() => {
    console.log("🔍 ObsidianDayView mounted!");
    console.log("🔍 Events on mount:", events);
    console.log("🔍 Selected date on mount:", selectedDate);
    console.log("🔍 Zoom level on mount:", zoomLevel);
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

  let zoomLevel = 1; // Default to second level

  $: currentZoom = ZOOM_LEVELS[zoomLevel];
  $: currentDate = selectedDate;

  // Debug reactive statements
  $: {
    console.log(`🔍 ObsidianDayView - Events: ${events.length} events`);
    console.log(`🔍 ObsidianDayView - Selected Date: ${selectedDate}`);
    console.log(`🔍 ObsidianDayView - Current Date: ${currentDate}`);
    console.log(`🔍 ObsidianDayView - Zoom Level: ${zoomLevel}`);
    console.log(`🔍 ObsidianDayView - Current Zoom:`, currentZoom);
    if (events.length > 0) {
      console.log(`🔍 First event:`, events[0]);
      console.log(`🔍 First event startDate:`, events[0].startDate);
      console.log(`🔍 First event startDate type:`, typeof events[0].startDate);
      console.log(
        `🔍 First event moment:`,
        moment(events[0].startDate).format("YYYY-MM-DD HH:mm Z")
      );
    }
  }

  const zoomIn = () => {
    if (zoomLevel < ZOOM_LEVELS.length - 1) {
      zoomLevel++;
    }
  };

  const zoomOut = () => {
    if (zoomLevel > 0) {
      zoomLevel--;
    }
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const getEventsForHour = (hour: number): CalendarEvent[] => {
    if (!events || events.length === 0) return [];

    const filteredEvents = events.filter((event) => {
      const eventMoment = moment(event.startDate);
      const eventHour = eventMoment.hour();
      const sameDay = eventMoment.isSame(moment(currentDate), "day");

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

  $: ({ dayName, dayNumber } = formatDate(currentDate));

  $: timeSlots = (() => {
    const slots = [];
    for (
      let hour = currentZoom.startHour;
      hour <= currentZoom.endHour;
      hour++
    ) {
      slots.push(hour);
    }
    return slots;
  })();

  // Pre-compute events for each hour to avoid dynamic function calls in template
  let eventsByHour: Record<number, CalendarEvent[]> = {};

  $: {
    eventsByHour = {};
    if (timeSlots && events && events.length > 0) {
      timeSlots.forEach((hour) => {
        const hourEvents = getEventsForHour(hour);
        eventsByHour[hour] = hourEvents;
      });
    }
  }
</script>

<div class="obsidian-day-view">
  <!-- Header with date and zoom controls -->
  <div class="obsidian-day-view__header">
    <div class="obsidian-day-view__date">
      <div class="obsidian-day-view__day-name">{dayName}</div>
      <div class="obsidian-day-view__day-number">{dayNumber}</div>
    </div>
    <div class="obsidian-day-view__zoom-controls">
      <button
        class="obsidian-day-view__zoom-btn"
        on:click={zoomOut}
        disabled={zoomLevel === 0}
        title="Zoom out (show more hours)"
      >
        -
      </button>
      <button
        class="obsidian-day-view__zoom-btn"
        on:click={zoomIn}
        disabled={zoomLevel === ZOOM_LEVELS.length - 1}
        title="Zoom in (show fewer hours)"
      >
        +
      </button>
    </div>
  </div>

  <!-- Time slots container -->
  <div class="obsidian-day-view__content">
    <div class="obsidian-day-view__time-column">
      {#each timeSlots as hour}
        <div
          class="obsidian-day-view__time-slot"
          style="height: {currentZoom.hourHeight}px"
        >
          <div class="obsidian-day-view__time-label">
            {formatHour(hour)}
          </div>
          <div class="obsidian-day-view__time-content">
            {#each eventsByHour[hour] || [] as event (event.id)}
              <div
                class="obsidian-day-view__event"
                style="background-color: {event.calendar?.color || '#3b82f6'}"
                role="button"
                tabindex="0"
              >
                <div class="obsidian-day-view__event-title">{event.title}</div>
                <div class="obsidian-day-view__event-time">
                  {formatEventTime(event)}
                </div>

                <!-- Import overlay -->
                {#if onImportEvent}
                  <div class="obsidian-day-view__event-overlay">
                    <button
                      class="obsidian-day-view__import-btn"
                      disabled={importedEvents.has(event.id) ||
                        importingEvents.has(event.id)}
                      on:click|stopPropagation={() => onImportEvent?.(event)}
                    >
                      {#if importedEvents.has(event.id)}
                        {isDailyPlanningMode
                          ? "✓ Added to today"
                          : "✓ Imported"}
                      {:else if importingEvents.has(event.id)}
                        {isDailyPlanningMode
                          ? "⏳ Adding..."
                          : "⏳ Importing..."}
                      {:else}
                        {isDailyPlanningMode ? "Add to today" : "Import"}
                      {/if}
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
