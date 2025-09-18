<script lang="ts">
  /**
   * Step 3: Plan Summary
   * Shows final plan summary and confirmation to add tasks to daily note
   */

  import type { Task } from "../../../types/entities";
  import type { CalendarEvent } from "../../../types/calendar";
  import { dailyPlanningStore } from "../../../stores/dailyPlanningStore";

  interface Props {
    finalPlan: { tasks: Task[]; events: CalendarEvent[] };
    tasksToMoveToToday: Task[];
  }

  let { finalPlan, tasksToMoveToToday }: Props = $props();

  // Get scheduled and unscheduled tasks from the daily planning store
  let scheduledTasks = $derived($dailyPlanningStore.scheduledTasks);
  let unscheduledTasks = $derived($dailyPlanningStore.unscheduledTasks);

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
              style="background-color: {bgColor}; color: {getContrastTextColor(
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
            {@const isFromPlanning = scheduledTasks.includes(task)}
            <div class="preview-item task">
              <span class="preview-title">{task.title}</span>
              {#if tasksToMoveToToday.includes(task)}
                <span class="preview-badge moved">Moved from yesterday</span>
              {:else if isFromPlanning}
                <span class="preview-badge scheduled"
                  >Scheduled during planning</span
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
    color: var(--text-muted);
    min-width: 70px;
    font-weight: 500;
  }

  .preview-title {
    font-size: 14px;
    color: var(--text-normal);
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

  .preview-badge.scheduled {
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
