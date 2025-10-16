# Obsidian Task Sync - Architecture Documentation

## Overview

Obsidian Task Sync is a Svelte 5 application with Obsidian plugin support. The architecture follows modern patterns with clear separation of concerns, reactive state management, and extensibility.

## Core Architectural Patterns

### 1. Action Dispatcher Pattern (Redux-like)

All state mutations go through actions dispatched to reducers. This provides:
- Centralized state management
- Predictable state changes
- Easy debugging and testing
- Clear audit trail of state changes

**Example:**

```typescript
// Define actions
export type TaskAction =
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; id: string; updates: Partial<Task> }
  | { type: "REMOVE_TASK"; id: string };

// Pure reducer function
export function taskReducer(
  state: TaskStoreState,
  action: TaskAction
): TaskStoreState {
  switch (action.type) {
    case "ADD_TASK":
      return {
        ...state,
        tasks: [...state.tasks, action.task],
        lastSync: Date.now(),
      };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, ...action.updates } : t
        ),
        lastSync: Date.now(),
      };
    case "REMOVE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        lastSync: Date.now(),
      };
    default:
      return state;
  }
}

// Store with dispatch method
export interface TaskStore extends Readable<TaskStoreState> {
  dispatch: (action: TaskAction) => void;
}

// Usage in operations
class TaskOperations {
  async create(taskData: Partial<Task>): Promise<Task> {
    const task = buildTask(taskData);
    
    // Dispatch action to store
    taskStore.dispatch({ type: "ADD_TASK", task });
    
    // Trigger domain event
    eventBus.emit({ type: "TASK_CREATED", payload: task });
    
    return task;
  }
}
```

### 2. Query Service Pattern

Query logic is separated from stores into pure static functions. This provides:
- No store dependencies in query logic
- Easy testing
- Reusable across components
- Clear separation of reads and writes

**Example:**

```typescript
export class TaskQueryService {
  /**
   * Search tasks by query string
   */
  static search(
    tasks: readonly Task[],
    query: string
  ): readonly Task[] {
    const lowerQuery = query.toLowerCase();
    return tasks.filter((task) =>
      task.title.toLowerCase().includes(lowerQuery) ||
      task.category?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Filter tasks by criteria
   */
  static filter(
    tasks: readonly Task[],
    criteria: FilterCriteria
  ): readonly Task[] {
    return tasks.filter((task) => {
      if (criteria.project && task.project !== criteria.project) {
        return false;
      }
      if (!criteria.showCompleted && task.done) {
        return false;
      }
      return true;
    });
  }

  /**
   * Sort tasks by fields
   */
  static sort(
    tasks: readonly Task[],
    sortFields: SortField[]
  ): readonly Task[] {
    return [...tasks].sort((a, b) => {
      for (const field of sortFields) {
        const comparison = compareValues(a[field.key], b[field.key]);
        if (comparison !== 0) {
          return field.direction === "desc" ? -comparison : comparison;
        }
      }
      return 0;
    });
  }
}

// Usage in Svelte 5 components
let searchQuery = $state("");
let filters = $state({ showCompleted: false });
let sort = $state([{ key: "createdAt", direction: "desc" }]);

const filteredTasks = $derived.by(() => {
  const taskStoreState = $taskStore;
  let result = taskStoreState.tasks;
  
  // Apply search
  if (searchQuery) {
    result = TaskQueryService.search(result, searchQuery);
  }
  
  // Apply filters
  result = TaskQueryService.filter(result, filters);
  
  // Apply sort
  result = TaskQueryService.sort(result, sort);
  
  return result;
});
```

### 3. Extension System

Extensions provide pluggable functionality for different data sources (Obsidian, GitHub, etc.).

**Extension Interface:**

