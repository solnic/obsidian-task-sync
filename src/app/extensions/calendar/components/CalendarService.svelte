<script lang="ts">
  /**
   * CalendarService component for the new architecture
   * Provides calendar event viewing functionality as a service tab
   */

  import { onMount } from "svelte";
  import { derived } from "svelte/store";
  import SearchInput from "../../../components/SearchInput.svelte";
  import FilterButton from "../../../components/FilterButton.svelte";
  import ObsidianDayView from "../../../components/ObsidianDayView.svelte";
  import TabView from "../../../components/TabView.svelte";
  import type { Task } from "../../../core/entities";
  import type { TaskSyncSettings } from "../../../types/settings";
  import type { Extension } from "../../../core/extension";
  import type { Host } from "../../../core/host";
  import type { CalendarEvent, Calendar } from "../../../types/calendar";
  import type { CalendarExtension } from "../CalendarExtension";
  import type { DailyPlanningExtension } from "../../daily-planning/DailyPlanningExtension";

  interface Props {
    settings: TaskSyncSettings;
    extension: Extension;
    host: Host;
    isPlanningActive?: boolean;
    dailyPlanningExtension?: DailyPlanningExtension;
    stagedTaskIds?: Set<string>;
    onStageTask?: (task: Task) => void;
    testId?: string;
  }

  let {
    settings,
    extension,
    host,
    isPlanningActive = false,
    dailyPlanningExtension,
    stagedTaskIds = new Set(),
    onStageTask,
    testId,
  }: Props = $props();

  // Cast extension to CalendarExtension for type safety
  const calendarExtension = extension as CalendarExtension;

  // ============================================================================
  // REACTIVE STATE - UI state only (data comes from extension)
  // ============================================================================

  // Search query (part of filtering)
  let searchQuery = $state("");

  // Selected date for day view
  let selectedDate = $state(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    )
  );

  // ============================================================================
  // UI STATE
  // ============================================================================

  let availableCalendars = $state<Calendar[]>([]);
  let selectedCalendarIds = $state<string[]>([]);
  let calendarEvents = $state<CalendarEvent[]>([]);
  let filteredEvents = $state<CalendarEvent[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // ============================================================================
  // DATA PROCESSING
  // ============================================================================

  /**
   * Calendar filter options for FilterButton
   */
  let calendarFilterOptions = $derived([
    "All calendars",
    ...availableCalendars.map((cal) => cal.name),
  ]);

  /**
   * Selected calendar names for FilterButton
   */
  let selectedCalendarNames = $derived(
    availableCalendars
      .filter((cal) => selectedCalendarIds.includes(cal.id))
      .map((cal) => cal.name)
  );

  /**
   * Current calendar filter display value
   */
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

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Load available calendars from the extension
   */
  async function loadCalendars(): Promise<void> {
    if (!calendarExtension) {
      error = "Calendar extension is not available.";
      return;
    }

    const enabledServices = calendarExtension.getEnabledCalendarServices();
    if (enabledServices.length === 0) {
      error =
        "No calendar services are enabled. Please enable Apple Calendar or Google Calendar integration in Settings.";
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
        const appleCalendarSettings = settings.integrations?.appleCalendar;
        const googleCalendarSettings = settings.integrations?.googleCalendar;

        // Combine selected calendars from both Apple and Google settings
        const selectedCalendarNames: string[] = [];

        if (appleCalendarSettings?.selectedCalendars?.length > 0) {
          selectedCalendarNames.push(...appleCalendarSettings.selectedCalendars);
        }

        if (googleCalendarSettings?.selectedCalendars?.length > 0) {
          selectedCalendarNames.push(...googleCalendarSettings.selectedCalendars);
        }

        if (selectedCalendarNames.length > 0) {
          selectedCalendarIds = calendars
            .filter((cal: Calendar) =>
              selectedCalendarNames.includes(cal.name) ||
              selectedCalendarNames.includes(cal.id)
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

  /**
   * Load calendar events for a specific date
   */
  async function loadEvents(targetDate?: Date): Promise<void> {
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

  /**
   * Handle calendar filter selection (multi-select)
   */
  function handleCalendarFilterSelect(calendarName: string): void {
    if (calendarName === "All calendars") {
      // Toggle between all calendars and no calendars
      if (
        selectedCalendarIds.length === availableCalendars.length ||
        selectedCalendarIds.length === 0
      ) {
        selectedCalendarIds = [];
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
    // loadEvents will be called by the reactive effect when selectedCalendarIds changes
  }

  /**
   * Search events by query string
   */
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

  /**
   * Handle refresh
   */
  async function handleRefresh(): Promise<void> {
    await loadCalendars();
  }

  // ============================================================================
  // REACTIVE EFFECTS
  // ============================================================================

  /**
   * Reactive filtering of events
   */
  $effect(() => {
    filteredEvents = searchEvents(searchQuery, calendarEvents);
  });

  /**
   * Reactive effect to reload events when selectedDate or calendar selection changes
   * Consolidates the two separate effects to prevent redundant API calls
   */
  $effect(() => {
    // Only load events if we have calendars and we're not already loading
    if (availableCalendars.length > 0 && selectedCalendarIds && !isLoading) {
      loadEvents(selectedDate);
    }
  });

  /**
   * Initialize on mount
   */
  onMount(() => {
    loadCalendars();
  });
</script>

<div class="task-sync-service-container" data-testid={testId}>
  <!-- Header Section -->
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
          onRefresh={handleRefresh}
        />
      </div>

      <div class="task-sync-filter-row">
        <div class="task-sync-filter-group">
          {#if isLoading && availableCalendars.length === 0}
            <div class="task-sync-loading-indicator">Loading calendars...</div>
          {:else if error}
            <div class="task-sync-error-message">
              {error}
              <br /><br />
              <strong>To enable Calendar integration:</strong>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Go to Settings → Integrations</li>
                <li>
                  <strong>For Apple Calendar:</strong>
                  <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>Enable "Apple Calendar Integration"</li>
                    <li>Enter your Apple ID email</li>
                    <li>Enter your App-Specific Password</li>
                  </ul>
                </li>
                <li>
                  <strong>For Google Calendar:</strong>
                  <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>Enable "Google Calendar Integration"</li>
                    <li>Complete OAuth authentication</li>
                    <li>Select calendars to sync</li>
                  </ul>
                </li>
              </ol>
              <em
                >Note: For Apple Calendar, you'll need to generate an
                App-Specific Password from your Apple ID account settings.</em
              >
            </div>
          {:else if availableCalendars.length === 0}
            <div class="task-sync-empty-message">
              No calendars available. Please check your calendar integration settings.
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

  .task-sync-loading-indicator {
    padding: 12px;
    color: var(--text-muted);
    font-style: italic;
  }

  .task-sync-error-message {
    padding: 16px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
  }

  .task-sync-empty-message {
    padding: 16px;
    color: var(--text-muted);
    text-align: center;
  }
</style>
