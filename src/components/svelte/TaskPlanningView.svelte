<script lang="ts">
  import { onMount } from "svelte";
  import { ScheduleXCalendar } from "@schedule-x/svelte";
  import { createCalendar, createViewDay } from "@schedule-x/calendar";
  import "temporal-polyfill/global";
  import TabView from "./TabView.svelte";
  import type { AppleCalendarService } from "../../services/AppleCalendarService";
  import type { AppleCalendarIntegrationSettings } from "../ui/settings/types";
  import type { Calendar, CalendarEvent } from "../../types/calendar";

  // Props
  interface Props {
    appleCalendarService: AppleCalendarService;
    settings: {
      appleCalendarIntegration: AppleCalendarIntegrationSettings;
    };
  }

  let { appleCalendarService, settings }: Props = $props();

  // State
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let availableCalendars = $state<Calendar[]>([]);
  let selectedCalendarIds = $state<string[]>([]);
  let calendarEvents = $state<CalendarEvent[]>([]);
  let calendarApp = $state<any>(null);

  // Initialize calendar app
  function initializeCalendar() {
    const today = Temporal.Now.plainDateISO();
    const timeZone = Temporal.Now.timeZoneId();

    // Map common timezone IDs to Schedule-X format
    let scheduleXTimezone = timeZone;
    if (timeZone === "Europe/Warsaw") {
      scheduleXTimezone = "Europe/Warsaw";
    } else if (timeZone.startsWith("Europe/")) {
      scheduleXTimezone = timeZone;
    } else if (timeZone.startsWith("America/")) {
      scheduleXTimezone = timeZone;
    } else {
      // Fallback to a common timezone if not recognized
      scheduleXTimezone = "UTC";
    }

    calendarApp = createCalendar({
      views: [createViewDay()],
      events: [],
      defaultView: "day",
      selectedDate: today,
      locale: "en-US",
      timezone: scheduleXTimezone as any,
    });
  }

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

  // Load calendar events
  async function loadEvents() {
    if (selectedCalendarIds.length === 0) {
      calendarEvents = [];
      updateCalendarEvents();
      return;
    }

    try {
      isLoading = true;
      error = null;

      const today = new Date();
      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);

      const events = await appleCalendarService.getEvents(
        selectedCalendarIds,
        startDate,
        endDate
      );

      calendarEvents = events;
      updateCalendarEvents();
    } catch (err: any) {
      error = `Failed to load events: ${err.message}`;
    } finally {
      isLoading = false;
    }
  }

  // Update calendar with events
  function updateCalendarEvents() {
    if (!calendarApp) {
      return;
    }

    const scheduleXEvents = calendarEvents.map((event) => {
      try {
        // Convert dates to Temporal objects as expected by Schedule-X
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);

        // Create proper Temporal objects
        let start, end;

        if (event.allDay) {
          // For all-day events, use PlainDate
          const startDateStr = startDate.toISOString().split("T")[0];
          const endDateStr = endDate.toISOString().split("T")[0];
          start = Temporal.PlainDate.from(startDateStr);
          end = Temporal.PlainDate.from(endDateStr);
        } else {
          // For timed events, use ZonedDateTime
          const timeZone = Temporal.Now.timeZoneId();

          // Create ISO strings with timezone
          const startISOString = startDate.toISOString();
          const endISOString = endDate.toISOString();

          // Use Instant and convert to ZonedDateTime
          try {
            const startInstant = Temporal.Instant.from(startISOString);
            const endInstant = Temporal.Instant.from(endISOString);

            start = startInstant.toZonedDateTimeISO(timeZone);
            end = endInstant.toZonedDateTimeISO(timeZone);
          } catch (err) {
            // Fallback to current time
            const now = Temporal.Now.zonedDateTimeISO();
            start = now;
            end = now.add({ hours: 1 });
          }
        }

        return {
          id: event.id,
          title: event.title,
          start: start,
          end: end,
          description: event.description || "",
          location: event.location || "",
        };
      } catch (err) {
        console.error("Error converting event:", event, err);
        // Return a fallback event using current time
        const now = Temporal.Now.zonedDateTimeISO();
        const later = now.add({ hours: 1 });
        return {
          id: event.id || "unknown",
          title: event.title || "Unknown Event",
          start: now,
          end: later,
          description: event.description || "",
          location: event.location || "",
        };
      }
    });

    calendarApp.events.set(scheduleXEvents);

    // If we have events and they're not from today, navigate to the first event's date
    if (scheduleXEvents.length > 0) {
      const firstEvent = scheduleXEvents[0];
      const eventDate = firstEvent.start;
      const today = Temporal.Now.plainDateISO();

      // If event is not today, navigate to event date
      if (eventDate && !eventDate.toString().startsWith(today.toString())) {
        // Extract date part for navigation
        let navigationDate;
        if (eventDate instanceof Temporal.PlainDate) {
          navigationDate = eventDate;
        } else if (eventDate instanceof Temporal.ZonedDateTime) {
          navigationDate = eventDate.toPlainDate();
        }

        if (navigationDate) {
          calendarApp.selectedDate = navigationDate;
        }
      }
    }
  }

  // Handle calendar selection change
  function handleCalendarSelectionChange(
    calendarId: string,
    selected: boolean
  ) {
    if (selected) {
      selectedCalendarIds = [...selectedCalendarIds, calendarId];
    } else {
      selectedCalendarIds = selectedCalendarIds.filter(
        (id) => id !== calendarId
      );
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

  // Load test events for debugging
  function loadTestEvents() {
    console.log("🗓️ TaskPlanningView: Loading test events");

    const now = new Date();
    const testEvents = [
      {
        id: "test-1",
        title: "Test Meeting",
        startDate: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
        endDate: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
        description: "This is a test event",
        location: "Test Location",
        allDay: false,
        calendar: { id: "test-cal", name: "Test Calendar", visible: true },
      },
      {
        id: "test-2",
        title: "All Day Event",
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        description: "Test all day event",
        location: "",
        allDay: true,
        calendar: { id: "test-cal", name: "Test Calendar", visible: true },
      },
    ];

    calendarEvents = testEvents;
    updateCalendarEvents();
  }

  // Initialize on mount
  onMount(() => {
    initializeCalendar();
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
    <!-- Calendar Filter Section -->
    <div class="task-planning-filters">
      <div class="filter-section">
        <h3>Calendar Selection</h3>
        {#if isLoading && availableCalendars.length === 0}
          <div class="task-sync-loading-indicator">Loading calendars...</div>
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
            No calendars available. Please check your Apple Calendar integration
            settings.
          </div>
        {:else}
          <div class="calendar-filter-list">
            {#each availableCalendars as calendar (calendar.id)}
              <label class="calendar-filter-item">
                <input
                  type="checkbox"
                  checked={selectedCalendarIds.includes(calendar.id)}
                  onchange={(e) =>
                    handleCalendarSelectionChange(
                      calendar.id,
                      (e.target as HTMLInputElement).checked
                    )}
                />
                <span
                  class="calendar-name"
                  style="color: {calendar.color || '#666'}"
                  >{calendar.name}</span
                >
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Debug Information (only show when there are issues) -->
    {#if !appleCalendarService.isEnabled() || error || calendarEvents.length > 0}
      <div
        class="task-planning-debug"
        style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 12px;"
      >
        <strong>Status:</strong><br />
        Service Enabled: {appleCalendarService.isEnabled()}<br />
        Available Calendars: {availableCalendars.length}<br />
        Selected Calendar IDs: {selectedCalendarIds.length}<br />
        Calendar Events: {calendarEvents.length}<br />
        {#if error}
          Error: {error}<br />
        {/if}
        {#if isLoading}
          Status: Loading...<br />
        {/if}
      </div>
    {/if}

    <!-- Calendar View Section -->
    <div class="task-planning-calendar">
      {#if calendarApp}
        <div class="calendar-wrapper">
          <ScheduleXCalendar {calendarApp} />
        </div>
      {:else}
        <div class="task-sync-loading-indicator">Initializing calendar...</div>
      {/if}
    </div>
  </TabView>
</div>
