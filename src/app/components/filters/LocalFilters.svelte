<script lang="ts">
  /**
   * LocalFilters component
   * Encapsulates all filter logic for local tasks (Obsidian extension)
   * Manages its own state, settings persistence, and recently-used items
   */

  import FilterButton from "../FilterButton.svelte";
  import { getFilterOptions } from "../../utils/contextFiltering";
  import type { TaskSyncSettings } from "../../types/settings";
  import type { Host } from "../../core/host";
  import type { Task } from "../../core/entities";
  import type { Extension } from "../../core/extension";

  interface LocalTaskFilters {
    project?: string | null;
    area?: string | null;
    source?: string | null;
    showCompleted?: boolean;
  }

  interface Props {
    // Current filter values (bindable for two-way sync)
    filters: $bindable<LocalTaskFilters>;
    
    // Settings object (passed as entire object)
    settings: TaskSyncSettings;
    
    // Host for persistence
    host: Host;
    
    // Extension to get available filter options
    extension: Extension;
  }

  let { filters = $bindable({}), settings, host, extension }: Props = $props();

  // ============================================================================
  // INTERNAL STATE - Managed by this component
  // ============================================================================
  
  let selectedProject = $state<string | null>(null);
  let selectedArea = $state<string | null>(null);
  let selectedSource = $state<string | null>(null);
  let showCompleted = $state(false);
  
  // Recently used items
  let recentlyUsedProjects = $state<string[]>([]);
  let recentlyUsedAreas = $state<string[]>([]);
  let recentlyUsedSources = $state<string[]>([]);
  
  // Available options (derived from all tasks)
  let allTasks = $state<Task[]>([]);
  
  // ============================================================================
  // LOAD SETTINGS ON MOUNT
  // ============================================================================
  
  $effect(() => {
    loadSettings();
  });
  
  // ============================================================================
  // SUBSCRIBE TO EXTENSION TASKS FOR FILTER OPTIONS
  // ============================================================================
  
  $effect(() => {
    const tasksStore = extension.getTasks();
    const unsubscribe = tasksStore.subscribe((tasks) => {
      allTasks = [...tasks];
    });
    return unsubscribe;
  });
  
  // ============================================================================
  // DERIVE FILTER OPTIONS FROM TASKS
  // ============================================================================
  
  let filterOptions = $derived.by(() => getFilterOptions(allTasks));
  let projectOptions = $derived(filterOptions.projects);
  let areaOptions = $derived(filterOptions.areas);
  let sourceOptions = $derived(filterOptions.sources);

  // ============================================================================
  // UPDATE FILTERS WHEN INTERNAL STATE CHANGES
  // ============================================================================
  
  $effect(() => {
    filters = {
      project: selectedProject,
      area: selectedArea,
      source: selectedSource,
      showCompleted,
    };
  });
  
  // ============================================================================
  // SAVE SETTINGS WHEN STATE CHANGES
  // ============================================================================
  
  $effect(() => {
    // Save when any filter or recently-used changes
    selectedProject;
    selectedArea;
    selectedSource;
    showCompleted;
    recentlyUsedProjects;
    recentlyUsedAreas;
    recentlyUsedSources;
    
    saveSettings();
  });

  // ============================================================================
  // SETTINGS PERSISTENCE
  // ============================================================================
  
  async function loadSettings(): Promise<void> {
    try {
      const data = await host.loadData();
      if (data?.localTasksFilters) {
        selectedProject = data.localTasksFilters.selectedProject ?? null;
        selectedArea = data.localTasksFilters.selectedArea ?? null;
        selectedSource = data.localTasksFilters.selectedSource ?? null;
        showCompleted = data.localTasksFilters.showCompleted ?? false;
        recentlyUsedProjects = data.localTasksFilters.recentlyUsedProjects ?? [];
        recentlyUsedAreas = data.localTasksFilters.recentlyUsedAreas ?? [];
        recentlyUsedSources = data.localTasksFilters.recentlyUsedSources ?? [];
      }
    } catch (err: any) {
      console.warn("Failed to load local tasks filter settings:", err.message);
    }
  }
  
  async function saveSettings(): Promise<void> {
    try {
      const data = (await host.loadData()) || {};
      data.localTasksFilters = {
        selectedProject,
        selectedArea,
        selectedSource,
        showCompleted,
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
</script>

<!-- Primary filters -->
<div class="primary-filters">
  <FilterButton
    label="Project"
    currentValue={selectedProject || "All projects"}
    allOptions={projectOptions}
    defaultOption="All projects"
    onselect={(value: string) => {
      const newProject = value === "All projects" || value === "" ? null : value;
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
      const newSource = value === "All sources" || value === "" ? null : value;
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

<!-- Secondary filters -->
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

