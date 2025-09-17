<script lang="ts">
  import { onMount } from "svelte";
  import ObsidianDayView from "./ObsidianDayView.svelte";
  import "temporal-polyfill/global";
  import TabView from "./TabView.svelte";
  import FilterButton from "./FilterButton.svelte";
  import SearchInput from "./SearchInput.svelte";
  import { getPluginContext, currentFileContext } from "./context";
  import { Notice } from "obsidian";
  import type { AppleCalendarService } from "../../services/AppleCalendarService";
  import type { AppleCalendarIntegrationSettings } from "../ui/settings/types";
  import type { Calendar, CalendarEvent } from "../../types/calendar";
  import type { TaskImportConfig } from "../../types/integrations";
  import type { FileContext } from "../../main";

  // Props
  interface Props {
    appleCalendarService: AppleCalendarService;
    settings: {
      appleCalendarIntegration: AppleCalendarIntegrationSettings;
    };
  }

  let { appleCalendarService, settings }: Props = $props();

  const { plugin } = getPluginContext();

  // Get current context reactively
  let currentContext: FileContext = $state({ type: "none" });

  // Subscribe to context changes
  currentFileContext.subscribe((context) => {
    currentContext = context;
  });

  // Computed properties - removed unused shouldShowOverlays

  let isDailyPlanningMode = $derived(currentContext.type === "daily");

  // State
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let availableCalendars = $state<Calendar[]>([]);
  let selectedCalendarIds = $state<string[]>([]);
  let calendarEvents = $state<CalendarEvent[]>([]);
  let filteredEvents = $state<CalendarEvent[]>([]);
  let searchQuery = $state("");
  // Zoom level is now managed by ObsidianDayView
  // Set selectedDate to today at midnight to avoid time comparison issues
  let selectedDate = $state(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    )
  );

  // Event import state
  let importedEvents = $state<Set<string>>(new Set());
  let importingEvents = $state<Set<string>>(new Set());

  // Load available calendars
  async function loadCalendars() {
    if (!appleCalendarService.isEnabled()) {
      error =
        "Apple Calendar integration is not enabled. Please enable it in Settings → Integrations.";
      return;
    }

    try {
      isLoading = true;
      error = null;

      const calendars = await appleCalendarService.getCalendars();
      availableCalendars = calendars;

      // Pre-select calendars based on settings
      if (settings.appleCalendarIntegration.selectedCalendars.length > 0) {
        selectedCalendarIds = calendars
          .filter((cal) =>
            settings.appleCalendarIntegration.selectedCalendars.includes(
              cal.name
            )
          )
          .map((cal) => cal.id);
      } else {
        // Select all calendars by default
        selectedCalendarIds = calendars.map((cal) => cal.id);
      }

      await loadEvents();
    } catch (err: any) {
      error = `Failed to load calendars: ${err.message}`;
    } finally {
      isLoading = false;
    }
  }

  // Check for previously imported events
  async function checkPreviouslyImportedEvents() {
    if (!plugin || calendarEvents.length === 0) {
      return;
    }

    try {
      // Get all tasks from the task store
      const tasks = plugin.getCachedTasks();

      // Check which calendar events have already been imported
      const newImportedEvents = new Set<string>();

      for (const event of calendarEvents) {
        // Look for tasks with matching source information
        // For calendar events, check both old format (name) and new format (calendar)
        const matchingTask = tasks.find(
          (task: any) =>
            (task.source?.calendar === event.calendar.name ||
              task.source?.name === event.calendar.name) &&
            task.source?.key === event.id
        );

        if (matchingTask) {
          newImportedEvents.add(event.id);
        }
      }

      importedEvents = newImportedEvents;
    } catch (err: any) {
      console.warn("Failed to check previously imported events:", err);
    }
  }

  // Load calendar events for a specific date
  async function loadEvents(targetDate?: Date) {
    try {
      isLoading = true;
      error = null;

      const dateToUse = targetDate || selectedDate;
      const startDate = new Date(dateToUse);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(dateToUse);
      endDate.setHours(23, 59, 59, 999);

      // If no calendars are selected, use all available calendars
      const calendarIdsToUse =
        selectedCalendarIds.length === 0
          ? availableCalendars.map((cal) => cal.id)
          : selectedCalendarIds;

      const events = await appleCalendarService.getEvents(
        calendarIdsToUse,
        startDate,
        endDate
      );

      calendarEvents = events;

      // Check for previously imported events
      setTimeout(() => {
        checkPreviouslyImportedEvents();
      }, 200);
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

  // Open plugin settings
  function openSettings() {
    const app = (window as any).app;
    if (app && app.setting) {
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    }
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

  // Import calendar event as task
  async function importEvent(event: CalendarEvent): Promise<void> {
    try {
      importingEvents.add(event.id);
      importingEvents = new Set(importingEvents); // Trigger reactivity

      // Get default import configuration
      const config: TaskImportConfig = plugin.getDefaultImportConfig();

      // In daily planning mode, add to today's daily note
      if (isDailyPlanningMode) {
        config.addToToday = true;
      }

      // Import the event as a task
      const result = await appleCalendarService.importEventAsTask(
        event,
        config
      );

      if (result.success) {
        importedEvents.add(event.id);
        importedEvents = new Set(importedEvents); // Trigger reactivity

        const message = isDailyPlanningMode
          ? `Added "${event.title}" to today's daily note`
          : `Imported "${event.title}" as a task`;
        new Notice(message);

        // Event imported successfully
      } else {
        new Notice(
          `Failed to import event: ${result.error || "Unknown error"}`
        );
      }
    } catch (err: any) {
      console.error("Error importing event:", err);
      new Notice(`Error importing event: ${err.message || "Unknown error"}`);
    } finally {
      importingEvents.delete(event.id);
      importingEvents = new Set(importingEvents); // Trigger reactivity

      // Import completed
    }
  }

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

    // Check for previously imported events
    setTimeout(() => {
      checkPreviouslyImportedEvents();
    }, 200);
  }

  // Initialize on mount
  onMount(() => {
    loadCalendars();
  });
</script>

<div class="task-planning-view" data-testid="task-planning-view">
  <TabView
    className="task-planning-view-tab"
    testId="task-planning-view-tab"
    showContextWidget={true}
    isNonLocalService={true}
    serviceName="Task Planning"
  >
    <!-- Header Section with Filters -->
    <div class="task-planning-header">
      <!-- Filter Section -->
      <div class="task-sync-filter-section">
        <!-- Search Input -->
        <div class="search-and-filters">
          <SearchInput
            bind:value={searchQuery}
            placeholder="Search calendar events..."
            onInput={(value) => (searchQuery = value)}
            testId="calendar-search-input"
            showRefreshButton={false}
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
                {#if !appleCalendarService.isEnabled()}
                  <br /><br />
                  <strong>To enable Apple Calendar integration:</strong>
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
                    class="mod-cta"
                    onclick={openSettings}
                    style="margin-top: 10px; margin-right: 10px;"
                  >
                    Open Settings
                  </button>
                  <button
                    class="mod-muted"
                    onclick={loadTestEvents}
                    style="margin-top: 10px;"
                  >
                    Load Test Events
                  </button>
                {/if}
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
        <ObsidianDayView
          events={filteredEvents}
          bind:selectedDate
          onImportEvent={importEvent}
          {importedEvents}
          {importingEvents}
          {isDailyPlanningMode}
        />
      </div>
    </div>
  </TabView>
</div>
