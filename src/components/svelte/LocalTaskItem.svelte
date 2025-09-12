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
      result.push({ text: task.project, type: "project" });
    }

    if (task.areas && Array.isArray(task.areas) && task.areas.length > 0) {
      task.areas.forEach((area) => {
        result.push({ text: area, type: "area" });
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

<!-- Clickable wrapper for local tasks -->
<div
  class="local-task-item-wrapper"
  onclick={handleOpenTask}
  onkeydown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenTask();
    }
  }}
  role="button"
  tabindex="0"
  data-testid={testId}
>
  <TaskItem title={task.title} {isHovered} {onHover} customContent={true}>
    <!-- Custom content with two badge rows -->
    <div class="task-sync-item-header">
      <div class="task-sync-item-title">{task.title}</div>
    </div>

    <!-- First row: category, priority, status badges -->
    {#if primaryBadges.length > 0}
      <div class="task-sync-item-badges">
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
      <div class="task-sync-item-badges">
        {#each secondaryBadges as badge}
          {#if badge.type === "project"}
            <ProjectBadge project={badge.text} size="small" />
          {:else if badge.type === "area"}
            <AreaBadge area={badge.text} size="small" />
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Action buttons on hover -->
    {#if isHovered}
      <div class="action-buttons">
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
      </div>
    {/if}
  </TaskItem>
</div>

<style>
  .local-task-item-wrapper {
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .local-task-item-wrapper:hover {
    background: var(--background-modifier-hover);
  }

  .local-task-item-wrapper:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
  }

  .add-to-today-button,
  .open-task-button {
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

  .add-to-today-button:hover,
  .open-task-button:hover {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }
</style>
