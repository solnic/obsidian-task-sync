<script lang="ts">
  /**
   * Step 3: Plan Summary
   * Shows final plan summary and confirmation to add tasks to daily note
   */

  import type { Task, CalendarEvent } from "../../core/entities";
  import { getOptimalTextColor } from "../../utils/colorUtils";

  interface Props {
    finalPlan: { tasks: Task[]; events: CalendarEvent[] };
    tasksToMoveToToday: Task[];
    unscheduledTasks?: Task[];
  }

  let {
    finalPlan,
    tasksToMoveToToday,
    unscheduledTasks = [],
  }: Props = $props();
</script>

<div class="plan-summary">
  <h4>Plan Summary</h4>
  <p>Review your plan for today and confirm to add tasks to your daily note.</p>

  <!-- Final Plan Preview -->
  <div class="plan-preview">
    {#if finalPlan.events.length > 0}
      <div class="plan-section">
        <h5>📅 Calendar Events ({finalPlan.events.length})</h5>
        <div class="preview-list">
          {#each finalPlan.events as event}
            {@const bgColor = event.calendar?.color || "#3b82f6"}
            <div
              class="preview-item event"
              style="background-color: {bgColor}; color: {getOptimalTextColor(
                bgColor
              )};"
            >
              <span class="preview-time">
                {new Date(event.startDate).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
              <span class="preview-title">{event.title}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if finalPlan.tasks.length > 0}
      <div class="plan-section">
        <h5>✅ Tasks ({finalPlan.tasks.length})</h5>
        <div class="preview-list">
          {#each finalPlan.tasks as task}
            {@const wasAlreadyScheduled = false}
            {@const wasAddedDuringPlanning = tasksToMoveToToday.includes(task)}
            <div class="preview-item task">
              <span class="preview-title">{task.title}</span>
              {#if tasksToMoveToToday.includes(task)}
                <span class="preview-badge moved">Moved from yesterday</span>
              {:else if wasAlreadyScheduled}
                <span class="preview-badge already-scheduled"
                  >Already scheduled for today</span
                >
              {:else if wasAddedDuringPlanning}
                <span class="preview-badge to-be-scheduled"
                  >To be scheduled for today</span
                >
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="no-tasks">
        <p>No tasks planned for today.</p>
      </div>
    {/if}

    <!-- Unscheduled Tasks -->
    {#if unscheduledTasks.length > 0}
      <div class="plan-section">
        <h5>📋 Unscheduled ({unscheduledTasks.length})</h5>
        <div class="preview-list">
          {#each unscheduledTasks as task}
            <div class="preview-item task unscheduled">
              <span class="preview-title">{task.title}</span>
              <span class="preview-badge unscheduled">Unscheduled</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .plan-summary h4 {
    margin-bottom: 20px;
    color: var(--text-normal);
  }

  .plan-summary p {
    margin-bottom: 20px;
    color: var(--text-muted);
  }

  .plan-preview {
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 20px;
    background: var(--background-secondary);
  }

  .plan-section {
    margin-bottom: 25px;
  }

  .plan-section:last-child {
    margin-bottom: 0;
  }

  .plan-section h5 {
    margin-bottom: 15px;
    color: var(--text-normal);
    font-size: 16px;
  }

  .preview-list {
    margin-bottom: 10px;
  }

  .preview-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 8px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
  }

  .preview-item.event {
    background: var(--color-blue-rgb);
    background: rgba(var(--color-blue-rgb), 0.1);
    border-color: var(--color-blue);
  }

  .preview-item.task {
    background: var(--color-green-rgb);
    background: rgba(var(--color-green-rgb), 0.1);
    border-color: var(--color-green);
  }

  .preview-item.task.unscheduled {
    background: var(--background-modifier-form-field);
    border: 1px dashed var(--background-modifier-border);
  }

  .preview-time {
    font-size: 12px;
    color: inherit;
    min-width: 70px;
    font-weight: 500;
  }

  .preview-title {
    font-size: 14px;
    color: inherit;
    flex: 1;
  }

  .preview-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .preview-badge.moved {
    background: var(--color-orange);
    color: white;
  }

  .preview-badge.already-scheduled {
    background: var(--color-green);
    color: white;
  }

  .preview-badge.to-be-scheduled {
    background: var(--color-blue);
    color: white;
  }

  .preview-badge.unscheduled {
    background: var(--color-orange);
    color: white;
  }

  .no-tasks {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
  }
</style>
