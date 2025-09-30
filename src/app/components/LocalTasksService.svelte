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
  import { extractDisplayValue } from "../utils/linkUtils";
  import type { TaskSyncSettings } from "../types/settings";
  import { createLocalTask, type LocalTask } from "../types/LocalTask";
  import type { Task } from "../core/entities";
  import { PRIORITY_ORDER } from "../constants/defaults";
  import type { Extension } from "../core/extension";

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
    settings?: TaskSyncSettings;

    // Local tasks view specific settings
    localTasksSettings?: LocalTasksViewSettings;

    // Extension that provides data access
    extension: Extension;

    // Host for data persistence
    host?: any; // Host interface for saving/loading data

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

  // Create LocalTask view objects for proper sorting
  let localTasks = $derived.by(() => {
    return tasks.map((task: any) => createLocalTask(task));
  });

  // Computed filtered tasks with manual filters only
  let filteredTasks = $derived.by(() => {
    // Start with all LocalTask objects, apply only manual filters
    let filtered = localTasks.filter((localTask) => {
      const task = localTask.task;

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
            taskAreas = task.areas.map((area: any) =>
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
        const taskSource = task.source?.filePath;
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
      filtered = searchLocalTasks(searchQuery, filtered);
    }

    // Apply sorting using LocalTask sortable attributes
    if (sortFields.length > 0) {
      filtered = sortLocalTasks(filtered, sortFields);
    }

    // Return the LocalTask objects for rendering
    return filtered;
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

  function searchLocalTasks(
    query: string,
    localTaskList: LocalTask[]
  ): LocalTask[] {
    const lowerQuery = query.toLowerCase();

    return localTaskList.filter((localTask) => {
      const task = localTask.task;
      return (
        task.title.toLowerCase().includes(lowerQuery) ||
        (task.category && task.category.toLowerCase().includes(lowerQuery)) ||
        (task.status && task.status.toLowerCase().includes(lowerQuery)) ||
        (task.project &&
          typeof task.project === "string" &&
          task.project.toLowerCase().includes(lowerQuery)) ||
        (task.areas &&
          ((Array.isArray(task.areas) &&
            task.areas.some(
              (area: any) =>
                typeof area === "string" &&
                area.toLowerCase().includes(lowerQuery)
            )) ||
            (typeof (task.areas as any) === "string" &&
              (task.areas as any).toLowerCase().includes(lowerQuery))))
      );
    });
  }

  function sortLocalTasks(
    localTaskList: any[],
    sortFields: SortField[]
  ): any[] {
    return [...localTaskList].sort((a, b) => {
      for (const field of sortFields) {
        let aValue: any;
        let bValue: any;

        // Get values from sortable attributes
        switch (field.key) {
          case "title":
            aValue = a.sortable.title;
            bValue = b.sortable.title;
            break;
          case "createdAt":
            aValue =
              a.sortable.createdAt && !isNaN(a.sortable.createdAt.getTime())
                ? a.sortable.createdAt.getTime()
                : 0;
            bValue =
              b.sortable.createdAt && !isNaN(b.sortable.createdAt.getTime())
                ? b.sortable.createdAt.getTime()
                : 0;
            break;
          case "updatedAt":
            aValue =
              a.sortable.updatedAt && !isNaN(a.sortable.updatedAt.getTime())
                ? a.sortable.updatedAt.getTime()
                : 0;
            bValue =
              b.sortable.updatedAt && !isNaN(b.sortable.updatedAt.getTime())
                ? b.sortable.updatedAt.getTime()
                : 0;
            break;
          case "priority":
            // Priority order from centralized constants
            aValue =
              (a.sortable.priority &&
                PRIORITY_ORDER[
                  a.sortable.priority as keyof typeof PRIORITY_ORDER
                ]) ||
              0;
            bValue =
              (b.sortable.priority &&
                PRIORITY_ORDER[
                  b.sortable.priority as keyof typeof PRIORITY_ORDER
                ]) ||
              0;
            break;
          case "status":
            aValue = a.sortable.status;
            bValue = b.sortable.status;
            break;
          case "category":
            aValue = a.sortable.category;
            bValue = b.sortable.category;
            break;
          case "project":
            aValue = a.sortable.project;
            bValue = b.sortable.project;
            break;
          case "areas":
            aValue = a.sortable.areas;
            bValue = b.sortable.areas;
            break;
          default:
            aValue = "";
            bValue = "";
        }

        // Compare values
        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          // Handle mixed types by converting to strings
          comparison = String(aValue).localeCompare(String(bValue));
        }

        // Apply direction
        if (field.direction === "desc") {
          comparison = -comparison;
        }

        // If not equal, return the comparison result
        if (comparison !== 0) {
          return comparison;
        }
      }

      // If all fields are equal, maintain original order
      return 0;
    });
  }

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
          currentValue={selectedProject
            ? extractDisplayValue(selectedProject) || selectedProject
            : "All projects"}
          options={projectOptionsWithRecent}
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
          currentValue={selectedArea
            ? extractDisplayValue(selectedArea) || selectedArea
            : "All areas"}
          options={areaOptionsWithRecent}
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
          options={sourceOptionsWithRecent}
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
