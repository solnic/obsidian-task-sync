<script lang="ts">
  /**
   * Step 2: Today's Agenda
   * Shows calendar events and scheduled tasks for today with rescheduling controls
   */

  import type { Task } from "../../../types/entities";
  import type { CalendarEvent } from "../../../types/calendar";
  import {
    dailyPlanningStore,
    unscheduleTask,
    rescheduleTask,
  } from "../../../stores/dailyPlanningStore";

  interface Props {
    todayTasks: Task[];
    todayEvents: CalendarEvent[];
  }

  let { todayTasks, todayEvents }: Props = $props();

  // Get scheduled and unscheduled tasks from the daily planning store
  let scheduledTasks = $derived.by(() => {
    return $dailyPlanningStore.scheduledTasks;
  });

  let unscheduledTasks = $derived.by(() => {
    return $dailyPlanningStore.unscheduledTasks;
  });

  // Combine existing today tasks with newly scheduled tasks, excluding unscheduled ones
  let allTodayTasks = $derived.by(() => {
    // Filter out any tasks that are in the unscheduled list
    const filteredTodayTasks = todayTasks.filter(
      (task) =>
        !unscheduledTasks.some(
          (unscheduled) => unscheduled.filePath === task.filePath
        )
    );
    return [...filteredTodayTasks, ...scheduledTasks];
  });

  // Since we're using staging approach, these functions just manage the daily planning store
  function handleUnscheduleFromPlanning(task: Task) {
    unscheduleTask(task);
  }

  function handleRescheduleFromUnscheduled(task: Task) {
    rescheduleTask(task);
  }

  /**
   * Calculate the appropriate text color based on background color brightness
   * @param backgroundColor - The background color (hex, rgb, or named color)
   * @returns 'white' for dark backgrounds, 'black' for light backgrounds
   */
  function getContrastTextColor(backgroundColor: string): string {
    // Default to white for fallback
    if (!backgroundColor) return "white";

    // Convert color to RGB values
    let r: number, g: number, b: number;

    if (backgroundColor.startsWith("#")) {
      // Hex color
      const hex = backgroundColor.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    } else if (backgroundColor.startsWith("rgb")) {
      // RGB color
      const matches = backgroundColor.match(/\d+/g);
      if (matches && matches.length >= 3) {
        r = parseInt(matches[0]);
        g = parseInt(matches[1]);
        b = parseInt(matches[2]);
      } else {
        return "white";
      }
    } else {
      // Named color or other format - default to white
      return "white";
    }

    // Calculate relative luminance using WCAG formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for light backgrounds (luminance > 0.5), white for dark
    return luminance > 0.5 ? "black" : "white";
  }
</script>

<div class="today-agenda">
  <h4>Today's Agenda</h4>

  <!-- Calendar Events -->
  {#if todayEvents.length > 0}
    <div class="agenda-section">
      <h5>📅 Calendar Events ({todayEvents.length})</h5>
      <div class="event-list">
        {#each todayEvents as event}
          {@const bgColor = event.calendar?.color || "#3b82f6"}
          <div
            class="event-item"
            data-testid="calendar-event"
            style="background-color: {bgColor}; color: {getContrastTextColor(
              bgColor
            )};"
          >
            <div class="event-time">
              {new Date(event.startDate).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
            <div class="event-details">
              <span class="event-title">{event.title}</span>
              {#if event.location}
                <span class="event-location">📍 {event.location}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Scheduled Tasks -->
  {#if allTodayTasks.length > 0}
    <div class="agenda-section">
      <h5>✅ Scheduled Tasks ({allTodayTasks.length})</h5>
      <div class="task-list">
        {#each allTodayTasks as task}
          {@const isFromPlanning = scheduledTasks.includes(task)}
          <div class="task-item scheduled" data-testid="scheduled-task">
            <span class="task-title">{task.title}</span>
            {#if isFromPlanning}
              <span class="task-badge planning">Added during planning</span>
            {/if}
            <div class="task-actions">
              {#if isFromPlanning}
                <button
                  class="action-btn unschedule"
                  onclick={() => handleUnscheduleFromPlanning(task)}
                  data-testid="unschedule-planning-button"
                >
                  Remove
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="no-tasks">
      <p>No tasks scheduled for today yet.</p>
    </div>
  {/if}

  <!-- Unscheduled Tasks -->
  {#if unscheduledTasks.length > 0}
    <div class="agenda-section">
      <h5>📋 Unscheduled ({unscheduledTasks.length})</h5>
      <div class="task-list">
        {#each unscheduledTasks as task}
          <div class="task-item unscheduled" data-testid="unscheduled-task">
            <span class="task-title">{task.title}</span>
            <div class="task-actions">
              <button
                class="action-btn schedule"
                onclick={() => handleRescheduleFromUnscheduled(task)}
                data-testid="schedule-task-button"
              >
                Schedule for today
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .today-agenda h4 {
    margin-bottom: 20px;
    color: var(--text-normal);
  }

  .agenda-section {
    margin-bottom: 25px;
  }

  .agenda-section h5 {
    margin-bottom: 15px;
    color: var(--text-normal);
    font-size: 16px;
  }

  .event-list {
    margin-bottom: 10px;
  }

  .event-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 8px;
    border-radius: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
  }

  .event-time {
    font-size: 12px;
    color: var(--text-muted);
    min-width: 70px;
    font-weight: 500;
  }

  .event-details {
    flex: 1;
  }

  .event-title {
    font-size: 14px;
    color: var(--text-normal);
    display: block;
  }

  .event-location {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
    display: block;
  }

  .task-list {
    margin-bottom: 10px;
  }

  .task-item {
    padding: 8px 12px;
    margin-bottom: 5px;
    border-radius: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
  }

  .task-item.scheduled {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .task-title {
    font-size: 14px;
    color: var(--text-normal);
  }

  .task-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .task-badge.planning {
    background: var(--color-blue);
    color: white;
  }

  .task-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--background-modifier-hover);
  }

  .action-btn.unschedule {
    background: var(--color-red);
    color: white;
    border-color: var(--color-red);
  }

  .action-btn.schedule {
    background: var(--color-green);
    color: white;
    border-color: var(--color-green);
  }

  .task-item.unscheduled {
    background: var(--background-modifier-form-field);
    border: 1px dashed var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .event-item {
    padding: 8px 12px;
    margin-bottom: 5px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .event-time {
    font-size: 12px;
    font-weight: 500;
    opacity: 0.9;
    min-width: 80px;
  }

  .event-details {
    flex: 1;
  }

  .event-title {
    font-size: 14px;
    font-weight: 500;
    display: block;
    margin-bottom: 2px;
  }

  .event-location {
    font-size: 12px;
    opacity: 0.8;
  }

  .no-tasks {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
  }
</style>
