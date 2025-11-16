<script lang="ts">
  /**
   * AppleReminderItem - Specialized TaskItem for Apple Reminders
   */

  import TaskItem from "../../../components/TaskItem.svelte";
  import ImportButton from "../../../components/ImportButton.svelte";
  import type { Task } from "../../../core/entities";
  import type { TaskSyncSettings } from "../../../types/settings";

  interface Props {
    task: Task;
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    isScheduled?: boolean;
    scheduledDate?: Date;
    dayPlanningMode?: boolean;
    dailyPlanningWizardMode?: boolean;
    testId?: string;
    onHover?: (hovered: boolean) => void;
    onImport?: (task: Task) => void;
    settings?: TaskSyncSettings;
  }

  let {
    task,
    isHovered = false,
    isImported = false,
    isImporting = false,
    isScheduled = false,
    scheduledDate,
    onHover,
    onImport,
    dayPlanningMode = false,
    dailyPlanningWizardMode = false,
    testId,
    settings,
  }: Props = $props();

  // Get reminder data from task source
  const reminderData = $derived(task.source?.data);

  // Don't display timestamps for Apple Reminders
  // The source data often lacks creationDate/modificationDate from AppleScript,
  // and entity timestamps (when the task entity was created) are not useful here
  const createdAt = $derived(undefined);
  const updatedAt = $derived(undefined);

  // Convert task data to TaskItem format - primary badges (status, priority)
  let badges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    // Add status badge
    result.push({
      text: task.done ? "Completed" : "Active",
      type: "status",
    });

    // Add priority badge if present
    if (task.priority) {
      result.push({
        text: task.priority,
        type: "priority",
      });
    }

    return result;
  });

  // Footer badges (list name)
  let footerBadges = $derived.by(() => {
    const badges = [];

    if (reminderData?.list?.name) {
      badges.push({ type: "List", text: reminderData.list.name });
    }

    return badges;
  });

  function handleImport() {
    onImport?.(task);
  }
</script>

{#snippet actionSnippet()}
  <div class="import-actions">
    <ImportButton
      {isImported}
      {isImporting}
      {dayPlanningMode}
      {dailyPlanningWizardMode}
      testId={dailyPlanningWizardMode
        ? "schedule-for-today-button"
        : dayPlanningMode
          ? "add-to-today-button"
          : isImported
            ? "imported-indicator"
            : isImporting
              ? "importing-indicator"
              : "import-reminder-button"}
      onImport={handleImport}
    />
  </div>
{/snippet}

<TaskItem
  title={task.title}
  {badges}
  {footerBadges}
  createdAt={createdAt}
  updatedAt={updatedAt}
  {isHovered}
  {isImported}
  {isScheduled}
  {scheduledDate}
  {onHover}
  {settings}
  {testId}
  actionContent={true}
  actions={actionSnippet}
/>

