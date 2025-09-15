<script lang="ts">
  /**
   * AppleReminderItem - Specialized TaskItem for Apple Reminders
   */

  import TaskItem from "./TaskItem.svelte";
  import ImportButton from "./ImportButton.svelte";
  import type { AppleReminder } from "../../types/apple-reminders";

  interface Props {
    reminder: AppleReminder;
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    dayPlanningMode?: boolean;
    testId?: string;
    onHover?: (hovered: boolean) => void;
    onImport?: (reminder: AppleReminder) => void;
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

    return parts.join(" • ");
  });

  let badges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    result.push({
      text: reminder.completed ? "Completed" : "Active",
      type: "status",
    });

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
        color: "#6366f1",
      });
    }

    return result;
  });

  let footerBadges = $derived.by(() => {
    const badges = [];

    badges.push({ type: "List", text: reminder.list.name });

    return badges;
  });

  function handleImport() {
    onImport?.(reminder);
  }
</script>

{#snippet actionSnippet()}
  <div class="import-actions">
    <ImportButton
      {isImported}
      {isImporting}
      {dayPlanningMode}
      title={dayPlanningMode
        ? "Add to today"
        : "Import this reminder as a task"}
      testId={dayPlanningMode
        ? "add-to-today-button"
        : isImported
          ? "imported-indicator"
          : isImporting
            ? "importing-indicator"
            : "reminder-import-button"}
      onImport={handleImport}
    />
  </div>
{/snippet}

<TaskItem
  title={reminder.title}
  {meta}
  {badges}
  {labels}
  {footerBadges}
  createdAt={reminder.creationDate}
  updatedAt={reminder.modificationDate}
  {isHovered}
  {isImported}
  {onHover}
  {testId}
  actionContent={true}
  actions={actionSnippet}
/>
