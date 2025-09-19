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

  // Get tasks from the daily planning store
  let alreadyScheduledTasks = $derived.by(() => {
    const store = $dailyPlanningStore;
    // Filter out tasks that are in unscheduled or tasksToUnschedule lists
    return store.alreadyScheduledTasks.filter(
      (task) =>
        !store.unscheduledTasks.some(
          (unscheduled) => unscheduled.filePath === task.filePath
        ) &&
        !store.tasksToUnschedule.some(
          (toUnschedule) => toUnschedule.filePath === task.filePath
        )
    );
  });

  let tasksToBeScheduled = $derived.by(() => {
    const store = $dailyPlanningStore;
    // Filter out tasks that are in unscheduled list
    return store.tasksToBeScheduled.filter(
      (task) =>
        !store.unscheduledTasks.some(
          (unscheduled) => unscheduled.filePath === task.filePath
        )
    );
  });

  let unscheduledTasks = $derived.by(() => {
    const tasks = $dailyPlanningStore.unscheduledTasks;
    return tasks;
  });

  // Handle unscheduling tasks based on their origin
  async function handleUnscheduleFromPlanning(task: Task) {
    const store = $dailyPlanningStore;
    const wasAlreadyScheduled = store.alreadyScheduledTasks.some(
      (t) => t.filePath === task.filePath
    );

    // Update the store state
    unscheduleTask(task);

    // For already scheduled tasks, we don't immediately clear Do Date
    // It will be cleared during plan confirmation if the task remains unscheduled
    // For tasks added during planning, we can clear Do Date immediately
    if (!wasAlreadyScheduled) {
      await plugin.taskFileManager.updateProperty(
        task.filePath,
        "Do Date",
        null
      );
    }
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

  <!-- Already Scheduled Tasks -->
  {#if alreadyScheduledTasks.length > 0}
    <div class="agenda-section">
      <h5>✅ Already scheduled for today ({alreadyScheduledTasks.length})</h5>
      <div class="task-list">
        {#each alreadyScheduledTasks as task}
          <div
            class="task-item scheduled already-scheduled"
            data-testid="scheduled-task"
          >
            <div class="task-content">
              <span class="task-title">{task.title}</span>
            </div>
            <div class="task-actions">
              <button
                class="action-btn unschedule"
                onclick={() => handleUnscheduleFromPlanning(task)}
                data-testid="unschedule-planning-button"
              >
                Unschedule
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- To Be Scheduled Tasks -->
  {#if tasksToBeScheduled.length > 0}
    <div class="agenda-section">
      <h5>📋 To be scheduled for today ({tasksToBeScheduled.length})</h5>
      <div class="task-list">
        {#each tasksToBeScheduled as task}
          <div
            class="task-item scheduled to-be-scheduled"
            data-testid="scheduled-task"
          >
            <div class="task-content">
              <span class="task-title">{task.title}</span>
            </div>
            <div class="task-actions">
              <button
                class="action-btn unschedule"
                onclick={() => handleUnscheduleFromPlanning(task)}
                data-testid="unschedule-planning-button"
              >
                Remove
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Show message if no tasks are scheduled -->
  {#if alreadyScheduledTasks.length === 0 && tasksToBeScheduled.length === 0}
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
