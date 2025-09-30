<script lang="ts">
  /**
   * LocalTasksService component for the new architecture
   * Provides task listing, filtering, sorting, and search functionality
   */

  import SearchInput from "./SearchInput.svelte";
  import RefreshButton from "./RefreshButton.svelte";
  import FilterButton from "./FilterButton.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import LocalTaskItem from "./LocalTaskItem.svelte";
  import { getFilterOptions } from "../utils/contextFiltering";
  import type { TaskSyncSettings } from "../types/settings";
  import { createLocalTask, type LocalTask } from "../types/LocalTask";
  import type { Task } from "../core/entities";
  import type { Extension } from "../core/extension";
  import type { Host } from "../core/host";

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

    // Test attributes
    testId?: string;
  }

  let { settings, localTasksSettings, extension, host, testId }: Props =
    $props();

  // State
  let tasks = $state<Task[]>([]);
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let hoveredTask = $state<string | null>(null);

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
</script>

<div
  class="local-tasks-service"
  data-type="local-tasks-service"
  data-testid={testId || "local-tasks-service"}
>
  <!-- Header Section -->
  <div class="local-tasks-header">
    <!-- Search and Filters -->
    <div class="search-and-filters">
      <SearchInput
        bind:value={searchQuery}
        placeholder="Search local tasks..."
        onInput={(value) => (searchQuery = value)}
        showRefreshButton={false}
        testId="local-search-input"
      />
      <RefreshButton onRefresh={refresh} testId="local-refresh-button" />

      <!-- Filter Buttons with Auto-suggest -->
      <div class="task-sync-local-filters">
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
            const newArea =
              value === "All areas" || value === "" ? null : value;
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

        <!-- Show completed toggle -->
        <button
          class="task-sync-filter-toggle {showCompleted ? 'active' : ''}"
          onclick={() => {
            showCompleted = !showCompleted;
          }}
          data-testid="show-completed-toggle"
          type="button"
          title="Toggle showing completed tasks"
        >
          Show completed
        </button>
      </div>

      <!-- Sorting Section -->
      <div class="task-sync-sort-section">
        <SortDropdown
          label="Sort by"
          {sortFields}
          availableFields={availableSortFields}
          onSortChange={handleSortChange}
          testId="local-tasks-sort"
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
          {#each filteredTasks as localTask (localTask.task.id)}
            <LocalTaskItem
              task={localTask.task}
              {localTask}
              isHovered={hoveredTask === localTask.task.id}
              onHover={(hovered: boolean) =>
                (hoveredTask = hovered ? localTask.task.id : null)}
              onClick={() => openTask(localTask.task)}
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
