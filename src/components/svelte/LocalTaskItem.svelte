<script lang="ts">
  /**
   * LocalTaskItem - Specialized TaskItem for local tasks
   */

  import TaskItem from "./TaskItem.svelte";
  import CategoryBadge from "./badges/CategoryBadge.svelte";
  import StatusBadge from "./badges/StatusBadge.svelte";
  import PriorityBadge from "./badges/PriorityBadge.svelte";
  import ProjectBadge from "./badges/ProjectBadge.svelte";
  import AreaBadge from "./badges/AreaBadge.svelte";
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

  // Second row badges (project and areas)
  let secondaryBadges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    if (task.project) {
      // Extract display value from project (handles wiki links properly)
      const cleanProject =
        typeof task.project === "string"
          ? extractDisplayValue(task.project) ||
            task.project.replace(/^\[\[|\]\]$/g, "")
          : task.project;
      result.push({ text: cleanProject, type: "project" });
    }

    if (task.areas && Array.isArray(task.areas) && task.areas.length > 0) {
      task.areas.forEach((area) => {
        // Extract display value from areas (handles wiki links properly)
        const cleanArea =
          typeof area === "string"
            ? extractDisplayValue(area) || area.replace(/^\[\[|\]\]$/g, "")
            : area;
        result.push({ text: cleanArea, type: "area" });
      });
    }

    return result;
  });

  function handleAddToToday() {
    onAddToToday?.(task);
  }

  function handleOpenTask() {
    onClick?.();
  }
</script>

{#snippet actionSnippet()}
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
{/snippet}

<TaskItem
  title={task.title}
  {isHovered}
  {onHover}
  source={task.source}
  customContent={true}
  actionContent={true}
  actions={actionSnippet}
  {testId}
>
  <!-- Clean two-row layout -->
  <div class="task-sync-item-header">
    <div class="task-sync-item-title">{task.title}</div>

    <!-- Source information inline with title if available -->
    {#if task.source}
      <div class="task-sync-item-source-inline">
        <span class="task-sync-source-text">
          from {task.source.name}
          {#if task.source.key}
            #{task.source.key}
          {/if}
        </span>
      </div>
    {/if}
  </div>

  <!-- First row: category, priority, status badges -->
  {#if primaryBadges.length > 0}
    <div class="task-sync-item-badges-row task-sync-item-badges-primary">
      {#each primaryBadges as badge}
        {#if badge.type === "category"}
          <CategoryBadge category={badge.text} size="small" />
        {:else if badge.type === "status"}
          <StatusBadge status={badge.text} size="small" />
        {:else if badge.type === "priority"}
          <PriorityBadge priority={badge.text} size="small" />
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Second row: project and area badges -->
  {#if secondaryBadges.length > 0}
    <div class="task-sync-item-badges-row task-sync-item-badges-secondary">
      {#each secondaryBadges as badge}
        {#if badge.type === "project"}
          <ProjectBadge project={badge.text} size="small" />
        {:else if badge.type === "area"}
          <AreaBadge area={badge.text} size="small" />
        {/if}
      {/each}
    </div>
  {/if}
</TaskItem>

<!-- Styles moved to styles.css for consistency -->
