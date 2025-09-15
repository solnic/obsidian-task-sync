<script lang="ts">
  /**
   * AppleReminderItem - Specialized TaskItem for Apple Reminders
   */

  import TaskItem from "./TaskItem.svelte";
  import type { AppleReminder } from "../../types/apple-reminders";

  interface Props {
    reminder: AppleReminder;
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    onHover?: (hovered: boolean) => void;
    onImport?: (reminder: AppleReminder) => void;
    dayPlanningMode?: boolean;
    testId?: string;
  }

  let {
    reminder,
    isHovered = false,
    isImported = false,
    isImporting = false,
    onHover,
    onImport,
    dayPlanningMode = false,
    testId,
  }: Props = $props();

  // Convert reminder data to TaskItem format
  // No subtitle needed - list name is shown as a label

  let meta = $derived.by(() => {
    const parts: string[] = [];

    if (reminder.dueDate) {
      parts.push(`Due: ${reminder.dueDate.toLocaleDateString()}`);
    }

    if (reminder.priority > 0) {
      const priorityLabels = ["", "Low", "Medium", "High"];
      const priorityLabel =
        priorityLabels[Math.min(reminder.priority, 3)] || "High";
      parts.push(`Priority: ${priorityLabel}`);
    }

    // Creation date is shown in footer, no need to duplicate here

    return parts.join(" • ");
  });

  let badges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    // Add status badge
    result.push({
      text: reminder.completed ? "Completed" : "Active",
      type: "status",
    });

    // Add priority badge if set
    if (reminder.priority > 0) {
      const priorityLabels = ["", "Low", "Medium", "High"];
      const priorityLabel =
        priorityLabels[Math.min(reminder.priority, 3)] || "High";
      result.push({
        text: priorityLabel,
        type: "priority",
      });
    }

    return result;
  });

  let labels = $derived.by(() => {
    const result: Array<{ name: string; color?: string }> = [];

    // Add all-day indicator if applicable
    if (reminder.allDay) {
      result.push({
        name: "All Day",
        color: "#6366f1", // Indigo color for all-day reminders
      });
    }

    return result;
  });

  // Location for footer (list name as badge)
  let location = $derived(`List: ${reminder.list.name}`);

  function handleImport() {
    onImport?.(reminder);
  }
</script>

{#snippet actionSnippet()}
  <div class="import-actions">
    {#if isImported}
      <span class="import-status imported" data-testid="imported-indicator">
        ✓ Imported
      </span>
    {:else if isImporting}
      <span class="import-status importing" data-testid="importing-indicator">
        ⏳ Importing...
      </span>
    {:else}
      <button
        class="import-button"
        title={dayPlanningMode
          ? "Add to today"
          : "Import this reminder as a task"}
        onclick={handleImport}
        data-testid={dayPlanningMode
          ? "add-to-today-button"
          : "reminder-import-button"}
      >
        {dayPlanningMode ? "Add to today" : "Import"}
      </button>
    {/if}
  </div>
{/snippet}

<TaskItem
  title={reminder.title}
  {meta}
  {badges}
  {labels}
  {location}
  createdAt={reminder.creationDate}
  {isHovered}
  {isImported}
  {onHover}
  {testId}
  actionContent={true}
  actions={actionSnippet}
/>

<style>
  .import-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
  }

  .import-button {
    padding: 8px 16px;
    border: 1px solid var(--interactive-accent);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .import-button:hover {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }

  .import-status {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .import-status.imported {
    background: var(--color-green);
    color: white;
  }

  .import-status.importing {
    background: var(--color-yellow);
    color: var(--text-normal);
  }
</style>
