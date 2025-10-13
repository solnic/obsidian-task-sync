# Unified Extension Interface Design

## Overview

This document describes the new unified interface for extensions that eliminates data processing logic from Svelte components.

## Core Principle

**Extensions handle ALL data processing. Components only manage UI state and render.**

## New Extension Interface

```typescript
export interface ExtensionDataAccess {
  /**
   * Get tasks with filtering, sorting, and searching applied
   * Returns a reactive store that automatically updates when:
   * - Underlying data changes (tasks added/updated/deleted)
   * - Options change (filters, sort, search)
   * 
   * @param options - Abstract filter/sort/search options
   * @returns Readable store of processed tasks
   */
  getTasks(options?: TaskQueryOptions): Readable<readonly Task[]>;
  
  /**
   * Refresh the extension's data
   */
  refresh(): Promise<void>;
}

export interface TaskQueryOptions {
  // Generic filters (extension-agnostic)
  filters?: Record<string, any>;
  
  // Generic sort configuration
  sort?: Array<{
    key: string;
    direction: "asc" | "desc";
  }>;
  
  // Generic search query
  search?: string;
}
```

## Extension-Specific Filter Schemas

Each extension defines its own filter schema:

### ObsidianExtension Filters
```typescript
interface ObsidianTaskFilters {
  project?: string | null;
  area?: string | null;
  source?: string | null;
  showCompleted?: boolean;
}
```

### GitHubExtension Filters
```typescript
interface GitHubTaskFilters {
  repository?: string | null;
  organization?: string | null;
  state?: "open" | "closed" | "all";
  assignedToMe?: boolean;
  labels?: string[];
  type?: "issues" | "pull-requests";
}
```

## Implementation Strategy

### 1. Extensions

Extensions implement `getTasks(options)` which:
1. Parses options.filters into extension-specific filter object
2. Creates a derived store that:
   - Subscribes to underlying data store
   - Applies filters
   - Applies search
   - Applies sorting
   - Returns processed tasks
3. Returns the derived store

Example:
```typescript
class ObsidianExtension implements Extension {
  getTasks(options?: TaskQueryOptions): Readable<readonly Task[]> {
    return derived(taskStore, ($store) => {
      let tasks = $store.tasks;
      
      // Apply filters
      if (options?.filters) {
        tasks = this.applyFilters(tasks, options.filters);
      }
      
      // Apply search
      if (options?.search) {
        tasks = this.applySearch(tasks, options.search);
      }
      
      // Apply sort
      if (options?.sort) {
        tasks = this.applySort(tasks, options.sort);
      }
      
      return tasks;
    });
  }
  
  private applyFilters(tasks: readonly Task[], filters: any): readonly Task[] {
    // Extension-specific filter logic
  }
  
  private applySearch(tasks: readonly Task[], query: string): readonly Task[] {
    // Extension-specific search logic
  }
  
  private applySort(tasks: readonly Task[], sort: any[]): readonly Task[] {
    // Extension-specific sort logic
  }
}
```

### 2. Svelte Components

Components become much simpler:

```svelte
<script lang="ts">
  import type { Extension } from "../core/extension";
  
  interface Props {
    extension: Extension;
    // ... other props
  }
  
  let { extension }: Props = $props();
  
  // UI state only
  let filters = $state({});
  let sort = $state([]);
  let search = $state("");
  
  // Reactive query options
  let queryOptions = $derived({
    filters,
    sort,
    search
  });
  
  // Subscribe to processed tasks from extension
  let tasks = $state<Task[]>([]);
  $effect(() => {
    const tasksStore = extension.getTasks(queryOptions);
    const unsubscribe = tasksStore.subscribe((processedTasks) => {
      tasks = [...processedTasks];
    });
    return unsubscribe;
  });
</script>

<!-- Render tasks -->
{#each tasks as task}
  <TaskItem {task} />
{/each}
```

### 3. Filter Components

Filter components manage their own state and emit changes:

```svelte
<!-- LocalFilters.svelte -->
<script lang="ts">
  interface Props {
    filters: $bindable<any>;
    settings: any; // Entire settings object
  }
  
  let { filters = $bindable(), settings }: Props = $props();
  
  // Internal state
  let selectedProject = $state(null);
  let selectedArea = $state(null);
  let recentlyUsedProjects = $state([]);
  
  // Update filters when internal state changes
  $effect(() => {
    filters = {
      project: selectedProject,
      area: selectedArea,
      // ... other filters
    };
  });
  
  // Load/save recently used from settings
  // ...
</script>

<FilterButton 
  label="Project"
  bind:value={selectedProject}
  options={projectOptions}
/>
```

## Benefits

1. **Separation of Concerns**: UI state vs data processing
2. **Reactivity**: Extensions return reactive stores, components auto-update
3. **Extensibility**: Easy to add new extensions with different filter schemas
4. **Testability**: Extension logic can be tested independently
5. **Performance**: Derived stores are memoized, only recompute when needed
6. **Type Safety**: Each extension defines its own filter types

## Migration Path

1. Update Extension interface to add `getTasks(options)` overload
2. Implement new method in ObsidianExtension
3. Implement new method in GitHubExtension
4. Create ServiceView component that uses new interface
5. Create extension-specific filter components
6. Update Service.svelte to use ServiceView
7. Remove old service classes
8. Deprecate old methods (filterTasks, sortTasks, searchTasks)

