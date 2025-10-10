<script lang="ts">
  /**
   * Step 1: Review Yesterday's Tasks
   * Shows completed and not completed tasks from yesterday with option to move unfinished to today
   */

  import type { Task } from "../../core/entities";

  interface Props {
    yesterdayTasks: { done: Task[]; notDone: Task[] };
    schedulingCandidates?: Task[]; // Tasks with doDate=today but NOT in Daily Note
    scheduledTasks?: Task[];
    unscheduledTasks?: Task[];
    isLoading?: boolean;
    onMoveUnfinishedToToday: () => Promise<void>;
    onMoveTaskToToday?: (task: Task) => Promise<void>;
    onUnscheduleTask?: (task: Task) => Promise<void>;
  }

  let {
    yesterdayTasks,
    schedulingCandidates = [],
    scheduledTasks = [],
    unscheduledTasks = [],
    isLoading = false,
    onMoveUnfinishedToToday,
    onMoveTaskToToday,
    onUnscheduleTask,
  }: Props = $props();

  // Helper functions to check task status
  function isTaskScheduledForToday(task: Task): boolean {
    return scheduledTasks.some((t) => t.id === task.id);
  }

  function isTaskUnscheduled(task: Task): boolean {
    return unscheduledTasks.some((t) => t.id === task.id);
  }

  async function handleMoveToToday() {
    await onMoveUnfinishedToToday();
  }

  async function handleMoveTaskToToday(task: Task) {
    if (onMoveTaskToToday) {
      await onMoveTaskToToday(task);
    }
  }

  async function handleUnscheduleTask(task: Task) {
    if (onUnscheduleTask) {
      await onUnscheduleTask(task);
    }
  }
</script>

<div class="yesterday-review">
  <h4>Yesterday's Tasks</h4>

  {#if yesterdayTasks.done.length > 0}
    <div class="task-group">
      <h5>✅ Completed ({yesterdayTasks.done.length})</h5>
      <div class="task-list">
        {#each yesterdayTasks.done as task}
          <div class="task-item completed" data-testid="completed-task">
            <span class="task-title">{task.title}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if yesterdayTasks.notDone.length > 0}
    <div class="task-group">
      <h5>⏳ Not Completed ({yesterdayTasks.notDone.length})</h5>
      <div class="task-list">
        {#each yesterdayTasks.notDone as task}
          {@const isScheduled = isTaskScheduledForToday(task)}
          {@const isUnscheduled = isTaskUnscheduled(task)}
          <div
            class="task-item not-completed {isScheduled
              ? 'pending-scheduled'
              : ''} {isUnscheduled ? 'pending-unscheduled' : ''}"
            data-testid="not-completed-task"
          >
            <div class="task-content">
              <span class="task-title">{task.title}</span>
              {#if isScheduled}
                <span class="task-badge scheduled">Scheduled for today</span>
              {:else if isUnscheduled}
                <span class="task-badge unscheduled">Unscheduled</span>
              {/if}
            </div>
            <div class="task-actions">
              <button
                class="action-btn move-to-today"
                onclick={() => handleMoveTaskToToday(task)}
                disabled={isLoading || isScheduled}
                data-testid="move-task-to-today-button"
              >
                Move to today
              </button>
              <button
                class="action-btn unschedule"
                onclick={() => handleUnscheduleTask(task)}
                disabled={isLoading || isUnscheduled}
                data-testid="unschedule-task-button"
              >
                Unschedule
              </button>
            </div>
          </div>
        {/each}
      </div>
      <button
        class="move-to-today-btn"
        onclick={handleMoveToToday}
        disabled={isLoading}
        data-testid="move-to-today-button"
      >
        Move unfinished to today
      </button>
    </div>
  {:else}
    <div class="no-tasks">
      <p>🎉 All tasks from yesterday were completed!</p>
    </div>
  {/if}

  {#if yesterdayTasks.done.length === 0 && yesterdayTasks.notDone.length === 0}
    <div class="no-tasks">
      <p>No tasks were scheduled for yesterday.</p>
    </div>
  {/if}

  {#if schedulingCandidates.length > 0}
    <div class="task-group scheduling-candidates">
      <h5>📅 Tasks Already Set for Today ({schedulingCandidates.length})</h5>
      <p class="candidates-description">
        These tasks have today's date set but aren't in your Daily Note yet.
        Confirm to add them to your schedule.
      </p>
      <div class="task-list">
        {#each schedulingCandidates as task}
          {@const isScheduled = isTaskScheduledForToday(task)}
          {@const isUnscheduled = isTaskUnscheduled(task)}
          <div
            class="task-item candidate {isScheduled
              ? 'pending-scheduled'
              : ''} {isUnscheduled ? 'pending-unscheduled' : ''}"
            data-testid="scheduling-candidate-task"
          >
            <span class="task-title">{task.title}</span>
            <div class="task-actions">
              <button
                class="action-btn schedule"
                onclick={() => handleMoveTaskToToday(task)}
                disabled={isLoading || isScheduled}
                data-testid="confirm-schedule-button"
              >
                {isScheduled ? "Scheduled" : "Confirm"}
              </button>
              <button
                class="action-btn unschedule"
                onclick={() => handleUnscheduleTask(task)}
                disabled={isLoading || isUnscheduled}
                data-testid="remove-from-today-button"
              >
                {isUnscheduled ? "Removed" : "Remove"}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .yesterday-review h4 {
    margin-bottom: 20px;
    color: var(--text-normal);
  }

  .task-group {
    margin-bottom: 20px;
  }

  .task-group h5 {
    margin-bottom: 10px;
    color: var(--text-normal);
    font-size: 16px;
  }

  .task-list {
    margin-bottom: 15px;
  }

  .task-item {
    padding: 8px 12px;
    margin-bottom: 5px;
    border-radius: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .task-item.completed {
    opacity: 0.7;
  }

  .task-item.pending-scheduled {
    background: var(--color-green-rgb);
    background: rgba(var(--color-green-rgb), 0.1);
    border-color: var(--color-green);
  }

  .task-item.pending-unscheduled {
    background: var(--color-orange-rgb);
    background: rgba(var(--color-orange-rgb), 0.1);
    border-color: var(--color-orange);
  }

  .task-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
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

  .task-badge.scheduled {
    background: var(--color-green);
    color: white;
  }

  .task-badge.unscheduled {
    background: var(--color-orange);
    color: white;
  }

  .task-actions {
    display: flex;
    gap: 6px;
    margin-left: 12px;
  }

  .action-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: opacity 0.2s ease;
  }

  .action-btn:hover:not(:disabled) {
    opacity: 0.8;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.unschedule {
    background: var(--color-orange);
  }

  .move-to-today-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: opacity 0.2s ease;
  }

  .move-to-today-btn:hover:not(:disabled) {
    opacity: 0.8;
  }

  .move-to-today-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .no-tasks {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
  }
</style>
