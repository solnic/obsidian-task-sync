<script lang="ts">
  /**
   * LocalTaskItem - Specialized TaskItem for local tasks
   */

  import TaskItem from "./TaskItem.svelte";
  import { extractDisplayValue } from "../../utils/linkUtils";
  import type { Task } from "../../types/entities";

  interface Props {
    task: Task;
    isHovered?: boolean;
    onHover?: (hovered: boolean) => void;
    onClick?: () => void;
    dayPlanningMode?: boolean;
    onAddToToday?: (task: Task) => void;
    testId?: string;
  }

  let {
    task,
    isHovered = false,
    onHover,
    onClick,
    dayPlanningMode = false,
    onAddToToday,
    testId,
  }: Props = $props();

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

  function handleOpenTask() {
    onClick?.();
  }

  function handleOpenOnService() {
    if (task.source?.url) {
      window.open(task.source.url, "_blank");
    }
  }
</script>

{#snippet actionSnippet()}
  <div class="task-actions">
    {#if dayPlanningMode}
      <button
        class="add-to-today-button"
        title="Add to today"
        onclick={handleAddToToday}
        data-testid="add-to-today-button"
      >
        Add to today
      </button>
    {:else}
      <button
        class="open-task-button"
        title="Open task"
        onclick={handleOpenTask}
        data-testid="open-task-button"
      >
        Open
      </button>
    {/if}
    {#if task.source?.url}
      <button
        class="open-on-service-button"
        title="Open on {task.source.name}"
        onclick={handleOpenOnService}
        data-testid="open-on-service-button"
      >
        Open on {task.source.name}
      </button>
    {/if}
  </div>
{/snippet}

<TaskItem
  title={task.title}
  badges={primaryBadges}
  {footerBadges}
  createdAt={task.createdAt}
  updatedAt={task.updatedAt}
  {isHovered}
  {onHover}
  actionContent={true}
  actions={actionSnippet}
  {testId}
/>

<!-- Styles moved to styles.css for consistency -->
