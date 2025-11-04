<script lang="ts">
  /**
   * LocalTasksService component for the new architecture
   * Provides task listing, filtering, sorting, and search functionality
   *
   * Updated to use Svelte 5 $derived runes with taskStore and TaskQueryService
   * instead of derived stores and extension methods.
   */

  import SearchInput from "./SearchInput.svelte";
  import FilterButton from "./FilterButton.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import LocalTaskItem from "./LocalTaskItem.svelte";
  import { getFilterOptions } from "../utils/contextFiltering";
  import type { TaskSyncSettings } from "../types/settings";
  import { createLocalTask, type LocalTask } from "../types/LocalTask";
  import type { Task } from "../core/entities";
  import type { Extension } from "../core/extension";
  import type { Host } from "../core/host";
  import type { DailyPlanningExtension } from "../extensions/daily-planning/DailyPlanningExtension";
  import { isPlanningActive } from "../stores/contextStore";
  import { taskStore } from "../stores/taskStore";
  import { TaskQueryService } from "../services/TaskQueryService";

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
    showScheduled?: boolean;
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
  // REACTIVE STATE - UI state only (data comes from store)
  // ============================================================================

  // Filters - derived from localTasksSettings prop, with local overrides
  let filterOverrides = $state<{
    project?: string | null;
    area?: string | null;
    source?: string | null;
    showCompleted?: boolean;
    showScheduled?: boolean;
  }>({});

  // Derived filters that combine prop values with local overrides
  let filters = $derived({
    project:
      filterOverrides.project ?? localTasksSettings?.selectedProject ?? null,
    area: filterOverrides.area ?? localTasksSettings?.selectedArea ?? null,
    source:
      filterOverrides.source ?? localTasksSettings?.selectedSource ?? null,
    showCompleted:
      filterOverrides.showCompleted ??
      localTasksSettings?.showCompleted ??
      false,
    showScheduled:
      filterOverrides.showScheduled ??
      localTasksSettings?.showScheduled ??
      false,
  });

  // Sort - currently applied sorting logic (UI state)
  let sort = $state<SortField[]>(
    localTasksSettings?.sortFields ?? [
      { key: "updatedAt", label: "Updated", direction: "desc" },
      { key: "title", label: "Title", direction: "asc" },
    ]
  );

  // Search query (part of filtering)
  let searchQuery = $state("");

  // UI state
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
  // DATA PROCESSING - Using Svelte 5 $derived with taskStore and TaskQueryService
  // ============================================================================

  /**
   * Get store state reactively
   * Subscribe to taskStore to get all tasks
   */
  let storeState = $derived($taskStore);

  /**
   * Get all tasks from the store that have Obsidian notes
   * This includes tasks imported from other sources (like GitHub) that have been saved as notes
   * Filter by source.keys.obsidian to get all tasks with Obsidian notes
   */
  let allTasks = $derived(
    storeState.tasks.filter((task) => task.source.keys.obsidian !== undefined)
  );

  /**
   * Process tasks using TaskQueryService
   * Apply filters, search, and sort using pure functions
   */
  let tasks = $derived.by((): LocalTask[] => {
    let processed: readonly Task[] = allTasks;

    // Apply filters using TaskQueryService
    processed = TaskQueryService.filter(processed, {
      project: filters.project || undefined,
      area: filters.area || undefined,
      source: filters.source || undefined,
      showCompleted: filters.showCompleted,
      showScheduled: filters.showScheduled,
    });

    // Apply search using TaskQueryService
    if (searchQuery) {
      processed = TaskQueryService.search(processed, searchQuery);
    }

    // Apply sort using TaskQueryService
    if (sort.length > 0) {
      // Convert sort fields to TaskQueryService format
      const sortFields = sort.map((s) => ({
        field: s.key as keyof Task,
        direction: s.direction,
      }));
      processed = TaskQueryService.sort(processed, sortFields);
    }

    // Convert to LocalTask objects for rendering
    return processed.map((task: Task) => createLocalTask(task));
  });

  // ============================================================================
  // FILTER OPTIONS - Derived from all tasks (not filtered)
  // ============================================================================

  /**
   * Get filter options from all tasks (before filtering)
   * This provides the available options for project/area/source dropdowns
   */
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
    try {
      // Show loading state
      isLoading = true;
      error = null;

      // Use extension's refresh method which triggers automatic sync
      await extension.refresh();

      isLoading = false;
    } catch (err: any) {
      console.error("Failed to refresh local tasks:", err);
      error = err.message;
      isLoading = false;
    }
  }

  async function openTask(task: any): Promise<void> {
    host.openFile(task);
  }

  function handleSortChange(newSortFields: SortField[]): void {
    sort = newSortFields;
  }

  function handleFilterChange(key: keyof typeof filters, value: any): void {
    // Update the override for this filter
    filterOverrides = { ...filterOverrides, [key]: value };
    // Persist filter changes
    saveFilterSettings();
  }

  async function saveFilterSettings(): Promise<void> {
    try {
      const data = (await host.loadData()) || {};
      data.localTasksFilters = {
        selectedProject: filters.project,
        selectedArea: filters.area,
        selectedSource: filters.source,
        showCompleted: filters.showCompleted,
        recentlyUsedProjects,
        recentlyUsedAreas,
        recentlyUsedSources,
      };
      await host.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save local tasks filter settings:", err.message);
    }
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
    saveFilterSettings();
  }

  function addRecentlyUsedArea(area: string): void {
    if (!area || recentlyUsedAreas.includes(area)) return;
    recentlyUsedAreas = [
      area,
      ...recentlyUsedAreas.filter((a) => a !== area),
    ].slice(0, 5);
    saveFilterSettings();
  }

  function addRecentlyUsedSource(source: string): void {
    if (!source || recentlyUsedSources.includes(source)) return;
    recentlyUsedSources = [
      source,
      ...recentlyUsedSources.filter((s) => s !== source),
    ].slice(0, 5);
    saveFilterSettings();
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

    <!-- 3. Secondary filter buttons group - first row: Show completed and Scheduled -->
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

      <button
        class="task-sync-filter-toggle {filters.showScheduled ? 'active' : ''}"
        onclick={() => {
          handleFilterChange("showScheduled", !filters.showScheduled);
        }}
        data-testid="show-scheduled-toggle"
        title="Toggle showing only scheduled tasks"
      >
        Scheduled
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
      <div class="task-sync-loading-indicator" data-testid="loading-indicator">
        Loading local tasks...
      </div>
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
