<script lang="ts">
  /**
   * LocalTaskItem - Specialized TaskItem for local tasks
   */

  import TaskItem from "./TaskItem.svelte";
  import ImportButton from "./ImportButton.svelte";
  import SeeOnServiceButton from "./SeeOnServiceButton.svelte";
  import { extractDisplayValue } from "../../utils/linkUtils";
  import type { Task } from "../../types/entities";
  import {
    dailyPlanningStore,
    scheduleTaskForToday,
    unscheduleTask,
    isTaskScheduled,
  } from "../../stores/dailyPlanningStore";
  import { getPluginContext } from "./context";

  interface Props {
    task: Task;
    isHovered?: boolean;
    onHover?: (hovered: boolean) => void;
    onClick?: () => void;
    dayPlanningMode?: boolean;
    dailyPlanningWizardMode?: boolean;
    onAddToToday?: (task: Task) => void;
    isInToday?: boolean;
    testId?: string;
  }

  let {
    task,
    isHovered = false,
    onHover,
    onClick,
    dayPlanningMode = false,
    dailyPlanningWizardMode = false,
    onAddToToday,
    isInToday = false,
    testId,
  }: Props = $props();

  const { plugin } = getPluginContext();

  // Track daily planning state
  let isScheduled = $derived(
    isTaskScheduled(task, $dailyPlanningStore.scheduledTasks)
  );

  // Local tasks should not display imported styling - this is redundant
  const isImported = $derived(false);

  // Convert task data to TaskItem format - first row badges (category, priority, status)
  let primaryBadges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    if (task.category) {
      result.push({ text: task.category, type: "category" });
    }

    if (task.priority) {
      result.push({ text: task.priority, type: "priority" });
    }

    if (task.status) {
      result.push({ text: task.status, type: "status" });
    }

    return result;
  });

  // Create footer badges for project, area, and source
  const footerBadges = $derived.by(() => {
    const badges = [];

    if (task.project) {
      // Extract display value from project (handles wiki links properly)
      const cleanProject =
        typeof task.project === "string"
          ? extractDisplayValue(task.project) ||
            task.project.replace(/^\[\[|\]\]$/g, "")
          : task.project;
      badges.push({ type: "Project", text: cleanProject });
    }

    if (task.areas && Array.isArray(task.areas) && task.areas.length > 0) {
      const cleanAreas = task.areas.map((area) => {
        // Extract display value from areas (handles wiki links properly)
        return typeof area === "string"
          ? extractDisplayValue(area) || area.replace(/^\[\[|\]\]$/g, "")
          : area;
      });
      if (cleanAreas.length > 0) {
        badges.push({ type: "Area", text: cleanAreas.join(", ") });
      }
    }

    if (task.source) {
      badges.push({ type: "Source", text: task.source.name });
    }

    return badges;
  });

  function handleAddToToday() {
    onAddToToday?.(task);
  }

  async function handleScheduleForToday() {
    const todayString = new Date().toISOString().split("T")[0];

    if (isScheduled) {
      // Unschedule the task - clear the Do Date
      unscheduleTask(task);
      await plugin.taskFileManager.updateProperty(
        task.filePath,
        "Do Date",
        null
      );
      console.log("Unscheduled task:", task.title);
    } else {
      // Schedule the task for today - set Do Date to today
      scheduleTaskForToday(task);
      await plugin.taskFileManager.updateProperty(
        task.filePath,
        "Do Date",
        todayString
      );
      console.log("Scheduling task for today:", task.title);
    }
  }

  function handleOpenTask() {
    onClick?.();
  }
</script>

{#snippet actionSnippet()}
  <div class="task-actions">
    <!-- Always show Open button -->
    <button
      class="open-task-button"
      title="Open task"
      onclick={handleOpenTask}
      data-testid="open-task-button"
    >
      Open
    </button>

    {#if dailyPlanningWizardMode}
      <ImportButton
        dayPlanningMode={false}
        title={isScheduled ? "✓ Scheduled" : "Schedule for today"}
        testId="schedule-for-today-button"
        onImport={handleScheduleForToday}
        isImported={isScheduled}
      />
    {:else if dayPlanningMode}
      <ImportButton
        dayPlanningMode={true}
        title="Add to today"
        testId="add-to-today-button"
        onImport={handleAddToToday}
        isImported={isInToday}
      />
    {/if}
  </div>
{/snippet}

{#snippet secondaryActionSnippet()}
  {#if task.source?.url}
    <SeeOnServiceButton
      serviceName={task.source.name}
      url={task.source.url}
      testId="see-on-service-button"
    />
  {/if}
{/snippet}

<TaskItem
  title={task.title}
  badges={primaryBadges}
  {footerBadges}
  createdAt={task.createdAt}
  updatedAt={task.updatedAt}
  {isHovered}
  {isImported}
  {isScheduled}
  {onHover}
  actionContent={true}
  actions={actionSnippet}
  secondaryActions={secondaryActionSnippet}
  {testId}
/>
