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
  } from "../../../stores/dailyPlanningStore";

  interface Props {
    todayTasks: Task[];
    todayEvents: CalendarEvent[];
    onUnscheduleTask: (task: Task) => Promise<void>;
    onRescheduleTask: (task: Task, newDate: string) => Promise<void>;
    getTomorrowString: () => string;
  }

  let {
    todayTasks,
    todayEvents,
    onUnscheduleTask,
    onRescheduleTask,
    getTomorrowString,
  }: Props = $props();

  // Get scheduled tasks from the daily planning store
  let scheduledTasks = $derived($dailyPlanningStore.scheduledTasks);

  // Combine existing today tasks with newly scheduled tasks
  let allTodayTasks = $derived([...todayTasks, ...scheduledTasks]);

  async function handleUnschedule(task: Task) {
    await onUnscheduleTask(task);
  }

  async function handleReschedule(task: Task, newDate: string) {
    await onRescheduleTask(task, newDate);
  }

  function handleUnscheduleFromPlanning(task: Task) {
    unscheduleTask(task);
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
          <div class="event-item" data-testid="calendar-event">
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
              {:else}
                <button
                  class="action-btn reschedule"
                  onclick={() => handleReschedule(task, getTomorrowString())}
                  data-testid="reschedule-tomorrow-button"
                >
                  Tomorrow
                </button>
                <button
                  class="action-btn unschedule"
                  onclick={() => handleUnschedule(task)}
                  data-testid="unschedule-button"
                >
                  Unschedule
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

  .action-btn.reschedule {
    background: var(--color-orange);
    color: white;
    border-color: var(--color-orange);
  }

  .action-btn.unschedule {
    background: var(--color-red);
    color: white;
    border-color: var(--color-red);
  }

  .no-tasks {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
  }
</style>
