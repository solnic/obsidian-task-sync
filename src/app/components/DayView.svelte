<script lang="ts">
  import { onMount } from "svelte";
  import ObsidianDayView from "./ObsidianDayView.svelte";
  import "temporal-polyfill/global";
  import TabView from "./TabView.svelte";
  import FilterButton from "./FilterButton.svelte";
  import SearchInput from "./SearchInput.svelte";

  import type { Calendar, CalendarEvent } from "../types/calendar";
  import type { CalendarExtension } from "../extensions/CalendarExtension";
  import type { Host } from "../core/host";
  import type { TaskSyncSettings } from "../types/settings";
  import { isPlanningActive } from "../stores/dailyPlanningStore";

  // Props
  interface Props {
    host: Host;
    settings: TaskSyncSettings;
  }

  let { host, settings }: Props = $props();

  // Get extensions from host - simple, direct lookup
  let calendarExtension = $derived(
    host.getExtensionById("calendar") as CalendarExtension | undefined
  );

  // Day View should NOT subscribe to staged tasks - those belong in Daily Planning wizard only

  // State
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let availableCalendars = $state<Calendar[]>([]);
  let selectedCalendarIds = $state<string[]>([]);
  let calendarEvents = $state<CalendarEvent[]>([]);
  let filteredEvents = $state<CalendarEvent[]>([]);
  let searchQuery = $state("");
  // Set selectedDate to today at midnight to avoid time comparison issues
  let selectedDate = $state(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    )
  );

  // Day View should NOT display any tasks - only calendar events
  // Tasks are handled by the Daily Planning wizard

  // Load available calendars
  async function loadCalendars() {
    if (!calendarExtension) {
      error = "Calendar extension is not available.";
      return;
    }

    const enabledServices = calendarExtension.getEnabledCalendarServices();
    if (enabledServices.length === 0) {
      error =
        "No calendar services are enabled. Please enable calendar integration in Settings.";
      return;
    }

    try {
      isLoading = true;
      error = null;

      // Subscribe to calendars from the extension
      const calendarsStore = calendarExtension.getCalendars();
      calendarsStore.subscribe((calendars) => {
        availableCalendars = calendars;

        // Pre-select calendars based on settings
        if (
          settings.integrations?.appleCalendar?.selectedCalendars?.length > 0
        ) {
          selectedCalendarIds = calendars
            .filter((cal: Calendar) =>
              settings.integrations.appleCalendar.selectedCalendars.includes(
                cal.name
              )
            )
            .map((cal: Calendar) => cal.id);
        } else {
          // Select all calendars by default
          selectedCalendarIds = calendars.map((cal: Calendar) => cal.id);
        }
      });

      // Trigger refresh to load calendars
      await calendarExtension.refresh();
      await loadEvents();
    } catch (err: any) {
      error = `Failed to load calendars: ${err.message}`;
    } finally {
      isLoading = false;
    }
  }

  // Load calendar events for a specific date
  async function loadEvents(targetDate?: Date) {
    if (!calendarExtension) {
      error = "Calendar extension is not available.";
      return;
    }

    try {
      isLoading = true;
      error = null;

      const dateToUse = targetDate || selectedDate;
      const startDate = new Date(dateToUse);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(dateToUse);
      endDate.setHours(23, 59, 59, 999);

      const events = await calendarExtension.getEventsForDateRange(
        startDate,
        endDate
      );

      calendarEvents = events;
    } catch (err: any) {
      error = `Failed to load events: ${err.message}`;
    } finally {
      isLoading = false;
    }
  }

  // Calendar filter options for FilterButton
  let calendarFilterOptions = $derived([
    "All calendars",
    ...availableCalendars.map((cal) => cal.name),
  ]);

  // Selected calendar names for FilterButton
  let selectedCalendarNames = $derived(
    availableCalendars
      .filter((cal) => selectedCalendarIds.includes(cal.id))
      .map((cal) => cal.name)
  );

  // Current calendar filter display value
  let currentCalendarFilterValue = $derived.by(() => {
    if (
      selectedCalendarIds.length === 0 ||
      selectedCalendarIds.length === availableCalendars.length
    ) {
      return "All calendars";
    } else if (selectedCalendarIds.length === 1) {
      const calendar = availableCalendars.find(
        (cal) => cal.id === selectedCalendarIds[0]
      );
      return calendar?.name || "1 calendar";
    } else {
      return `${selectedCalendarIds.length} calendars`;
    }
  });

  // Handle calendar filter selection (multi-select)
  function handleCalendarFilterSelect(calendarName: string) {
    if (calendarName === "All calendars") {
      // Toggle between all calendars and no calendars
      if (
        selectedCalendarIds.length === availableCalendars.length ||
        selectedCalendarIds.length === 0
      ) {
        selectedCalendarIds = []; // Will be treated as "all calendars" in loadEvents
      } else {
        selectedCalendarIds = availableCalendars.map((cal) => cal.id);
      }
    } else {
      const calendar = availableCalendars.find(
        (cal) => cal.name === calendarName
      );
      if (calendar) {
        const isSelected = selectedCalendarIds.includes(calendar.id);
        if (isSelected) {
          // Remove from selection
          selectedCalendarIds = selectedCalendarIds.filter(
            (id) => id !== calendar.id
          );
        } else {
          // Add to selection
          selectedCalendarIds = [...selectedCalendarIds, calendar.id];
        }
      }
    }
    loadEvents();
  }

  // Zoom controls are now handled by ObsidianDayView

  // Search functionality
  function searchEvents(
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

  // Reactive filtering
  $effect(() => {
    filteredEvents = searchEvents(searchQuery, calendarEvents);
  });

  // Reactive effect to reload events when selectedDate changes
  $effect(() => {
    if (availableCalendars.length > 0) {
      loadEvents(selectedDate);
    }
  });

  // Separate effect to reload events when calendar selection changes
  $effect(() => {
    if (availableCalendars.length > 0 && selectedCalendarIds) {
      loadEvents(selectedDate);
    }
  });

  // Load test events for debugging
  function loadTestEvents() {
    const today = new Date();
    const testEvents = [
      {
        id: "test-1",
        title: "Morning Meeting",
        startDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          9,
          0
        ), // 9:00 AM today
        endDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          10,
          0
        ), // 10:00 AM today
        description: "This is a test event",
        location: "Test Location",
        allDay: false,
        calendar: {
          id: "test-cal",
          name: "Test Calendar",
          visible: true,
          color: "#3b82f6",
        },
      },
      {
        id: "test-2",
        title: "Lunch Break",
        startDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          12,
          0
        ), // 12:00 PM today
        endDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          13,
          0
        ), // 1:00 PM today
        description: "Lunch time",
        location: "Cafeteria",
        allDay: false,
        calendar: {
          id: "test-cal",
          name: "Test Calendar",
          visible: true,
          color: "#10b981",
        },
      },
      {
        id: "test-3",
        title: "Afternoon Call",
        startDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          15,
          30
        ), // 3:30 PM today
        endDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          16,
          30
        ), // 4:30 PM today
        description: "Important call",
        location: "Office",
        allDay: false,
        calendar: {
          id: "test-cal",
          name: "Test Calendar",
          visible: true,
          color: "#f59e0b",
        },
      },
    ];

    console.log("Test events created:", testEvents);
    calendarEvents = testEvents;
  }

  // Initialize on mount
  onMount(() => {
    loadCalendars();
  });
