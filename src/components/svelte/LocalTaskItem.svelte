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
      // Remove wiki link brackets from project
      const cleanProject =
        typeof task.project === "string"
          ? task.project.replace(/^\[\[|\]\]$/g, "")
          : task.project;
      result.push({ text: cleanProject, type: "project" });
    }

    if (task.areas && Array.isArray(task.areas) && task.areas.length > 0) {
      task.areas.forEach((area) => {
        // Remove wiki link brackets from areas
        const cleanArea =
          typeof area === "string" ? area.replace(/^\[\[|\]\]$/g, "") : area;
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
  <!-- Custom content with two badge rows -->
  <div class="task-sync-item-header">
    <div class="task-sync-item-title">{task.title}</div>
  </div>

  <!-- Source information if available -->
  {#if task.source}
    <div class="task-sync-item-source">
      <span
        class="task-sync-source-badge"
        title="Imported from {task.source.name}"
      >
        <span class="task-sync-source-icon">🔗</span>
        {task.source.name}
        {#if task.source.key}
          <span class="task-sync-source-key">#{task.source.key}</span>
        {/if}
      </span>
    </div>
  {/if}

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
</TaskItem>

<!-- Styles moved to styles.css for consistency -->
