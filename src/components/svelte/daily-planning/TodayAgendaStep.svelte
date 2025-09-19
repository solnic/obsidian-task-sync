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
  import { getPluginContext } from "../context";
  import { getOptimalTextColor } from "../../../utils/colorUtils";

  // Get plugin context during component initialization
  const { plugin } = getPluginContext();

  interface Props {
    todayTasks: Task[];
    todayEvents: CalendarEvent[];
  }

  let { todayTasks, todayEvents }: Props = $props();

  // Get scheduled and unscheduled tasks from the daily planning store
  let scheduledTasks = $derived.by(() => {
    const tasks = $dailyPlanningStore.scheduledTasks;
    return tasks;
  });

  let unscheduledTasks = $derived.by(() => {
    const tasks = $dailyPlanningStore.unscheduledTasks;
    return tasks;
  });

  // Combine existing today tasks with newly scheduled tasks, excluding unscheduled ones and duplicates
  let allTodayTasks = $derived.by(() => {
    // Filter out any tasks that are in the unscheduled list or already in scheduled tasks
    const filteredTodayTasks = todayTasks.filter(
      (task) =>
        !unscheduledTasks.some(
          (unscheduled) => unscheduled.filePath === task.filePath
        ) &&
        !scheduledTasks.some(
          (scheduled) => scheduled.filePath === task.filePath
        )
    );

    const combined = [...filteredTodayTasks, ...scheduledTasks];

    return combined;
  });

  // Since we're using staging approach, these functions just manage the daily planning store
  async function handleUnscheduleFromPlanning(task: Task) {
    unscheduleTask(task);
    // Clear the Do Date property when unscheduling
    await plugin.taskFileManager.updateProperty(task.filePath, "Do Date", null);
  }

  async function handleRescheduleFromUnscheduled(task: Task) {
    const todayString = new Date().toISOString().split("T")[0];
    rescheduleTask(task);
    // Set the Do Date property when rescheduling
    await plugin.taskFileManager.updateProperty(
      task.filePath,
      "Do Date",
      todayString
    );
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
            style="background-color: {bgColor}; color: {getOptimalTextColor(
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
            <div class="task-content">
              <span class="task-title">{task.title}</span>
              {#if isFromPlanning}
                <span class="task-badge planning">Added during planning</span>
              {/if}
            </div>
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
            <div class="task-content">
              <span class="task-title">{task.title}</span>
            </div>
            <div class="task-meta">
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
    color: inherit;
    min-width: 70px;
    font-weight: 500;
  }

  .event-details {
    flex: 1;
  }

  .event-title {
    font-size: 14px;
    color: inherit;
    display: block;
  }

  .event-location {
    font-size: 12px;
    color: inherit;
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

  .task-content {
    flex: 1;
  }

  .task-meta {
    display: flex;
    align-items: center;
    gap: 8px;
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
