<script lang="ts">
  /**
   * LocalTasksService component for the new architecture
   * Provides task listing, filtering, sorting, and search functionality
   */

  import SearchInput from "./SearchInput.svelte";
  import FilterButton from "./FilterButton.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import LocalTaskItem from "./LocalTaskItem.svelte";
  import { getFilterOptions } from "../utils/contextFiltering";
  import type { TaskSyncSettings } from "../types/settings";
  import { createLocalTask, type LocalTask } from "../types/LocalTask";
  import type { Task, Schedule } from "../core/entities";
  import type { Extension } from "../core/extension";
  import type { Host } from "../core/host";
  import type { DailyPlanningExtension } from "../extensions/DailyPlanningExtension";
  import { isPlanningActive } from "../stores/contextStore";
  import { derived, type Readable } from "svelte/store";

  interface SortField {
    key: string;
    label: string;
    direction: "asc" | "desc";
  }

  interface LocalTasksViewSettings {
    // Recently used filters
    recentlyUsedProjects?: string[];
    recentlyUsedAreas?: string[];
    recentlyUsedSources?: string[];

    // Current filter selections
    selectedProject?: string | null;
    selectedArea?: string | null;
    selectedSource?: string | null;
    showCompleted?: boolean;
    sortFields?: SortField[];
  }

  interface Props {
    // Settings for badge colors and configuration
    settings: TaskSyncSettings;

    // Local tasks view specific settings
    localTasksSettings: LocalTasksViewSettings;

    // Extension that provides data access
    extension: Extension;

    // Host for data persistence
    host: Host;

    // Daily planning extension for planning functionality
    dailyPlanningExtension?: DailyPlanningExtension;

    // Unified staging state and handlers
    stagedTaskIds?: Set<string>;
    onStageTask?: (task: any) => void;

    // Test attributes
    testId?: string;
  }

  let {
    settings,
    localTasksSettings,
    extension,
    host,
    dailyPlanningExtension,
    stagedTaskIds = new Set(),
    onStageTask,
    testId,
  }: Props = $props();

  // ============================================================================
  // REACTIVE STATE - Only 3 elements as required
  // ============================================================================

  // 1. Tasks - current list from extension (processed)
  let tasks = $state<LocalTask[]>([]);

  // 2. Filters - currently applied filters (UI state)
  let filters = $state({
    project: localTasksSettings?.selectedProject ?? null,
    area: localTasksSettings?.selectedArea ?? null,
    source: localTasksSettings?.selectedSource ?? null,
    showCompleted: localTasksSettings?.showCompleted ?? false,
  });

  // 3. Sort - currently applied sorting logic (UI state)
  let sort = $state<SortField[]>(
    localTasksSettings?.sortFields ?? [
      { key: "updatedAt", label: "Updated", direction: "desc" },
      { key: "title", label: "Title", direction: "asc" },
    ]
  );

  // Search query (part of filtering)
  let searchQuery = $state("");

  // UI state (not part of the 3 core states)
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let hoveredTask = $state<string | null>(null);

  // Planning mode state
  let selectedTasksForPlanning = $state<Set<string>>(new Set());
  let stagedTasks = $state<Task[]>([]);

  // Recently used filters - for UI convenience
  let recentlyUsedProjects = $state<string[]>(
    localTasksSettings?.recentlyUsedProjects ?? []
  );
  let recentlyUsedAreas = $state<string[]>(
    localTasksSettings?.recentlyUsedAreas ?? []
  );
  let recentlyUsedSources = $state<string[]>(
    localTasksSettings?.recentlyUsedSources ?? []
  );

  // ============================================================================
  // DATA PROCESSING - Delegated to extension via derived store
  // ============================================================================

  /**
   * Create a derived store that processes tasks using extension methods
   * This is the ONLY place where we process tasks - all logic is in the extension
   */
  let processedTasksStore = $derived.by((): Readable<readonly LocalTask[]> => {
    const baseTasks = extension.getTasks();

    return derived(baseTasks, ($tasks) => {
      let processed: readonly Task[] = $tasks;

      // Apply filters using extension
      processed = extension.filterTasks(processed, filters);

      // Apply search using extension
      if (searchQuery) {
        processed = extension.searchTasks(searchQuery, processed);
      }

      // Apply sort using extension
      if (sort.length > 0) {
        processed = extension.sortTasks(processed, sort);
      }

      // Convert to LocalTask objects for rendering
      return processed.map((task: Task) => createLocalTask(task));
    });
  });

  /**
   * Subscribe to processed tasks and update local state
   * This is the ONLY effect - just subscribing to the derived store
   */
  $effect(() => {
    const unsubscribe = processedTasksStore.subscribe((processedTasks) => {
      tasks = [...processedTasks];
      // Reset hover state when tasks change
      hoveredTask = null;
    });

    return unsubscribe;
  });

  // ============================================================================
  // FILTER OPTIONS - Derived from all tasks (not filtered)
  // ============================================================================

  let allTasks = $state<Task[]>([]);

  // Subscribe to all tasks for filter options
  $effect(() => {
    const tasksStore = extension.getTasks();
    const unsubscribe = tasksStore.subscribe((extensionTasks) => {
      allTasks = [...extensionTasks];
    });
    return unsubscribe;
  });

  let filterOptions = $derived.by(() => getFilterOptions(allTasks));
  let projectOptions = $derived(filterOptions.projects);
  let areaOptions = $derived(filterOptions.areas);
  let sourceOptions = $derived(filterOptions.sources);

  // Available sort fields
  const availableSortFields = [
    { key: "title", label: "Title" },
    { key: "createdAt", label: "Created" },
    { key: "updatedAt", label: "Updated" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "category", label: "Category" },
    { key: "project", label: "Project" },
    { key: "areas", label: "Areas" },
  ];

  // ============================================================================
  // EVENT HANDLERS - Simple pass-through, no logic
  // ============================================================================

  async function refresh(): Promise<void> {
    await extension.refresh();
  }

  async function openTask(task: any): Promise<void> {
    host.openFile(task);
  }

  function handleSortChange(newSortFields: SortField[]): void {
    sort = newSortFields;
  }

  function handleFilterChange(key: keyof typeof filters, value: any): void {
    filters = { ...filters, [key]: value };
  }

  // ============================================================================
  // RECENTLY USED MANAGEMENT
  // ============================================================================

  function addRecentlyUsedProject(project: string): void {
    if (!project || recentlyUsedProjects.includes(project)) return;
    recentlyUsedProjects = [
      project,
      ...recentlyUsedProjects.filter((p) => p !== project),
    ].slice(0, 5);
  }

  function addRecentlyUsedArea(area: string): void {
    if (!area || recentlyUsedAreas.includes(area)) return;
    recentlyUsedAreas = [
      area,
      ...recentlyUsedAreas.filter((a) => a !== area),
    ].slice(0, 5);
  }

  function addRecentlyUsedSource(source: string): void {
    if (!source || recentlyUsedSources.includes(source)) return;
    recentlyUsedSources = [
      source,
      ...recentlyUsedSources.filter((s) => s !== source),
    ].slice(0, 5);
  }

  function removeRecentlyUsedProject(project: string): void {
    recentlyUsedProjects = recentlyUsedProjects.filter((p) => p !== project);
  }

  function removeRecentlyUsedArea(area: string): void {
    recentlyUsedAreas = recentlyUsedAreas.filter((a) => a !== area);
  }

  function removeRecentlyUsedSource(source: string): void {
    recentlyUsedSources = recentlyUsedSources.filter((s) => s !== source);
  }

  // ============================================================================
  // PLANNING MODE FUNCTIONS
  // ============================================================================

  function toggleTaskSelection(task: Task): void {
    if (!$isPlanningActive) return;

    const taskId = task.id;
    const newSelection = new Set(selectedTasksForPlanning);

    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }

    selectedTasksForPlanning = newSelection;
  }

  function addSelectedTasksToSchedule(): void {
    if (!$isPlanningActive || !dailyPlanningExtension) return;

    const tasksToAdd = tasks
      .filter((localTask) => selectedTasksForPlanning.has(localTask.task.id))
      .map((localTask) => localTask.task);

    // Add tasks to staging area
    stagedTasks = [...stagedTasks, ...tasksToAdd];

    // Move tasks to today's schedule via the daily planning extension
    tasksToAdd.forEach(async (task) => {
      try {
        await dailyPlanningExtension.moveTaskToToday(task);
      } catch (error) {
        console.error("Failed to add task to schedule:", error);
      }
    });

    // Clear selection
    selectedTasksForPlanning = new Set();
  }

  function clearSelection(): void {
    selectedTasksForPlanning = new Set();
  }
