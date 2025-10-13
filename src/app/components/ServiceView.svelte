<script lang="ts">
  /**
   * Unified ServiceView component
   * Replaces both LocalTasksService and GitHubService
   * 
   * This component manages only 3 reactive state elements:
   * - tasks: current list of tasks (from extension)
   * - filters: currently applied filters (UI state)
   * - sort: currently applied sorting logic (UI state)
   * 
   * ALL data processing is delegated to the extension.
   */

  import type { Snippet } from "svelte";
  import type { Extension } from "../core/extension";
  import type { Host } from "../core/host";
  import type { Task } from "../core/entities";
  import type { TaskSyncSettings } from "../types/settings";
  import type { DailyPlanningExtension } from "../extensions/DailyPlanningExtension";
  import SearchInput from "./SearchInput.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import { derived, type Readable } from "svelte/store";

  interface SortField {
    key: string;
    label: string;
    direction: "asc" | "desc";
  }

  interface Props {
    // Extension that provides data
    extension: Extension;
    
    // Host for data persistence
    host: Host;
    
    // Settings (passed as entire object to filter components)
    settings: TaskSyncSettings;
    
    // Daily planning extension
    dailyPlanningExtension?: DailyPlanningExtension;
    
    // Unified staging state
    stagedTaskIds?: Set<string>;
    onStageTask?: (task: any) => void;
    
    // Planning mode flags
    isPlanningActive?: boolean;
    currentSchedule?: any;
    
    // Extension-specific filter component (passed as snippet)
    filters: Snippet<[{
      filters: any;
      onFiltersChange: (filters: any) => void;
      settings: TaskSyncSettings;
      host: Host;
    }]>;
    
    // Task item renderer (extension-specific)
    taskItem: Snippet<[{
      task: Task;
      isHovered: boolean;
      onHover: (hovered: boolean) => void;
      settings: TaskSyncSettings;
      host: Host;
      dailyPlanningExtension?: DailyPlanningExtension;
      isPlanningActive?: boolean;
      stagedTaskIds?: Set<string>;
      onStageTask?: (task: any) => void;
    }]>;
    
    // Available sort fields (extension-specific)
    availableSortFields: Array<{ key: string; label: string }>;
    
    // Default sort fields
    defaultSortFields?: SortField[];
    
    // Test ID
    testId?: string;
  }

  let {
    extension,
    host,
    settings,
    dailyPlanningExtension,
    stagedTaskIds = new Set(),
    onStageTask,
    isPlanningActive = false,
    currentSchedule,
    filters,
    taskItem,
    availableSortFields,
    defaultSortFields = [
      { key: "updatedAt", label: "Updated", direction: "desc" },
      { key: "title", label: "Title", direction: "asc" },
    ],
    testId,
  }: Props = $props();

  // ============================================================================
  // REACTIVE STATE - Only 3 elements as required
  // ============================================================================
  
  // 1. Tasks - current list from extension (processed)
  let tasks = $state<Task[]>([]);
  
  // 2. Filters - currently applied filters (UI state, extension-specific)
  let currentFilters = $state<any>({});
  
  // 3. Sort - currently applied sorting logic (UI state)
  let sortFields = $state<SortField[]>(defaultSortFields);
  
  // Search query (part of filtering, but kept separate for UI)
  let searchQuery = $state("");
  
  // UI state
  let hoveredTask = $state<string | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // ============================================================================
  // DATA PROCESSING - Delegated to extension via derived store
  // ============================================================================
  
  /**
   * Create a derived store that processes tasks using extension methods
   * This is the ONLY place where we process tasks - all logic is in the extension
   */
  let processedTasksStore = $derived.by((): Readable<readonly Task[]> => {
    const baseTasks = extension.getTasks();
    
    return derived(baseTasks, ($tasks) => {
      let processed: readonly Task[] = $tasks;
      
      // Apply filters using extension
      if (Object.keys(currentFilters).length > 0) {
        processed = extension.filterTasks(processed, currentFilters);
      }
      
      // Apply search using extension
      if (searchQuery) {
        processed = extension.searchTasks(searchQuery, processed);
      }
      
      // Apply sort using extension
      if (sortFields.length > 0) {
        processed = extension.sortTasks(processed, sortFields);
      }
      
      return processed;
    });
  });
  
  /**
   * Subscribe to processed tasks and update local state
   * This is the ONLY effect - just subscribing to the derived store
   */
  $effect(() => {
    const unsubscribe = processedTasksStore.subscribe((processedTasks) => {
      tasks = [...processedTasks];
    });
    
    return unsubscribe;
  });

  // ============================================================================
  // EVENT HANDLERS - Simple pass-through, no logic
  // ============================================================================
  
  function handleFiltersChange(newFilters: any): void {
    currentFilters = newFilters;
  }
  
  function handleSortChange(newSortFields: SortField[]): void {
    sortFields = newSortFields;
  }
  
  async function handleRefresh(): Promise<void> {
    try {
      isLoading = true;
      error = null;
      await extension.refresh();
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="task-sync-service-container" data-testid={testId}>
  <!-- Header Section -->
  <header>
    <!-- Search with refresh -->
    <SearchInput
      bind:value={searchQuery}
      placeholder="Search tasks..."
      onInput={(value) => (searchQuery = value)}
      service={extension.id}
      onRefresh={handleRefresh}
    />

    <!-- Extension-specific filters (passed as snippet) -->
    {@render filters({
      filters: currentFilters,
      onFiltersChange: handleFiltersChange,
      settings,
      host,
    })}

    <!-- Sort controls -->
    <SortDropdown
      {sortFields}
      availableFields={availableSortFields}
      onSortChange={handleSortChange}
    />
  </header>

  <!-- Content Section -->
  <div class="task-sync-task-list-container">
    {#if error}
      <div class="task-sync-error-message">
        {error}
      </div>
    {:else if isLoading}
      <div class="task-sync-loading-indicator">Loading tasks...</div>
    {:else}
      <div class="task-sync-task-list">
        {#if tasks.length === 0}
          <div class="task-sync-empty-message">
            {searchQuery ? "No tasks match your search." : "No tasks found."}
          </div>
        {:else}
          {#each tasks as task (task.id)}
            {@render taskItem({
              task,
              isHovered: hoveredTask === task.id,
              onHover: (hovered) => (hoveredTask = hovered ? task.id : null),
              settings,
              host,
              dailyPlanningExtension,
              isPlanningActive,
              stagedTaskIds,
              onStageTask,
            })}
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

