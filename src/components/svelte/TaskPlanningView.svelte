<script lang="ts">
  import { onMount } from "svelte";
  import { ScheduleXCalendar } from "@schedule-x/svelte";
  import { createCalendar, createViewDay } from "@schedule-x/calendar";
  import "temporal-polyfill/global";
  import TabView from "./TabView.svelte";
  import FilterButton from "./FilterButton.svelte";
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

  // Computed properties
  let shouldShowOverlays = $derived(
    currentContext.type === "project" ||
      currentContext.type === "area" ||
      currentContext.type === "daily"
  );

  let isDailyPlanningMode = $derived(currentContext.type === "daily");

  // State
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let availableCalendars = $state<Calendar[]>([]);
  let selectedCalendarIds = $state<string[]>([]);
  let calendarEvents = $state<CalendarEvent[]>([]);
  let calendarApp = $state<any>(null);

  // Event import state
  let importedEvents = $state<Set<string>>(new Set());
  let importingEvents = $state<Set<string>>(new Set());

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
          _originalEvent: event, // Store reference to original event
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
          _originalEvent: event, // Store reference to original event
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

    // Setup event hover overlays after events are rendered
    setTimeout(() => {
      setupEventHoverOverlays();
    }, 100);
  }

  // Setup hover overlays for Schedule-X calendar events
  function setupEventHoverOverlays() {
    // Only show overlays when in project/area context
    if (!shouldShowOverlays) {
      console.log("Overlays disabled - not in project/area context");
      return;
    }

    const calendarWrapper = document.querySelector(".calendar-wrapper");
    if (!calendarWrapper) {
      console.log("Calendar wrapper not found");
      return;
    }

    // Try multiple selectors to find Schedule-X event elements
    const possibleSelectors = [
      "[data-event-id]",
      ".sx__event",
      ".sx-event",
      "[data-sx-event-id]",
      ".sx__time-grid-event",
      ".sx__month-grid-event",
      ".sx__date-grid-event",
      // Try more generic selectors
      ".sx-svelte-calendar-wrapper [class*='event']",
      ".sx-svelte-calendar-wrapper [data-id]",
      // Look for any clickable elements that might be events
      ".sx-svelte-calendar-wrapper [role='button']",
      ".sx-svelte-calendar-wrapper .sx__calendar-wrapper [class*='sx']",
    ];

    let eventElements: NodeListOf<Element> | null = null;

    for (const selector of possibleSelectors) {
      try {
        eventElements = calendarWrapper.querySelectorAll(selector);
        if (eventElements.length > 0) {
          console.log(
            `Found ${eventElements.length} events with selector: ${selector}`
          );
          break;
        }
      } catch (e) {
        console.log(`Invalid selector: ${selector}`);
      }
    }

    if (!eventElements || eventElements.length === 0) {
      console.log("No Schedule-X event elements found");
      console.log(
        "Calendar wrapper HTML:",
        calendarWrapper.innerHTML.substring(0, 500)
      );

      // Fallback: try to find any elements that might be events based on content
      const fallbackElements = calendarWrapper.querySelectorAll("*");
      const potentialEvents: Element[] = [];

      fallbackElements.forEach((el) => {
        const text = el.textContent?.trim();
        if (
          text &&
          calendarEvents.some((event) => text.includes(event.title))
        ) {
          potentialEvents.push(el);
        }
      });

      if (potentialEvents.length > 0) {
        console.log(
          `Found ${potentialEvents.length} potential events by text matching`
        );
        eventElements = potentialEvents as any;
      } else {
        return;
      }
    }

    eventElements.forEach((eventEl) => {
      // Try different ways to get the event ID
      let eventId =
        eventEl.getAttribute("data-event-id") ||
        eventEl.getAttribute("data-sx-event-id") ||
        eventEl.getAttribute("data-id");

      // If no ID attribute, try to match by text content
      if (!eventId) {
        const text = eventEl.textContent?.trim();
        const matchingEvent = calendarEvents.find(
          (event) => text && text.includes(event.title)
        );
        if (matchingEvent) {
          eventId = matchingEvent.id;
        }
      }

      if (!eventId) {
        console.log("No event ID found for element:", eventEl);
        return;
      }

      // Find the original event data
      const originalEvent = calendarEvents.find((e) => e.id === eventId);
      if (!originalEvent) {
        console.log(`No original event found for ID: ${eventId}`);
        return;
      }

      // Remove existing overlay if any
      const existingOverlay = eventEl.querySelector(".calendar-event-overlay");
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Create overlay element
      const overlay = document.createElement("div");
      overlay.className = "calendar-event-overlay";
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      `;

      // Create import button
      const importButton = document.createElement("button");

      // Set button text based on mode and status
      if (importedEvents.has(eventId)) {
        importButton.textContent = isDailyPlanningMode
          ? "✓ Added to today"
          : "✓ Imported";
      } else if (importingEvents.has(eventId)) {
        importButton.textContent = isDailyPlanningMode
          ? "⏳ Adding..."
          : "⏳ Importing...";
      } else {
        importButton.textContent = isDailyPlanningMode
          ? "Add to today"
          : "Import";
      }

      importButton.disabled =
        importedEvents.has(eventId) || importingEvents.has(eventId);
      importButton.style.cssText = `
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
      `;

      importButton.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!importedEvents.has(eventId) && !importingEvents.has(eventId)) {
          importEvent(originalEvent);
        }
      });

      overlay.appendChild(importButton);

      // Make event element relative positioned for overlay
      if (getComputedStyle(eventEl).position === "static") {
        (eventEl as HTMLElement).style.position = "relative";
      }

      eventEl.appendChild(overlay);

      // Add hover listeners
      eventEl.addEventListener("mouseenter", () => {
        overlay.style.display = "flex";
      });

      eventEl.addEventListener("mouseleave", () => {
        overlay.style.display = "none";
      });
    });
  }

  // Calendar filter options for FilterButton
  let calendarFilterOptions = $derived([
    "All calendars",
    ...availableCalendars.map((cal) => cal.name),
  ]);

  // Current calendar filter display value
  let currentCalendarFilterValue = $derived.by(() => {
    if (selectedCalendarIds.length === 0) {
      return "All calendars";
    } else if (selectedCalendarIds.length === 1) {
      const calendar = availableCalendars.find(
        (cal) => cal.id === selectedCalendarIds[0]
      );
      return calendar?.name || "1 selected";
    } else {
      return `${selectedCalendarIds.length} selected`;
    }
  });

  // Handle calendar filter selection (multi-select)
  function handleCalendarFilterSelect(calendarName: string) {
    if (calendarName === "All calendars") {
      selectedCalendarIds = [];
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

        // Update overlays to reflect new import state
        setTimeout(() => {
          setupEventHoverOverlays();
        }, 50);
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

      // Update overlays to reflect new importing state
      setTimeout(() => {
        setupEventHoverOverlays();
      }, 50);
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
      <div class="task-sync-filter-section">
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
                allowClear={true}
                isActive={selectedCalendarIds.length > 0}
              />
            {/if}
          </div>
        </div>
      </div>
    </div>

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
