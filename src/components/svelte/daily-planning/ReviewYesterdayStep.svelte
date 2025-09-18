<script lang="ts">
  /**
   * Step 1: Review Yesterday's Tasks
   * Shows completed and not completed tasks from yesterday with option to move unfinished to today
   */

  import type { Task } from "../../../types/entities";

  interface Props {
    yesterdayTasks: { done: Task[]; notDone: Task[] };
    isLoading?: boolean;
    onMoveUnfinishedToToday: () => Promise<void>;
    onMoveTaskToToday?: (task: Task) => Promise<void>;
    onUnscheduleTask?: (task: Task) => Promise<void>;
  }

  let {
    yesterdayTasks,
    isLoading = false,
    onMoveUnfinishedToToday,
    onMoveTaskToToday,
    onUnscheduleTask,
  }: Props = $props();

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
          <div class="task-item not-completed" data-testid="not-completed-task">
            <span class="task-title">{task.title}</span>
            <div class="task-actions">
              <button
                class="action-btn move-to-today"
                onclick={() => handleMoveTaskToToday(task)}
                disabled={isLoading}
                data-testid="move-task-to-today-button"
              >
                Move to today
              </button>
              <button
                class="action-btn unschedule"
                onclick={() => handleUnscheduleTask(task)}
                disabled={isLoading}
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

  .task-title {
    font-size: 14px;
    color: var(--text-normal);
    flex: 1;
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
