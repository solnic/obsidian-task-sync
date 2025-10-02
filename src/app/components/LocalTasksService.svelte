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

    // Daily planning mode state
    isPlanningActive?: boolean;
    currentSchedule?: Schedule | null;
    dailyPlanningExtension?: DailyPlanningExtension;

    // Test attributes
    testId?: string;
  }

  let {
    settings,
    localTasksSettings,
    extension,
    host,
    isPlanningActive = false,
    currentSchedule = null,
    dailyPlanningExtension,
    testId,
  }: Props = $props();

  // State
  let tasks = $state<Task[]>([]);
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let hoveredTask = $state<string | null>(null);

  // Planning mode state
  let selectedTasksForPlanning = $state<Set<string>>(new Set());
  let stagedTasks = $state<Task[]>([]);

  // Additional filter state - initialized from provided settings
  let selectedProject = $state<string | null>(
    localTasksSettings?.selectedProject ?? null
  );
  let selectedArea = $state<string | null>(
    localTasksSettings?.selectedArea ?? null
  );
  let selectedSource = $state<string | null>(
    localTasksSettings?.selectedSource ?? null
  );
  let showCompleted = $state(localTasksSettings?.showCompleted ?? false);

  // Recently used filters - initialized from provided settings
  let recentlyUsedProjects = $state<string[]>(
    localTasksSettings?.recentlyUsedProjects ?? []
  );
  let recentlyUsedAreas = $state<string[]>(
    localTasksSettings?.recentlyUsedAreas ?? []
  );
  let recentlyUsedSources = $state<string[]>(
    localTasksSettings?.recentlyUsedSources ?? []
  );

  // Sorting state - initialized from provided settings
  let sortFields = $state<SortField[]>(
    localTasksSettings?.sortFields ?? [
      { key: "updatedAt", label: "Updated", direction: "desc" },
      { key: "title", label: "Title", direction: "asc" },
    ]
  );

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

  // Computed filter options
  let filterOptions = $derived.by(() => {
    return getFilterOptions(tasks);
  });

  // Filter options are already clean strings from entities
  let projectOptions = $derived(filterOptions.projects);
  let areaOptions = $derived(filterOptions.areas);
  let sourceOptions = $derived(filterOptions.sources);

  // Computed filtered tasks - delegate to extension
  let filteredTasks = $derived.by(() => {
    // Start with all tasks
    let filtered: readonly Task[] = tasks;

    // Apply filtering using extension
    filtered = extension.filterTasks(filtered, {
      project: selectedProject,
      area: selectedArea,
      source: selectedSource,
      showCompleted: showCompleted,
    });

    // Apply search using extension
    if (searchQuery) {
      filtered = extension.searchTasks(searchQuery, filtered);
    }

    // Apply sorting using extension
    if (sortFields.length > 0) {
      filtered = extension.sortTasks(filtered, sortFields);
    }

    // Convert to LocalTask objects for rendering
    return filtered.map((task: Task) => createLocalTask(task));
  });

  // Reset hover state when filtered tasks change
  $effect(() => {
    // This effect runs when filteredTasks changes
    filteredTasks;
    hoveredTask = null;
  });

  // Subscribe to extension's tasks observable
  $effect(() => {
    const tasksStore = extension.getTasks();
    const unsubscribe = tasksStore.subscribe((extensionTasks) => {
      tasks = [...extensionTasks]; // Create mutable copy
    });

    return unsubscribe;
  });

  // Note: Settings are now provided via props, no need to load/save via host

  async function refresh(): Promise<void> {
    await extension.refresh();
  }

  // Task actions
  async function openTask(task: any): Promise<void> {
    host.openFile(task);
  }

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

  function handleSortChange(newSortFields: SortField[]): void {
    sortFields = newSortFields;
  }

  // Planning mode functions
  function toggleTaskSelection(task: Task): void {
    if (!isPlanningActive) return;

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
    if (!isPlanningActive || !dailyPlanningExtension) return;

    const tasksToAdd = filteredTasks
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
  <!-- Planning Mode Header -->
  {#if isPlanningActive}
    <div class="planning-header" data-testid="planning-header">
      <div class="planning-info">
        <h3>📅 Daily Planning Mode</h3>
        <p>Hover over tasks to see "Schedule for today" button</p>
      </div>
      <div class="planning-actions">
        {#if selectedTasksForPlanning.size > 0}
          <button
            class="planning-btn add-selected"
            onclick={addSelectedTasksToSchedule}
            data-testid="add-selected-tasks"
          >
            Add {selectedTasksForPlanning.size} task{selectedTasksForPlanning.size ===
            1
              ? ""
              : "s"} to schedule
          </button>
          <button
            class="planning-btn clear-selection"
            onclick={clearSelection}
            data-testid="clear-selection"
          >
            Clear selection
          </button>
        {:else}
          <span class="planning-hint"
            >Click tasks to select them for scheduling</span
          >
        {/if}
      </div>
    </div>
  {/if}

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
        currentValue={selectedProject || "All projects"}
        allOptions={projectOptions}
        defaultOption="All projects"
        onselect={(value: string) => {
          const newProject =
            value === "All projects" || value === "" ? null : value;
          selectedProject = newProject;
          if (newProject) {
            addRecentlyUsedProject(newProject);
          }
        }}
        placeholder="All projects"
        testId="project-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={selectedProject !== null}
        recentlyUsedItems={recentlyUsedProjects}
        onRemoveRecentItem={removeRecentlyUsedProject}
      />

      <FilterButton
        label="Area"
        currentValue={selectedArea || "All areas"}
        allOptions={areaOptions}
        defaultOption="All areas"
        onselect={(value: string) => {
          const newArea = value === "All areas" || value === "" ? null : value;
          selectedArea = newArea;
          if (newArea) {
            addRecentlyUsedArea(newArea);
          }
        }}
        placeholder="All areas"
        testId="area-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={selectedArea !== null}
        recentlyUsedItems={recentlyUsedAreas}
        onRemoveRecentItem={removeRecentlyUsedArea}
      />

      <FilterButton
        label="Source"
        currentValue={selectedSource || "All sources"}
        allOptions={sourceOptions}
        defaultOption="All sources"
        onselect={(value: string) => {
          const newSource =
            value === "All sources" || value === "" ? null : value;
          selectedSource = newSource;
          if (newSource) {
            addRecentlyUsedSource(newSource);
          }
        }}
        placeholder="All sources"
        testId="source-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={selectedSource !== null}
        recentlyUsedItems={recentlyUsedSources}
        onRemoveRecentItem={removeRecentlyUsedSource}
      />
    </div>

    <!-- 3. Secondary filter buttons group - first row: Show completed -->
    <div class="secondary-filters-row-1">
      <button
        class="task-sync-filter-toggle {showCompleted ? 'active' : ''}"
        onclick={() => {
          showCompleted = !showCompleted;
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
      {sortFields}
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
        {#if filteredTasks.length === 0}
          <div class="task-sync-empty-message">
            {searchQuery ? "No tasks match your search." : "No tasks found."}
          </div>
        {:else}
          {#each filteredTasks as localTask (localTask.task.id)}
            <LocalTaskItem
              task={localTask.task}
              {localTask}
              isHovered={hoveredTask === localTask.task.id}
              isSelected={isPlanningActive &&
                selectedTasksForPlanning.has(localTask.task.id)}
              onHover={(hovered: boolean) =>
                (hoveredTask = hovered ? localTask.task.id : null)}
              onClick={() => {
                if (isPlanningActive) {
                  toggleTaskSelection(localTask.task);
                } else {
                  openTask(localTask.task);
                }
              }}
              dailyPlanningWizardMode={isPlanningActive}
              onAddToToday={async (task) => {
                if (dailyPlanningExtension) {
                  await dailyPlanningExtension.stageTaskForToday(task);
                }
              }}
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
  .planning-header {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .planning-info h3 {
    margin: 0 0 4px 0;
    color: var(--text-normal);
    font-size: 16px;
    font-weight: 600;
  }

  .planning-info p {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }

  .planning-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .planning-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: opacity 0.2s ease;
  }

  .planning-btn:hover {
    opacity: 0.8;
  }

  .planning-btn.clear-selection {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .planning-hint {
    color: var(--text-muted);
    font-size: 14px;
    font-style: italic;
  }

  @media (max-width: 768px) {
    .planning-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .planning-actions {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
