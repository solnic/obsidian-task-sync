<script lang="ts">
  /**
   * LocalTasksService component for the new architecture
   * Provides task listing, filtering, sorting, and search functionality
   */

  import { onMount, onDestroy } from "svelte";
  import { taskStore } from "../stores/taskStore";
  import SearchInput from "./SearchInput.svelte";
  import FilterButton from "./FilterButton.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import TaskItem from "./TaskItem.svelte";
  import { getFilterOptions } from "../utils/contextFiltering";
  import { extractDisplayValue } from "../utils/linkUtils";
  import type { Task } from "../core/entities";
  import type { TaskSyncSettings } from "../types/settings";
  import { createLocalTask, type LocalTask } from "../types/LocalTask";

  interface SortField {
    key: string;
    label: string;
    direction: "asc" | "desc";
  }

  interface Props {
    // Settings for badge colors and configuration
    settings?: TaskSyncSettings;

    // Host for data persistence
    host?: any; // Host interface for saving/loading data

    // Test attributes
    testId?: string;
  }

  let { settings, host, testId }: Props = $props();

  // State
  let tasks = $state<any[]>([]); // Use any[] to avoid readonly issues
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let hoveredTask = $state<string | null>(null);

  // Additional filter state
  let selectedProject = $state<string | null>(null);
  let selectedArea = $state<string | null>(null);
  let selectedSource = $state<string | null>(null);
  let showCompleted = $state(false);

  // Recently used filters
  let recentlyUsedProjects = $state<string[]>([]);
  let recentlyUsedAreas = $state<string[]>([]);
  let recentlyUsedSources = $state<string[]>([]);

  // Sorting state
  let sortFields = $state<SortField[]>([
    { key: "updatedAt", label: "Updated", direction: "desc" },
    { key: "title", label: "Title", direction: "asc" },
  ]);

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
    return tasks.map(createLocalTask);
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
        const taskSource = task.source?.source;
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

  onMount(() => {
    // Load recently used filters
    loadRecentlyUsedFilters();

    // Subscribe to task store updates immediately
    const unsubscribe = taskStore.subscribe((state) => {
      tasks = [...state.tasks]; // Create mutable copy
      isLoading = state.loading;
      error = state.error;
    });

    return unsubscribe;
  });

  onDestroy(() => {
    // Save current filter state when component is destroyed
    saveRecentlyUsedFilters();
  });

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
              (area) =>
                typeof area === "string" &&
                area.toLowerCase().includes(lowerQuery)
            )) ||
            (typeof (task.areas as any) === "string" &&
              (task.areas as any).toLowerCase().includes(lowerQuery))))
      );
    });
  }

  function sortLocalTasks(
    localTaskList: LocalTask[],
    sortFields: SortField[]
  ): LocalTask[] {
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
            // Priority order: High > Medium > Low > null
            const priorityOrder = { High: 3, Medium: 2, Low: 1 };
            aValue =
              (a.sortable.priority &&
                priorityOrder[
                  a.sortable.priority as keyof typeof priorityOrder
                ]) ||
              0;
            bValue =
              (b.sortable.priority &&
                priorityOrder[
                  b.sortable.priority as keyof typeof priorityOrder
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
    try {
      taskStore.setLoading(true);
      taskStore.setError(null);

      // In the new architecture, tasks are loaded through extensions
      // For now, we'll implement a basic refresh that clears and reloads
      // TODO: Implement proper extension-based refresh when extension registry is available

      // Clear current tasks and reload
      // This is a placeholder implementation until we have proper extension integration
      console.log("Refreshing local tasks...");

      // Simulate refresh completion
      taskStore.setLoading(false);
    } catch (err: any) {
      console.error("Failed to refresh tasks:", err);
      taskStore.setError(err.message);
      taskStore.setLoading(false);
    }
  }

  // Task actions
  async function openTask(task: any): Promise<void> {
    // Open the task file in Obsidian
    if (host) {
      try {
        // Get the file path for the task
        const fileName = `${task.title}.md`;
        const filePath = `Tasks/${fileName}`;

        // Use Obsidian's workspace to open the file
        const app = (window as any).app;
        if (app && app.workspace) {
          const file = app.vault.getAbstractFileByPath(filePath);
          if (file) {
            await app.workspace.getLeaf().openFile(file);
          } else {
            console.warn("Task file not found:", filePath);
          }
        }
      } catch (error) {
        console.error("Failed to open task:", error);
      }
    }
  }

  // Recently used filters management
  async function loadRecentlyUsedFilters(): Promise<void> {
    try {
      if (!host) return;

      const data = await host.loadData();
      if (data?.localTasksRecentlyUsed) {
        recentlyUsedProjects = data.localTasksRecentlyUsed.projects || [];
        recentlyUsedAreas = data.localTasksRecentlyUsed.areas || [];
        recentlyUsedSources = data.localTasksRecentlyUsed.sources || [];
      }

      // Also restore current filter selections
      if (data?.localTasksCurrentFilters) {
        if (data.localTasksCurrentFilters.project !== undefined) {
          selectedProject = data.localTasksCurrentFilters.project;
        }
        if (data.localTasksCurrentFilters.area !== undefined) {
          selectedArea = data.localTasksCurrentFilters.area;
        }
        if (data.localTasksCurrentFilters.source !== undefined) {
          selectedSource = data.localTasksCurrentFilters.source;
        }
        if (data.localTasksCurrentFilters.showCompleted !== undefined) {
          showCompleted = data.localTasksCurrentFilters.showCompleted;
        }
        if (data.localTasksCurrentFilters.sortFields !== undefined) {
          sortFields = data.localTasksCurrentFilters.sortFields;
        }
      }
    } catch (err: any) {
      console.warn("Failed to load recently used filters:", err.message);
    }
  }

  async function saveRecentlyUsedFilters(): Promise<void> {
    try {
      if (!host) return;

      const data = (await host.loadData()) || {};
      data.localTasksRecentlyUsed = {
        projects: recentlyUsedProjects,
        areas: recentlyUsedAreas,
        sources: recentlyUsedSources,
      };
      // Also save current filter selections and sort state
      data.localTasksCurrentFilters = {
        project: selectedProject,
        area: selectedArea,
        source: selectedSource,
        showCompleted: showCompleted,
        sortFields: sortFields,
      };
      await host.saveData(data);
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

  function handleSortChange(newSortFields: SortField[]): void {
    sortFields = newSortFields;
    saveRecentlyUsedFilters();
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
            saveRecentlyUsedFilters();
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
            saveRecentlyUsedFilters();
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
            saveRecentlyUsedFilters();
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
          onclick={() => {
            showCompleted = !showCompleted;
            saveRecentlyUsedFilters();
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
            <TaskItem
              title={localTask.task.title}
              subtitle={localTask.task.category}
              badges={[
                ...(localTask.task.status
                  ? [{ text: localTask.task.status, type: "status" as const }]
                  : []),
                ...(localTask.task.priority
                  ? [
                      {
                        text: localTask.task.priority,
                        type: "priority" as const,
                      },
                    ]
                  : []),
                ...(localTask.task.category
                  ? [
                      {
                        text: localTask.task.category,
                        type: "category" as const,
                      },
                    ]
                  : []),
              ]}
              footerBadges={[
                ...(localTask.task.project
                  ? [
                      {
                        type: "Project",
                        text:
                          extractDisplayValue(localTask.task.project) ||
                          localTask.task.project,
                      },
                    ]
                  : []),
                ...(localTask.task.areas && localTask.task.areas.length > 0
                  ? [
                      {
                        type: "Area",
                        text:
                          extractDisplayValue(localTask.task.areas[0]) ||
                          localTask.task.areas[0],
                      },
                    ]
                  : []),
                ...(localTask.task.source
                  ? [{ type: "Source", text: localTask.task.source.source }]
                  : []),
              ]}
              createdAt={localTask.task.createdAt}
              updatedAt={localTask.task.updatedAt}
              isHovered={hoveredTask === localTask.task.id}
              onHover={(hovered: boolean) =>
                (hoveredTask = hovered ? localTask.task.id : null)}
              {settings}
              actionContent={true}
              testId="local-task-item-{localTask.task.title
                .replace(/\s+/g, '-')
                .toLowerCase()}"
            >
              {#snippet actions()}
                <button
                  class="open-task-button"
                  title="Open task"
                  onclick={() => openTask(localTask.task)}
                  data-testid="open-task-button"
                >
                  Open
                </button>
              {/snippet}
            </TaskItem>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
