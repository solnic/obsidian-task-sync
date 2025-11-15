<script lang="ts">
  /**
   * LocalTaskItem - Specialized TaskItem for local tasks
   */

  import TaskItem from "./TaskItem.svelte";
  import ImportButton from "./ImportButton.svelte";
  import SeeOnServiceButton from "./SeeOnServiceButton.svelte";
  import type { Task } from "../core/entities";
  import type { LocalTask } from "../types/LocalTask";
  import type { TaskSyncSettings } from "../types/settings";

  interface Props {
    task: Task;
    localTask: LocalTask;
    isHovered?: boolean;
    isSelected?: boolean;
    onHover?: (hovered: boolean) => void;
    onClick?: () => void;
    onOpen?: () => void; // Separate handler for Open button
    dayPlanningMode?: boolean;
    dailyPlanningWizardMode?: boolean;
    onAddToToday?: (task: Task) => void;
    isInToday?: boolean;
    isStaged?: boolean;
    testId?: string;
    settings?: TaskSyncSettings;
  }

  let {
    task,
    localTask,
    isHovered = false,
    isSelected = false,
    onHover,
    onClick,
    onOpen,
    dayPlanningMode = false,
    dailyPlanningWizardMode = false,
    onAddToToday,
    isInToday = false,
    isStaged = false,
    testId,
    settings,
  }: Props = $props();

  // Track daily planning state - a task is scheduled if it has a doDate OR is staged
  let isScheduled = $derived(task.doDate != null || isStaged);

  // Compute the scheduled date - use doDate if available, otherwise today if staged
  let scheduledDate = $derived(task.doDate || (isStaged ? new Date() : null));

  // Local tasks are never imported, so isImported is always false.
  // This prop is required by TaskItem for consistent styling logic.
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
      // Project should already be cleaned by ObsidianExtension
      const cleanProject =
        typeof task.project === "string" ? task.project.trim() : task.project;
      badges.push({ type: "Project", text: cleanProject });
    }

    if (task.areas && Array.isArray(task.areas) && task.areas.length > 0) {
      const cleanAreas = task.areas.map((area: any) => {
        // Areas should already be cleaned by ObsidianExtension
        return typeof area === "string" ? area.trim() : area;
      });
      if (cleanAreas.length > 0) {
        badges.push({ type: "Area", text: cleanAreas.join(", ") });
      }
    }

    if (task.source.extension) {
      badges.push({ type: "Source", text: task.source.extension });
    }

    return badges;
  });

  function handleAddToToday() {
    onAddToToday?.(task);
  }

  function handleOpenTask() {
    // Use onOpen if provided (for explicit Open button), otherwise fall back to onClick
    if (onOpen) {
      onOpen();
    } else {
      onClick?.();
    }
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
        dailyPlanningWizardMode={true}
        title="Schedule for today"
        testId="schedule-for-today-button"
        onImport={handleAddToToday}
        isImported={isStaged}
      />
    {:else}
      <ImportButton
        dayPlanningMode={true}
        title="Add to today"
        testId="add-to-today-button"
        onImport={handleAddToToday}
        isImported={isInToday}
      />
    {/if}
    {#if task.source.keys.github}
      <SeeOnServiceButton
        serviceName={task.source.extension}
        url={task.source.keys.github}
        testId="see-on-service-button"
      />
    {/if}
  </div>
{/snippet}

<TaskItem
  title={task.title}
  badges={primaryBadges}
  {footerBadges}
  createdAt={localTask.sortable.createdAt}
  updatedAt={localTask.sortable.updatedAt}
  {isHovered}
  {isImported}
  {isSelected}
  {isScheduled}
  {scheduledDate}
  {onHover}
  {settings}
  actionContent={true}
  actions={actionSnippet}
  {testId}
/>
