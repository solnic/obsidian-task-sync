<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext, getContextStore } from "./context";
  import { taskStore } from "../../stores/taskStore";
  import SearchInput from "./SearchInput.svelte";
  import FilterButton from "./FilterButton.svelte";
  import LocalTaskItem from "./LocalTaskItem.svelte";
  import { getFilterOptions } from "../../utils/contextFiltering";
  import { extractDisplayValue } from "../../utils/linkUtils";
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
  let selectedSource = $state<string | null>(null);
  let showCompleted = $state(false);

  // Recently used filters
  let recentlyUsedProjects = $state<string[]>([]);
  let recentlyUsedAreas = $state<string[]>([]);
  let recentlyUsedSources = $state<string[]>([]);

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

  // Computed options with recently used items at the top
  let projectOptionsWithRecent = $derived.by(() => {
    const allProjects = filterOptions.projects.map(
      (p) => extractDisplayValue(p) || p
    );
    const recentProjects = recentlyUsedProjects.filter((project) =>
      allProjects.includes(project)
    );
    const otherProjects = allProjects.filter(
      (project) => !recentProjects.includes(project)
    );

    const options = ["All projects"];
    if (recentProjects.length > 0) {
      options.push(...recentProjects);
      if (otherProjects.length > 0) {
        options.push("---"); // Separator
        options.push(...otherProjects);
      }
    } else {
      options.push(...otherProjects);
    }
    return options;
  });

  let areaOptionsWithRecent = $derived.by(() => {
    const allAreas = filterOptions.areas.map(
      (a) => extractDisplayValue(a) || a
    );
    const recentAreas = recentlyUsedAreas.filter((area) =>
      allAreas.includes(area)
    );
    const otherAreas = allAreas.filter((area) => !recentAreas.includes(area));

    const options = ["All areas"];
    if (recentAreas.length > 0) {
      options.push(...recentAreas);
      if (otherAreas.length > 0) {
        options.push("---"); // Separator
        options.push(...otherAreas);
      }
    } else {
      options.push(...otherAreas);
    }
    return options;
  });

  let sourceOptionsWithRecent = $derived.by(() => {
    const allSources = filterOptions.sources;
    const recentSources = recentlyUsedSources.filter((source) =>
      allSources.includes(source)
    );
    const otherSources = allSources.filter(
      (source) => !recentSources.includes(source)
    );

    const options = ["All sources"];
    if (recentSources.length > 0) {
      options.push(...recentSources);
      if (otherSources.length > 0) {
        options.push("---"); // Separator
        options.push(...otherSources);
      }
    } else {
      options.push(...otherSources);
    }
    return options;
  });

  // Computed filtered tasks with manual filters only
  let filteredTasks = $derived.by(() => {
    // Start with all tasks, apply only manual filters
    let filtered = tasks.filter((task) => {
      // Project filter
      if (selectedProject) {
        const taskProject =
          typeof task.project === "string"
            ? extractDisplayValue(task.project) ||
              task.project.replace(/^\[\[|\]\]$/g, "")
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
              typeof area === "string"
                ? extractDisplayValue(area) || area.replace(/^\[\[|\]\]$/g, "")
                : area
            );
          } else if (typeof (task.areas as any) === "string") {
            const areaStr = task.areas as any;
            taskAreas = [
              extractDisplayValue(areaStr) ||
                areaStr.replace(/^\[\[|\]\]$/g, ""),
            ];
          }
        }
        if (!taskAreas.includes(selectedArea)) {
          return false;
        }
      }

      // Source filter
      if (selectedSource) {
        const taskSource = task.source?.name;
        if (taskSource !== selectedSource) {
          return false;
        }
      }

      // Completed filter - exclude completed tasks unless showCompleted is true
      if (!showCompleted && task.done === true) {
        return false;
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
    // Load recently used filters
    loadRecentlyUsedFilters();

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
      // Force refresh by reloading all tasks from filesystem
      await taskStore.refreshTasks();
    } catch (err: any) {
      console.error("Failed to refresh tasks:", err);
    }
  }

  // Recently used filters management
  async function loadRecentlyUsedFilters(): Promise<void> {
    try {
      const data = await plugin.loadData();
      if (data?.localTasksRecentlyUsed) {
        recentlyUsedProjects = data.localTasksRecentlyUsed.projects || [];
        recentlyUsedAreas = data.localTasksRecentlyUsed.areas || [];
        recentlyUsedSources = data.localTasksRecentlyUsed.sources || [];
      }
    } catch (err: any) {
      console.warn("Failed to load recently used filters:", err.message);
    }
  }

  async function saveRecentlyUsedFilters(): Promise<void> {
    try {
      const data = (await plugin.loadData()) || {};
      data.localTasksRecentlyUsed = {
        projects: recentlyUsedProjects,
        areas: recentlyUsedAreas,
        sources: recentlyUsedSources,
      };
      await plugin.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save recently used filters:", err.message);
    }
  }

  function addRecentlyUsedProject(project: string): void {
    if (!project || recentlyUsedProjects.includes(project)) return;
    recentlyUsedProjects = [
      project,
      ...recentlyUsedProjects.filter((p) => p !== project),
    ].slice(0, 5);
    saveRecentlyUsedFilters();
  }

  function addRecentlyUsedArea(area: string): void {
    if (!area || recentlyUsedAreas.includes(area)) return;
    recentlyUsedAreas = [
      area,
      ...recentlyUsedAreas.filter((a) => a !== area),
    ].slice(0, 5);
    saveRecentlyUsedFilters();
  }

  function addRecentlyUsedSource(source: string): void {
    if (!source || recentlyUsedSources.includes(source)) return;
    recentlyUsedSources = [
      source,
      ...recentlyUsedSources.filter((s) => s !== source),
    ].slice(0, 5);
    saveRecentlyUsedFilters();
  }

  function removeRecentlyUsedProject(project: string): void {
    recentlyUsedProjects = recentlyUsedProjects.filter((p) => p !== project);
    saveRecentlyUsedFilters();
  }

  function removeRecentlyUsedArea(area: string): void {
    recentlyUsedAreas = recentlyUsedAreas.filter((a) => a !== area);
    saveRecentlyUsedFilters();
  }

  function removeRecentlyUsedSource(source: string): void {
    recentlyUsedSources = recentlyUsedSources.filter((s) => s !== source);
    saveRecentlyUsedFilters();
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

      <!-- Filter Buttons with Auto-suggest -->
      <div class="task-sync-local-filters">
        <FilterButton
          label="Project"
          currentValue={selectedProject
            ? extractDisplayValue(selectedProject) || selectedProject
            : "All projects"}
          options={projectOptionsWithRecent}
          onselect={(value: string) => {
            const newProject = value === "All projects" ? null : value;
            selectedProject = newProject;
            if (newProject) {
              addRecentlyUsedProject(newProject);
            }
          }}
          placeholder="All projects"
          testId="project-filter"
          autoSuggest={true}
          allowClear={true}
          recentlyUsedItems={recentlyUsedProjects}
          onRemoveRecentItem={removeRecentlyUsedProject}
        />

        <FilterButton
          label="Area"
          currentValue={selectedArea
            ? extractDisplayValue(selectedArea) || selectedArea
            : "All areas"}
          options={areaOptionsWithRecent}
          onselect={(value: string) => {
            const newArea = value === "All areas" ? null : value;
            selectedArea = newArea;
            if (newArea) {
              addRecentlyUsedArea(newArea);
            }
          }}
          placeholder="All areas"
          testId="area-filter"
          autoSuggest={true}
          allowClear={true}
          recentlyUsedItems={recentlyUsedAreas}
          onRemoveRecentItem={removeRecentlyUsedArea}
        />

        <FilterButton
          label="Source"
          currentValue={selectedSource || "All sources"}
          options={sourceOptionsWithRecent}
          onselect={(value: string) => {
            const newSource = value === "All sources" ? null : value;
            selectedSource = newSource;
            if (newSource) {
              addRecentlyUsedSource(newSource);
            }
          }}
          placeholder="All sources"
          testId="source-filter"
          autoSuggest={true}
          allowClear={true}
          recentlyUsedItems={recentlyUsedSources}
          onRemoveRecentItem={removeRecentlyUsedSource}
        />

        <!-- Show completed toggle -->
        <button
          class="task-sync-filter-toggle {showCompleted ? 'active' : ''}"
          onclick={() => (showCompleted = !showCompleted)}
          data-testid="show-completed-toggle"
          type="button"
          title="Toggle showing completed tasks"
        >
          Show completed
        </button>
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
              onHover={(hovered: boolean) =>
                (hoveredTask = hovered ? task.id : null)}
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
