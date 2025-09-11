<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext, getContextStore } from "./context";
  import { taskStore } from "../../stores/taskStore";
  import SearchInput from "./SearchInput.svelte";
  import FilterDropdown from "./FilterDropdown.svelte";
  import LocalTaskItem from "./LocalTaskItem.svelte";
  import {
    filterLocalTasks,
    getFilterOptions,
    getContextFilters,
  } from "../../utils/contextFiltering";
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
  let selectedParentTask = $state<string | null>(null);

  // Subscribe to context changes
  $effect(() => {
    const unsubscribe = contextStore.subscribe((value) => {
      currentContext = value;

      // Get filters based on new context
      const filters = getContextFilters(value);

      // Reset all filters first, then apply context filters
      selectedProject = filters.project;
      selectedArea = filters.area;
      selectedParentTask = filters.parentTask;
    });
    return unsubscribe;
  });

  // Computed filter options
  let filterOptions = $derived.by(() => {
    return getFilterOptions(tasks);
  });

  // Computed filtered tasks with context and additional filters
  let filteredTasks = $derived.by(() => {
    // Start with context-based filtering
    let filtered = filterLocalTasks(tasks, currentContext, {
      project: selectedProject,
      area: selectedArea,
      parentTask: selectedParentTask,
    });

    // Apply search filter
    if (searchQuery) {
      filtered = searchTasks(searchQuery, filtered);
    }

    return filtered;
  });

  // Get context filters for display
  let contextFilters = $derived.by(() => {
    return getContextFilters(currentContext);
  });

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
          Array.isArray(task.areas) &&
          task.areas.some(
            (area) =>
              typeof area === "string" &&
              area.toLowerCase().includes(lowerQuery)
          ))
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
          isActive={!!contextFilters.project}
        />

        <FilterDropdown
          label="Area"
          currentValue={selectedArea}
          options={filterOptions.areas}
          onselect={(value) => (selectedArea = value)}
          testId="area-filter"
          isActive={!!contextFilters.area}
        />

        <FilterDropdown
          label="Parent"
          currentValue={selectedParentTask}
          options={filterOptions.parentTasks}
          onselect={(value) => (selectedParentTask = value)}
          testId="parent-task-filter"
          isActive={!!contextFilters.parentTask}
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
          {#each filteredTasks as task}
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
              testId="local-task-item"
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
