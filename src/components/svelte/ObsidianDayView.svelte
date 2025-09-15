<script lang="ts">
  import { onMount } from "svelte";
  import type { CalendarEvent } from "../../types/calendar";
  import moment from "moment";

  import { getPluginContext } from "./context";

  interface Props {
    events?: CalendarEvent[];
    selectedDate?: Date;
    onImportEvent?: ((event: CalendarEvent) => Promise<void>) | null;
    importedEvents?: Set<string>;
    importingEvents?: Set<string>;
    isDailyPlanningMode?: boolean;
  }

  let {
    events = [],
    selectedDate = new Date(),
    onImportEvent = null,
    importedEvents = new Set(),
    importingEvents = new Set(),
    isDailyPlanningMode = false,
  }: Props = $props();

  // Modal state for event details
  let showEventModal = $state(false);
  let selectedEventForModal = $state<CalendarEvent | null>(null);

  // Zoom management
  let zoomLevel = $state(1); // Default zoom level

  // Calculate optimal zoom level based on time increment
  function calculateOptimalZoomLevel(timeIncrement: number): number {
    // For smaller time increments, we need more space (higher zoom)
    // For larger time increments, we can use less space (lower zoom)
    if (timeIncrement <= 15) {
      return 3; // Most zoomed in for 15-minute increments
    } else if (timeIncrement <= 30) {
      return 2; // Zoomed in for 30-minute increments
    } else if (timeIncrement <= 60) {
      return 1; // Default for 60-minute increments
    } else {
      return 0; // Most zoomed out for larger increments
    }
  }

  onMount(async () => {
    console.log("🔍 ObsidianDayView mounted!");
    console.log("🔍 Events on mount:", events);
    console.log("🔍 Selected date on mount:", selectedDate);

    // Load zoom level from settings
    try {
      const { plugin } = getPluginContext();
      const savedZoomLevel = plugin.settings.appleCalendarIntegration.zoomLevel;
      if (savedZoomLevel !== undefined) {
        zoomLevel = savedZoomLevel;
      } else {
        // Calculate optimal zoom based on time increment
        zoomLevel = calculateOptimalZoomLevel(
          plugin.settings.appleCalendarIntegration.timeIncrement
        );
      }
      console.log("🔍 Zoom level on mount:", zoomLevel);
    } catch (error) {
      console.error("Failed to load zoom level from settings:", error);
    }
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

  // Debug reactive statements
  $effect(() => {
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
  });

  // Zoom functions
  function zoomIn() {
    if (zoomLevel < ZOOM_LEVELS.length - 1) {
      zoomLevel++;
      saveZoomLevel();
    }
  }

  function zoomOut() {
    if (zoomLevel > 0) {
      zoomLevel--;
      saveZoomLevel();
    }
  }

  // Save zoom level to settings
  async function saveZoomLevel() {
    try {
      const { plugin } = getPluginContext();
      plugin.settings.appleCalendarIntegration.zoomLevel = zoomLevel;
      await plugin.saveSettings();
    } catch (error) {
      console.error("Failed to save zoom level:", error);
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
    selectedDate = new Date();
  };

  const openEventModal = (event: CalendarEvent) => {
    selectedEventForModal = event;
    showEventModal = true;
  };

  const closeEventModal = () => {
    showEventModal = false;
    selectedEventForModal = null;
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

<div class="obsidian-day-view">
  <!-- Header with zoom controls (left), date navigation (center), today button (right) -->
  <div class="obsidian-day-view__header">
    <!-- Zoom Controls (Left) -->
    <div class="obsidian-day-view__zoom-controls">
      <button
        class="obsidian-day-view__zoom-btn"
        onclick={zoomOut}
        disabled={zoomLevel === 0}
        title="Zoom out (show more hours)"
      >
        −
      </button>
      <button
        class="obsidian-day-view__zoom-btn"
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
                class="obsidian-day-view__event {zoomLevel <= 1
                  ? 'obsidian-day-view__event--compact'
                  : ''}"
                style="background-color: {event.calendar?.color || '#3b82f6'}"
                role="button"
                tabindex="0"
              >
                {#if zoomLevel <= 1}
                  <!-- Compact layout for low zoom levels -->
                  <div class="obsidian-day-view__event-content-compact">
                    <span class="obsidian-day-view__event-title"
                      >{event.title}</span
                    >
                    <span class="obsidian-day-view__event-time"
                      >{formatEventTime(event)}</span
                    >
                  </div>
                {:else}
                  <!-- Standard layout for higher zoom levels -->
                  <div class="obsidian-day-view__event-title">
                    {event.title}
                  </div>
                  <div class="obsidian-day-view__event-time">
                    {formatEventTime(event)}
                  </div>
                {/if}

                <!-- Event overlay with actions -->
                <div class="obsidian-day-view__event-overlay">
                  <div class="obsidian-day-view__event-actions">
                    <button
                      class="obsidian-day-view__action-btn obsidian-day-view__open-btn"
                      onclick={(e) => {
                        e.stopPropagation();
                        openEventModal(event);
                      }}
                      title="View event details"
                    >
                      Open
                    </button>
                    {#if onImportEvent}
                      <button
                        class="obsidian-day-view__action-btn obsidian-day-view__import-btn"
                        disabled={importedEvents.has(event.id) ||
                          importingEvents.has(event.id)}
                        onclick={(e) => {
                          e.stopPropagation();
                          onImportEvent?.(event);
                        }}
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
                    {/if}
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

<!-- Event Details Modal -->
{#if showEventModal && selectedEventForModal}
  <div
    class="obsidian-day-view__modal-backdrop"
    onclick={closeEventModal}
    role="dialog"
    aria-modal="true"
    aria-labelledby="event-modal-title"
  >
    <div
      class="obsidian-day-view__modal"
      onclick={(e) => e.stopPropagation()}
      role="document"
    >
      <div class="obsidian-day-view__modal-header">
        <h3 id="event-modal-title" class="obsidian-day-view__modal-title">
          Event Details
        </h3>
        <button
          class="obsidian-day-view__modal-close"
          onclick={closeEventModal}
          title="Close"
        >
          ×
        </button>
      </div>

      <div class="obsidian-day-view__modal-content">
        <div class="obsidian-day-view__modal-field">
          <label>Title:</label>
          <span>{selectedEventForModal.title}</span>
        </div>

        <div class="obsidian-day-view__modal-field">
          <label>Time:</label>
          <span>{formatEventTime(selectedEventForModal)}</span>
        </div>

        {#if selectedEventForModal.location}
          <div class="obsidian-day-view__modal-field">
            <label>Location:</label>
            <span>{selectedEventForModal.location}</span>
          </div>
        {/if}

        {#if selectedEventForModal.description}
          <div class="obsidian-day-view__modal-field">
            <label>Description:</label>
            <span>{selectedEventForModal.description}</span>
          </div>
        {/if}

        <div class="obsidian-day-view__modal-field">
          <label>Calendar:</label>
          <span
            style="color: {selectedEventForModal.calendar?.color || '#3b82f6'}"
          >
            {selectedEventForModal.calendar?.name || "Unknown"}
          </span>
        </div>

        <div class="obsidian-day-view__modal-field">
          <label>All Day:</label>
          <span>{selectedEventForModal.allDay ? "Yes" : "No"}</span>
        </div>
      </div>
    </div>
  </div>
{/if}