</script>

<div class="task-planning-view" data-testid="task-planning-view">
  <TabView className="day-view-tab" testId="day-view-tab">
    <!-- Daily Planning Header -->
    {#if $isPlanningActive}
      <div class="planning-header" data-testid="planning-header">
        <div class="planning-info">
          <h3>📅 Daily Planning Mode - Day View</h3>
          <p>
            Day View shows calendar events only. Use the Daily Planning wizard
            to manage tasks.
          </p>
        </div>
        <div class="planning-actions">
          <span class="planning-hint"
            >Tasks are managed in the Daily Planning wizard, not in Day View</span
          >
        </div>
      </div>
    {/if}

    <!-- Header Section with Filters -->
    <div class="task-planning-header">
      <!-- Filter Section -->
      <div class="task-sync-filter-section">
        <!-- Search Input -->
        <div class="search-and-filters">
          <SearchInput
            service="calendar"
            bind:value={searchQuery}
            placeholder="Search calendar events..."
            onInput={(value) => (searchQuery = value)}
          />
        </div>

        <div class="task-sync-filter-row">
          <div class="task-sync-filter-group">
            {#if isLoading && availableCalendars.length === 0}
              <div class="task-sync-loading-indicator">
                Loading calendars...
              </div>
            {:else if error}
              <div class="task-sync-error-message">
                {error}
                <br /><br />
                <strong>To enable Calendar integration:</strong>
                <ol style="margin: 10px 0; padding-left: 20px;">
                  <li>Go to Settings → Integrations</li>
                  <li>Enable "Apple Calendar Integration"</li>
                  <li>Enter your Apple ID email</li>
                  <li>Enter your App-Specific Password</li>
                </ol>
                <em
                  >Note: You'll need to generate an App-Specific Password from
                  your Apple ID account settings.</em
                >
                <br /><br />
                <button
                  class="mod-muted"
                  onclick={loadTestEvents}
                  style="margin-top: 10px;"
                >
                  Load Test Events
                </button>
              </div>
            {:else if availableCalendars.length === 0}
              <div class="task-sync-empty-message">
                No calendars available. Please check your Apple Calendar
                integration settings.
              </div>
            {:else}
              <FilterButton
                label="Calendars"
                currentValue={currentCalendarFilterValue}
                options={calendarFilterOptions}
                onselect={handleCalendarFilterSelect}
                placeholder="All calendars"
                testId="calendar-filter"
                autoSuggest={true}
                isActive={selectedCalendarIds.length > 0}
                selectedOptions={selectedCalendarNames}
                keepMenuOpen={true}
              />

              <!-- Zoom controls moved to ObsidianDayView header -->
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Content Section -->
    <div class="task-sync-task-list-container">
      <div class="calendar-wrapper">
        <ObsidianDayView events={filteredEvents} tasks={[]} bind:selectedDate />
      </div>
    </div>
  </TabView>
</div>

<style>
  .task-planning-header {
    padding: 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
  }

  .task-sync-filter-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .search-and-filters {
    width: 100%;
  }

  .task-sync-filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .task-sync-filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .calendar-wrapper {
    padding: 0;
  }

  .task-sync-task-list-container {
    flex: 1;
    overflow: hidden;
  }

  .planning-header {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 16px;
    margin: 16px;
    margin-bottom: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .planning-info h3 {
    margin: 0 0 4px 0;
    color: var(--text-normal);
    font-size: 16px;
    font-weight: 600;
  }

  .planning-info p {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }

  .planning-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .planning-hint {
    color: var(--text-muted);
    font-size: 14px;
    font-style: italic;
  }

  @media (max-width: 768px) {
    .planning-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .planning-actions {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