```typescript
export interface Extension {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedEntities: readonly EntityType[];

  // Lifecycle
  initialize(): Promise<void>;
  load(): Promise<void>;
  shutdown(): Promise<void>;

  // Data access
  getTasks(): Readable<readonly Task[]>;
  refresh(): Promise<void>;

  // Event handlers
  onEntityCreated(event: DomainEvent): Promise<void>;
  onEntityUpdated(event: DomainEvent): Promise<void>;
  onEntityDeleted(event: DomainEvent): Promise<void>;

  // Entity operations (optional)
  tasks?: EntityOperations<Task>;
  projects?: EntityOperations<Project>;
  areas?: EntityOperations<Area>;
}
```

**Extension Directory Structure:**

```
src/app/extensions/
├── obsidian/
│   ├── ObsidianExtension.ts       # Main extension class
│   ├── entities/                  # Obsidian-specific entity builders
│   ├── operations/                # Obsidian-specific operations
│   ├── processors/                # Markdown processors
│   ├── sources/                   # Data sources
│   └── utils/                     # Utilities
├── github/
│   ├── GitHubExtension.ts
│   ├── components/                # GitHub-specific UI
│   ├── entities/                  # GitHub entity builders
│   └── services/                  # GitHub API services
└── daily-planning/
    ├── DailyPlanningExtension.ts
    ├── components/                # Planning wizard UI
    └── services/                  # Planning services
```

### 4. Event-Driven Architecture

Domain events decouple operations from side effects:

```typescript
// Operations dispatch events
class TaskOperations {
  async create(taskData: Partial<Task>): Promise<Task> {
    const task = buildTask(taskData);
    taskStore.dispatch({ type: "ADD_TASK", task });
    
    // Emit domain event
    eventBus.emit({
      type: "TASK_CREATED",
      payload: task,
      timestamp: Date.now(),
    });
    
    return task;
  }
}

// Extensions react to events
class ObsidianExtension implements Extension {
  async onEntityCreated(event: DomainEvent): Promise<void> {
    if (event.type === "TASK_CREATED") {
      // Create note file for task
      await this.createNoteForTask(event.payload);
    }
  }
}
```

## Directory Structure

```
src/
├── app/
│   ├── core/                      # Core types and interfaces
│   │   ├── entities.ts            # Entity type definitions
│   │   ├── events.ts              # Event system
│   │   └── extension.ts           # Extension interfaces
│   ├── entities/                  # Entity namespaces
│   │   ├── Tasks.ts               # Tasks.Operations, Tasks.Queries
│   │   ├── Projects.ts            # Projects.Operations, Projects.Queries
│   │   └── Areas.ts               # Areas.Operations, Areas.Queries
│   ├── stores/                    # Global state stores
│   │   ├── taskStore.ts           # Task store with dispatch
│   │   ├── projectStore.ts        # Project store with dispatch
│   │   ├── areaStore.ts           # Area store with dispatch
│   │   ├── actions.ts             # Action type definitions
│   │   └── reducers/              # Pure reducer functions
│   ├── services/                  # Shared services
│   │   ├── TaskQueryService.ts    # Task query functions
│   │   ├── ProjectQueryService.ts # Project query functions
│   │   └── AreaQueryService.ts    # Area query functions
│   ├── extensions/                # Extension implementations
│   ├── components/                # Shared UI components
│   └── views/                     # Main views
└── main.ts                        # Obsidian plugin entry point
```

## Best Practices

### DO:
- ✅ Use action dispatcher for all state mutations
- ✅ Use query services for search/filter/sort
- ✅ Use $derived for reactive computations in Svelte 5
- ✅ Keep extensions focused on data sources
- ✅ Use domain events for cross-cutting concerns
- ✅ Trust contracts - fail fast on invalid data

### DON'T:
- ❌ Mutate store state directly
- ❌ Add query methods to stores
- ❌ Use derived() from svelte/store (use $derived instead)
- ❌ Put extension-specific code in shared directories
- ❌ Use defensive fallback chains (data.foo || data.bar || 'default')
- ❌ Wrap everything in try-catch (only at UI/API boundaries)

## Migration Guide

See `docs/store-refactoring-plan.md` for the complete migration plan from old to new architecture.

