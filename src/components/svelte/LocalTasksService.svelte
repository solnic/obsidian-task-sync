<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext, getContextStore } from "./context";
  import { taskStore } from "../../stores/taskStore";
  import SearchInput from "./SearchInput.svelte";
  import FilterDropdown from "./FilterDropdown.svelte";
  import LocalTaskItem from "./LocalTaskItem.svelte";
  import { getFilterOptions } from "../../utils/contextFiltering";
  import type { Task } from "../../types/entities";
  import type { FileContext } from "../../main";

  interface Props {
    dayPlanningMode?: boolean;
  }

  let { dayPlanningMode = false }: Props = $props();

  const { plugin } = getPluginContext();
  const contextStore = getContextStore();

  // State
  let tasks = $state<Task[]>([]);
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let hoveredTask = $state<string | null>(null);
  let currentContext = $state<FileContext>({ type: "none" });

  // Additional filter state
  let selectedProject = $state<string | null>(null);
  let selectedArea = $state<string | null>(null);

  // Subscribe to context changes
  $effect(() => {
    const unsubscribe = contextStore.subscribe((value) => {
      currentContext = value;
      // Note: No longer automatically setting filters based on context
      // Users should manually set filters as needed
    });
    return unsubscribe;
  });

  // Computed filter options
  let filterOptions = $derived.by(() => {
    return getFilterOptions(tasks);
  });

  // Computed filtered tasks with manual filters only
  let filteredTasks = $derived.by(() => {
    // Start with all tasks, apply only manual filters
    let filtered = tasks.filter((task) => {
      // Project filter
      if (selectedProject) {
        const taskProject =
          typeof task.project === "string"
            ? task.project.replace(/^\[\[|\]\]$/g, "")
            : task.project;
        if (taskProject !== selectedProject) {
          return false;
        }
      }

      // Area filter
      if (selectedArea) {
        let taskAreas: string[] = [];
        if (task.areas) {
          if (Array.isArray(task.areas)) {
            taskAreas = task.areas.map((area) =>
              typeof area === "string" ? area.replace(/^\[\[|\]\]$/g, "") : area
            );
          } else if (typeof (task.areas as any) === "string") {
            taskAreas = [(task.areas as any).replace(/^\[\[|\]\]$/g, "")];
          }
        }
        if (!taskAreas.includes(selectedArea)) {
          return false;
        }
      }

      return true;
    });

    // Apply search filter
    if (searchQuery) {
      filtered = searchTasks(searchQuery, filtered);
    }

    return filtered;
  });

  // Reset hover state when filtered tasks change
  $effect(() => {
    // This effect runs when filteredTasks changes
    filteredTasks;
    hoveredTask = null;
  });

  // Note: No longer using context filters for automatic filtering

  onMount(() => {
    // Subscribe to task store updates immediately
    const unsubscribe = taskStore.subscribe((state) => {
      tasks = state.entities;
      isLoading = state.loading;
      error = state.error;
    });

    return unsubscribe;
  });

  function searchTasks(query: string, taskList: Task[]): Task[] {
    const lowerQuery = query.toLowerCase();

    return taskList.filter(
      (task) =>
        task.title.toLowerCase().includes(lowerQuery) ||
        (task.category && task.category.toLowerCase().includes(lowerQuery)) ||
        (task.status && task.status.toLowerCase().includes(lowerQuery)) ||
        (task.project &&
          typeof task.project === "string" &&
          task.project.toLowerCase().includes(lowerQuery)) ||
        (task.areas &&
          ((Array.isArray(task.areas) &&
            task.areas.some(
              (area) =>
                typeof area === "string" &&
                area.toLowerCase().includes(lowerQuery)
            )) ||
            (typeof (task.areas as any) === "string" &&
              (task.areas as any).toLowerCase().includes(lowerQuery))))
    );
  }

  async function refresh(): Promise<void> {
    try {
      await taskStore.refreshTasks();
    } catch (err: any) {
      console.error("Failed to refresh tasks:", err);
    }
  }

  async function addToToday(task: Task): Promise<void> {
    try {
      // Use the DailyNoteService to add the task to today's daily note
      const result = await plugin.dailyNoteService.addTaskToToday(
        task.filePath
      );

      if (result.success) {
        new Notice(`Added "${task.title}" to today's daily note`);
      } else {
        new Notice(
          `Failed to add task to today: ${result.error || "Unknown error"}`
        );
      }
    } catch (error: any) {
      console.error("Error adding task to today:", error);
      new Notice(
        `Error adding task to today: ${error.message || "Unknown error"}`
      );
    }
  }

  // Expose methods for the wrapper
  $effect(() => {
    if (typeof window !== "undefined") {
      (window as any).__localTasksServiceMethods = {
        refresh,
      };
    }
  });
</script>

<div
  class="local-tasks-service"
  data-type="local-tasks-service"
  data-testid="local-tasks-service"
>
  <!-- Header Section -->
  <div class="local-tasks-header">
    <!-- Search and Filters -->
    <div class="search-and-filters">
      <SearchInput
        bind:value={searchQuery}
        placeholder="Search local tasks..."
        onInput={(value) => (searchQuery = value)}
        onRefresh={refresh}
        testId="local-search-input"
      />

      <!-- Filter Dropdowns -->
      <div class="task-sync-local-filters">
        <FilterDropdown
          label="Project"
          currentValue={selectedProject}
          options={filterOptions.projects}
          onselect={(value) => (selectedProject = value)}
          testId="project-filter"
        />

        <FilterDropdown
          label="Area"
          currentValue={selectedArea}
          options={filterOptions.areas}
          onselect={(value) => (selectedArea = value)}
          testId="area-filter"
        />
      </div>
    </div>
  </div>

  <!-- Content Section -->
  <div class="task-sync-task-list-container">
    {#if error}
      <div class="task-sync-error-message">
        {error}
      </div>
    {:else if isLoading}
      <div class="task-sync-loading-indicator">Loading local tasks...</div>
    {:else}
      <div class="task-sync-task-list">
        {#if filteredTasks.length === 0}
          <div class="task-sync-empty-message">
            {searchQuery ? "No tasks match your search." : "No tasks found."}
          </div>
        {:else}
          {#each filteredTasks as task (task.id)}
            <LocalTaskItem
              {task}
              isHovered={hoveredTask === task.id}
              onHover={(hovered) => (hoveredTask = hovered ? task.id : null)}
              onClick={() => {
                if (task.file) {
                  plugin.app.workspace.getLeaf().openFile(task.file);
                }
              }}
              {dayPlanningMode}
              onAddToToday={addToToday}
              testId="local-task-item-{task.title
                .replace(/\s+/g, '-')
                .toLowerCase()}"
            />
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* No local styles needed - using LocalTaskItem component */
</style>