</script>

<div
  class="task-sync-service-container local-service"
  data-testid="local-service"
>
  <!-- Header Section -->
  <header>
    <!-- 1. Search with refresh group -->
    <SearchInput
      bind:value={searchQuery}
      placeholder="Search local tasks..."
      onInput={(value) => (searchQuery = value)}
      service="local"
      onRefresh={refresh}
    />

    <!-- 2. Primary filter buttons group - Project/Area/Source -->
    <div class="primary-filters">
      <FilterButton
        label="Project"
        currentValue={filters.project || "All projects"}
        allOptions={projectOptions}
        defaultOption="All projects"
        onselect={(value: string) => {
          const newProject =
            value === "All projects" || value === "" ? null : value;
          handleFilterChange("project", newProject);
          if (newProject) {
            addRecentlyUsedProject(newProject);
          }
        }}
        placeholder="All projects"
        testId="project-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={filters.project !== null}
        recentlyUsedItems={recentlyUsedProjects}
        onRemoveRecentItem={removeRecentlyUsedProject}
      />

      <FilterButton
        label="Area"
        currentValue={filters.area || "All areas"}
        allOptions={areaOptions}
        defaultOption="All areas"
        onselect={(value: string) => {
          const newArea = value === "All areas" || value === "" ? null : value;
          handleFilterChange("area", newArea);
          if (newArea) {
            addRecentlyUsedArea(newArea);
          }
        }}
        placeholder="All areas"
        testId="area-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={filters.area !== null}
        recentlyUsedItems={recentlyUsedAreas}
        onRemoveRecentItem={removeRecentlyUsedArea}
      />

      <FilterButton
        label="Source"
        currentValue={filters.source || "All sources"}
        allOptions={sourceOptions}
        defaultOption="All sources"
        onselect={(value: string) => {
          const newSource =
            value === "All sources" || value === "" ? null : value;
          handleFilterChange("source", newSource);
          if (newSource) {
            addRecentlyUsedSource(newSource);
          }
        }}
        placeholder="All sources"
        testId="source-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={filters.source !== null}
        recentlyUsedItems={recentlyUsedSources}
        onRemoveRecentItem={removeRecentlyUsedSource}
      />
    </div>

    <!-- 3. Secondary filter buttons group - first row: Show completed -->
    <div class="secondary-filters-row-1">
      <button
        class="task-sync-filter-toggle {filters.showCompleted ? 'active' : ''}"
        onclick={() => {
          handleFilterChange("showCompleted", !filters.showCompleted);
        }}
        data-testid="show-completed-toggle"
        title="Toggle showing completed tasks"
      >
        Show completed
      </button>
    </div>

    <!-- 5. Sort controls group -->
    <SortDropdown
      label="Sort by"
      sortFields={sort}
      availableFields={availableSortFields}
      onSortChange={handleSortChange}
      testId="local-tasks-sort"
    />
  </header>

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
        {#if tasks.length === 0}
          <div class="task-sync-empty-message">
            {searchQuery ? "No tasks match your search." : "No tasks found."}
          </div>
        {:else}
          {#each tasks as localTask (localTask.task.id)}
            <LocalTaskItem
              task={localTask.task}
              {localTask}
              isHovered={hoveredTask === localTask.task.id}
              isSelected={$isPlanningActive &&
                selectedTasksForPlanning.has(localTask.task.id)}
              onHover={(hovered: boolean) =>
                (hoveredTask = hovered ? localTask.task.id : null)}
              onClick={() => {
                if ($isPlanningActive) {
                  toggleTaskSelection(localTask.task);
                } else {
                  openTask(localTask.task);
                }
              }}
              onOpen={() => openTask(localTask.task)}
              dailyPlanningWizardMode={$isPlanningActive}
              onAddToToday={(task) => {
                if (onStageTask) {
                  onStageTask(task);
                }
              }}
              isStaged={stagedTaskIds.has(localTask.task.id)}
              {settings}
              testId="local-task-item-{localTask.task.title
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
</style>
