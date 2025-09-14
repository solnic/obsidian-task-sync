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

  // Location for footer (project and areas)
  let location = $derived.by(() => {
    const parts: string[] = [];

    if (task.project) {
      // Extract display value from project (handles wiki links properly)
      const cleanProject =
        typeof task.project === "string"
          ? extractDisplayValue(task.project) ||
            task.project.replace(/^\[\[|\]\]$/g, "")
          : task.project;
      parts.push(`Project: ${cleanProject}`);
    }

    if (task.areas && Array.isArray(task.areas) && task.areas.length > 0) {
      const cleanAreas = task.areas.map((area) => {
        // Extract display value from areas (handles wiki links properly)
        return typeof area === "string"
          ? extractDisplayValue(area) || area.replace(/^\[\[|\]\]$/g, "")
          : area;
      });
      parts.push(
        `Area${cleanAreas.length > 1 ? "s" : ""}: ${cleanAreas.join(", ")}`
      );
    }

    return parts.join(" • ");
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
  badges={primaryBadges}
  {location}
  source={task.source}
  {isHovered}
  {onHover}
  actionContent={true}
  actions={actionSnippet}
  {testId}
/>

<!-- Styles moved to styles.css for consistency -->
