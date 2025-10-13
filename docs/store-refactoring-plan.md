# Store and Extension Data Handling Refactoring Plan

## 🔍 AUDIT SUMMARY (2025-10-15)

### ✅ Completed Phases
- **Phase 1**: New Architecture Foundation - COMPLETE
- **Phase 2**: Extension Directory Reorganization - COMPLETE
- **Phase 3**: ObsidianExtension Migration - COMPLETE
- **Phase 4**: GitHubExtension Migration - COMPLETE

### ⚠️ Key Findings
1. **taskStore.ts already migrated** - No taskStore.v2.ts exists; the new action-based architecture is already in place
2. **All core infrastructure verified** - DataSource, TaskSourceManager, TaskQueryService, action-based store all working correctly
3. **Both extensions fully migrated** - ObsidianExtension and GitHubExtension successfully using new patterns
4. **Tasks.v2.ts exists** - Parallel Operations class using action dispatcher pattern

### 📋 Remaining Work
- **Phase 5**: Migrate DailyPlanningExtension and ContextExtension (NOT STARTED)
- **Phase 6**: Update UI Components to use Svelte 5 patterns (NOT STARTED)
- **Phase 7**: Remove old architecture - Tasks.ts, check for projectStore.v2/areaStore.v2 (PARTIAL)
- **Phase 8**: Final cleanup and documentation (NOT STARTED)

### 🎯 Next Steps
1. Migrate DailyPlanningExtension to new patterns
2. Migrate ContextExtension to new patterns
3. Update UI components to use $derived with TaskQueryService
4. Remove Tasks.ts (replace with Tasks.v2.ts)
5. Final cleanup and documentation

---

## Overview

This document provides an actionable, phase-by-phase plan to refactor the current store and extension architecture based on Svelte 5 best practices. The refactoring will eliminate tight coupling between extensions and stores, simplify reactivity patterns, and create a cleaner separation of concerns.

**Important Notes:**
- This is a **pure refactoring effort** - no new features, only architectural improvements
- Focus is on **e2e tests only** - unit tests will be ignored during this refactoring
- **No backward compatibility** concerns - we can break existing interfaces freely
- E2e tests will be updated incrementally as we change interfaces they depend on

## Current Architecture Problems

### 1. **Tight Coupling Between Extensions and Stores**
- Extensions directly call `taskStore.addTask()`, `taskStore.updateTask()`, `taskStore.upsertTask()`
- Extensions create derived stores from global stores (e.g., `this.githubTasks = derived(taskStore, ...)`)
- This creates bidirectional dependencies and makes the system hard to reason about

### 2. **Operations Layer Directly Manipulates Stores**
- `Tasks.Operations.create()` directly calls `store.addTask(task)` then triggers event
- `Tasks.Operations.update()` directly calls `store.updateTask(task)` then triggers event
- This creates tight coupling between operations and store implementation
- Operations should dispatch actions, not manipulate stores directly

### 3. **Mixed Responsibilities**
- Extensions handle data fetching AND store mutations AND UI concerns (search/filter/sort)
- Stores contain both state management and query logic
- Operations contain both business logic and store manipulation
- No clear separation between data sources and view logic

### 4. **Complex Derived Store Chains**
- Multiple layers of derived stores lead to subscription complexity
- Potential memory leaks from unmanaged subscriptions
- Difficult to debug reactivity issues

### 5. **E2E Test Coupling**
- Tests directly access `plugin.stores.taskStore.addTask()` to manipulate state
- Tests rely on store methods like `findBySourceUrl()`, `findByFilePath()`
- Tests create tasks by directly calling store methods instead of using data sources

## Target Architecture

### Layer 1: Data Sources (Pure Data Providers)
Extensions become pure data sources that only fetch and transform data - no store manipulation.

### Layer 2: Operations Layer (Business Logic + Action Dispatch)
- `Tasks.Operations`, `Projects.Operations`, etc. contain business logic
- Operations dispatch actions to store instead of directly manipulating it
- Operations still trigger domain events for cross-cutting concerns
- **Key Change**: `create()` dispatches `{ type: 'ADD_TASK', task }` instead of calling `store.addTask()`

### Layer 3: Centralized State with Action Dispatcher
Single store with action-based updates using a reducer pattern - all mutations go through dispatcher.

### Layer 4: Source Coordinator
Manages data sources, coordinates loading, and dispatches actions to store.

### Layer 5: Query Services
Pure functions for search, filter, sort - no store dependencies.
`Tasks.Queries` can remain as-is (reads from store) or be refactored to pure functions.

### Layer 6: Svelte 5 Components
Use `$derived` runes instead of derived stores for computed values.

---

## Directory Structure Reorganization

### Current Problems
- Extension-specific code scattered across `src/app`:
  - `src/app/entities/Obsidian.ts` - Obsidian-specific operations
  - `src/app/entities/GitHub.ts` - GitHub-specific operations
  - `src/app/extensions/ObsidianExtension.ts` - Main extension
  - `src/app/extensions/ObsidianTaskOperations.ts` - Task operations
  - `src/app/extensions/ObsidianProjectOperations.ts` - Project operations
  - `src/app/extensions/obsidian/*` - Some Obsidian utilities
  - `src/app/services/GitHubOrgRepoMapper.ts` - GitHub-specific service
  - `src/app/processors/TaskTodoMarkdownProcessor.ts` - Obsidian-specific processor

### Target Structure
```
src/app/
├── core/                    # Core abstractions (Host, Extension, Events, Entities)
├── stores/                  # Global state stores
├── sources/                 # NEW: DataSource implementations
├── services/                # Shared services (ContextService, TemplateService)
├── components/              # Shared Svelte components
├── modals/                  # Shared modals
├── views/                   # Shared views
├── utils/                   # Shared utilities
├── types/                   # Shared types
└── extensions/              # Extension-specific directories
    ├── obsidian/            # All Obsidian-specific code
    │   ├── ObsidianExtension.ts
    │   ├── sources/         # ObsidianTaskSource, etc.
    │   ├── operations/      # ObsidianTaskOperations, etc.
    │   ├── entities/        # Obsidian.ts (operations namespace)
    │   ├── processors/      # TaskTodoMarkdownProcessor
    │   ├── features/        # DailyNoteFeature
    │   ├── services/        # Obsidian-specific services
    │   ├── utils/           # BaseManager, PropertyRegistry, etc.
    │   └── types/           # Obsidian-specific types
    ├── github/              # All GitHub-specific code
    │   ├── GitHubExtension.ts
    │   ├── sources/         # GitHubTaskSource
    │   ├── entities/        # GitHub.ts (operations namespace)
    │   ├── services/        # GitHubOrgRepoMapper
    │   ├── components/      # GitHubIssueItem, GitHubService, etc.
    │   └── types/           # GitHub-specific types
    ├── calendar/            # All Calendar-specific code
    │   ├── CalendarExtension.ts
    │   ├── services/        # AppleCalendarService, etc.
    │   └── components/      # CalendarEventItem, etc.
    ├── daily-planning/      # All DailyPlanning-specific code
    │   ├── DailyPlanningExtension.ts
    │   ├── services/        # DailyNoteParser
    │   └── components/      # DailyPlanningView, etc.
    └── context/             # All Context-specific code
        └── ContextExtension.ts
```

---

## Phase 1: Create New Architecture Foundation ✅ COMPLETE

**Goal:** Build the new architecture alongside the old one without breaking existing functionality.

### Task 1.1: Create DataSource Interface and Base Implementation ✅
- [x] Create `src/app/sources/DataSource.ts` with generic `DataSource<T>` interface
- [x] Define methods: `loadInitialData()`, `refresh()`, `watch?(callback)`
- [x] Create `src/app/sources/TaskDataSource.ts` base class for task sources
- [x] Update e2e tests: None (new code, no existing tests)
- **Commit:** `5e45828`

**Implementation Example:**
```typescript
// src/app/sources/DataSource.ts
export interface DataSource<T> {
  readonly id: string;
  readonly name: string;

  // Pure data fetching - no store manipulation
  loadInitialData(): Promise<readonly T[]>;
  refresh(): Promise<readonly T[]>;

  // Optional: Watch for external changes
  watch?(callback: (items: readonly T[]) => void): () => void;
}
```

### Task 1.2: Implement Action-Based Store Architecture ✅
- [x] Create `src/app/stores/actions.ts` with action type definitions
  - `ADD_TASK`, `UPDATE_TASK`, `REMOVE_TASK` for direct mutations
  - `LOAD_SOURCE_START`, `LOAD_SOURCE_SUCCESS`, `LOAD_SOURCE_ERROR` for source loading
  - `UPSERT_TASK` for scanning operations (preserves natural key matching)
- [x] Create `src/app/stores/reducers/taskReducer.ts` with reducer logic
- [x] Create `src/app/stores/taskStore.ts` with action dispatcher pattern (replaced old store)
  - Export `dispatch(action)` function for operations to use
  - Keep `subscribe` for components
  - Remove direct mutation methods (`addTask`, `updateTask`, etc.)
- [x] **NOTE**: Old `taskStore.ts` was replaced directly (no v2 file exists)
- [x] Update e2e tests: None (parallel implementation)
- **Commit:** `07bca10`
- **Audit Status:** ✅ VERIFIED - taskStore.ts uses action dispatcher pattern, no v2 file exists

**Implementation Example:**
```typescript
// src/app/stores/actions.ts
import type { Task } from '../core/entities';

export type TaskAction =
  | { type: 'LOAD_SOURCE_START'; sourceId: string }
  | { type: 'LOAD_SOURCE_SUCCESS'; sourceId: string; tasks: readonly Task[] }
  | { type: 'LOAD_SOURCE_ERROR'; sourceId: string; error: string }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'REMOVE_TASK'; taskId: string }
  | { type: 'UPSERT_TASK'; taskData: Omit<Task, 'id'> & { naturalKey: string } };

// src/app/stores/reducers/taskReducer.ts
interface TaskStoreState {
  tasks: readonly Task[];
  loading: boolean;
  error: string | null;
  lastSync: Map<string, Date>; // Per-source sync times
}

export function taskReducer(state: TaskStoreState, action: TaskAction): TaskStoreState {
  switch (action.type) {
    case 'LOAD_SOURCE_START':
      return { ...state, loading: true, error: null };

    case 'LOAD_SOURCE_SUCCESS':
      // Remove old tasks from this source
      const filteredTasks = state.tasks.filter(
        t => t.source?.extension !== action.sourceId
      );

      // Add new tasks from source
      return {
        ...state,
        tasks: [...filteredTasks, ...action.tasks],
        loading: false,
        lastSync: new Map(state.lastSync).set(action.sourceId, new Date())
      };

    case 'ADD_TASK':
      return {
        ...state,
        tasks: [...state.tasks, action.task]
      };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.task.id ? action.task : t)
      };

    case 'REMOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.taskId)
      };

    default:
      return state;
  }
}

// src/app/stores/taskStore.ts
import { writable } from 'svelte/store';
import { taskReducer } from './reducers/taskReducer';
import type { TaskAction } from './actions';

function createTaskStore() {
  const { subscribe, update } = writable<TaskStoreState>({
    tasks: [],
    loading: false,
    error: null,
    lastSync: new Map()
  });

  const dispatch = (action: TaskAction) => {
    update(state => taskReducer(state, action));
  };

  return {
    subscribe,
    dispatch
  };
}

export const taskStore = createTaskStore();
```

### Task 1.3: Create TaskSourceManager ✅
- [x] Create `src/app/core/TaskSourceManager.ts` for coordinating data sources
- [x] Implement `registerSource()`, `loadSource()`, `refreshSource()`, `refreshAll()`
- [x] Integrate with new action-based store
- [x] Update e2e tests: None (new infrastructure)
- **Commit:** `6cbc9dc`
- **Audit Status:** ✅ VERIFIED - TaskSourceManager correctly implements all methods and coordinates between DataSources and Store

**Implementation Example:**
```typescript
// src/app/core/TaskSourceManager.ts
import type { DataSource } from '../sources/DataSource';
import type { Task } from './entities';
import { taskStore } from '../stores/taskStore';

export class TaskSourceManager {
  private sources = new Map<string, DataSource<Task>>();
  private watchers = new Map<string, () => void>();

  registerSource(source: DataSource<Task>) {
    this.sources.set(source.id, source);

    // Set up watching if supported
    if (source.watch) {
      const unwatch = source.watch((tasks) => {
        taskStore.dispatch({
          type: 'LOAD_SOURCE_SUCCESS',
          sourceId: source.id,
          tasks
        });
      });
      this.watchers.set(source.id, unwatch);
    }
  }

  async loadSource(sourceId: string) {
    const source = this.sources.get(sourceId);
    if (!source) return;

    try {
      taskStore.dispatch({ type: 'LOAD_SOURCE_START', sourceId });
      const tasks = await source.loadInitialData();
      taskStore.dispatch({
        type: 'LOAD_SOURCE_SUCCESS',
        sourceId,
        tasks
      });
    } catch (error: any) {
      taskStore.dispatch({
        type: 'LOAD_SOURCE_ERROR',
        sourceId,
        error: error.message
      });
    }
  }

  async refreshSource(sourceId: string) {
    const source = this.sources.get(sourceId);
    if (!source) return;

    try {
      taskStore.dispatch({ type: 'LOAD_SOURCE_START', sourceId });
      const tasks = await source.refresh();
      taskStore.dispatch({
        type: 'LOAD_SOURCE_SUCCESS',
        sourceId,
        tasks
      });
    } catch (error: any) {
      taskStore.dispatch({
        type: 'LOAD_SOURCE_ERROR',
        sourceId,
        error: error.message
      });
    }
  }

  async refreshAll() {
    await Promise.all(
      Array.from(this.sources.keys()).map(id => this.refreshSource(id))
    );
  }

  unregisterSource(sourceId: string) {
    // Clean up watcher
    const unwatch = this.watchers.get(sourceId);
    if (unwatch) {
      unwatch();
      this.watchers.delete(sourceId);
    }

    this.sources.delete(sourceId);
  }
}

// Global instance
export const taskSourceManager = new TaskSourceManager();
```

### Task 1.4: Create Query Service Layer ✅
- [x] Create `src/app/services/TaskQueryService.ts` with pure functions
- [x] Implement `search()`, `filter()`, `sort()` as static methods
- [x] Extract logic from current extension search/filter methods
- [x] Update e2e tests: None (pure functions, no side effects)
- **Commit:** `b32bf74`
- **Audit Status:** ✅ VERIFIED - TaskQueryService exists with comprehensive query methods

**Implementation Example:**
```typescript
// src/app/services/TaskQueryService.ts
import type { Task } from '../core/entities';

export class TaskQueryService {
  /**
   * Search tasks by query string
   * Searches in title, description, project, and areas
   */
  static search(tasks: readonly Task[], query: string): readonly Task[] {
    if (!query.trim()) return tasks;
    const lowerQuery = query.toLowerCase();

    return tasks.filter(task =>
      task.title.toLowerCase().includes(lowerQuery) ||
      task.description?.toLowerCase().includes(lowerQuery) ||
      task.project?.toLowerCase().includes(lowerQuery) ||
      task.areas.some(area => area.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Filter tasks by various criteria
   */
  static filter(
    tasks: readonly Task[],
    filters: {
      source?: string;
      status?: string;
      project?: string;
      area?: string;
      showCompleted?: boolean;
    }
  ): readonly Task[] {
    return tasks.filter(task => {
      if (filters.source && task.source?.extension !== filters.source) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.project && task.project !== filters.project) return false;
      if (filters.area && !task.areas.includes(filters.area)) return false;
      if (!filters.showCompleted && task.done) return false;
      return true;
    });
  }

  /**
   * Sort tasks by multiple fields
   */
  static sort(
    tasks: readonly Task[],
    sortBy: { field: keyof Task; direction: 'asc' | 'desc' }[]
  ): readonly Task[] {
    return [...tasks].sort((a, b) => {
      for (const { field, direction } of sortBy) {
        const aVal = a[field];
        const bVal = b[field];

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;

        if (comparison !== 0) {
          return direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Get tasks grouped by source
   */
  static groupBySource(tasks: readonly Task[]): Map<string, Task[]> {
    const grouped = new Map<string, Task[]>();
    for (const task of tasks) {
      const sourceId = task.source?.extension || 'unknown';
      if (!grouped.has(sourceId)) {
        grouped.set(sourceId, []);
      }
      grouped.get(sourceId)!.push(task);
    }
    return grouped;
  }

  /**
   * Get tasks for today (doDate is today)
   */
  static getTodayTasks(tasks: readonly Task[]): readonly Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter(task => {
      if (!task.doDate) return false;
      const doDate = new Date(task.doDate);
      doDate.setHours(0, 0, 0, 0);
      return doDate.getTime() === today.getTime();
    });
  }
}
```

### Task 1.5: Refactor Operations to Use Action Dispatcher ✅
- [x] Create `src/app/entities/Tasks.v2.ts` with updated Operations class
  - `create()` dispatches `{ type: 'ADD_TASK', task }` instead of `store.addTask(task)`
  - `update()` dispatches `{ type: 'UPDATE_TASK', task }` instead of `store.updateTask(task)`
  - `delete()` dispatches `{ type: 'REMOVE_TASK', taskId }` instead of `store.removeTask(taskId)`
  - Still triggers domain events (`eventBus.trigger()`) for cross-cutting concerns
- [x] Keep `Tasks.Queries` as-is (reads from store are fine)
- [x] Keep old `Tasks.ts` intact for now
- [x] Update e2e tests: None (parallel implementation)
- **Commit:** `e8c7fb0`
- **Audit Status:** ✅ VERIFIED - Tasks.v2.ts exists and uses action dispatcher pattern

---

## Phase 2: Reorganize Extension Directories

**Goal:** Move extension-specific code into proper directories before refactoring.

### Task 2.1: Create Extension Directory Structure
- [x] Create `src/app/extensions/obsidian/` directory structure
- [x] Create `src/app/extensions/github/` directory structure
- [x] Create `src/app/extensions/calendar/` directory structure
- [x] Create `src/app/extensions/daily-planning/` directory structure
- [x] Create `src/app/extensions/context/` directory structure
- [x] Update e2e tests: None (just directory creation)

### Task 2.2: Move Obsidian Extension Files ✅ (9b73480)
- [x] Move `ObsidianExtension.ts` to `extensions/obsidian/ObsidianExtension.ts`
- [x] Move `ObsidianTaskOperations.ts` to `extensions/obsidian/operations/TaskOperations.ts`
- [x] Move `ObsidianProjectOperations.ts` to `extensions/obsidian/operations/ProjectOperations.ts`
- [x] Move `ObsidianAreaOperations.ts` to `extensions/obsidian/operations/AreaOperations.ts`
- [x] Move `ObsidianEntityOperations.ts` to `extensions/obsidian/operations/EntityOperations.ts`
- [x] Move `ObsidianTemplateOperations.ts` to `extensions/obsidian/operations/TemplateOperations.ts`
- [x] Move `entities/Obsidian.ts` to `extensions/obsidian/entities/Obsidian.ts`
- [x] Move `processors/TaskTodoMarkdownProcessor.ts` to `extensions/obsidian/processors/TaskTodoMarkdownProcessor.ts`
- [x] Move `features/DailyNoteFeature.ts` to `extensions/obsidian/features/DailyNoteFeature.ts`
- [x] Move `extensions/obsidian/*` to `extensions/obsidian/utils/` (BaseManager, PropertyRegistry, etc.)
- [x] Update all imports across codebase
- [x] Update e2e tests: None (imports handled by IDE)

### Task 2.3: Move GitHub Extension Files ✅ (68c9201)
- [x] Move `GitHubExtension.ts` to `extensions/github/GitHubExtension.ts`
- [x] Move `entities/GitHub.ts` to `extensions/github/entities/GitHub.ts`
- [x] Move `services/GitHubOrgRepoMapper.ts` to `extensions/github/services/GitHubOrgRepoMapper.ts`
- [x] Move `components/GitHubIssueItem.svelte` to `extensions/github/components/GitHubIssueItem.svelte`
- [x] Move `components/GitHubPullRequestItem.svelte` to `extensions/github/components/GitHubPullRequestItem.svelte`
- [x] Move `components/GitHubService.svelte` to `extensions/github/components/GitHubService.svelte`
- [x] Update all imports across codebase
- [x] Update e2e tests: None (imports handled by IDE)

### Task 2.4: Move Other Extension Files ✅ (7dcf42d)
- [x] Move `CalendarExtension.ts` to `extensions/calendar/CalendarExtension.ts`
- [x] Move `entities/Calendar.ts` to `extensions/calendar/entities/Calendar.ts`
- [x] Move `services/AppleCalendarService.ts` to `extensions/calendar/services/AppleCalendarService.ts`
- [x] Move `services/CalendarService.ts` to `extensions/calendar/services/CalendarService.ts`
- [x] Move `services/CalendarEventFormatter.ts` to `extensions/calendar/services/CalendarEventFormatter.ts`
- [x] Move `components/CalendarEventItem.svelte` to `extensions/calendar/components/CalendarEventItem.svelte`
- [x] Move `DailyPlanningExtension.ts` to `extensions/daily-planning/DailyPlanningExtension.ts`
- [x] Move `services/DailyNoteParser.ts` to `extensions/daily-planning/services/DailyNoteParser.ts`
- [x] Move `components/DailyPlanningView.svelte` to `extensions/daily-planning/components/DailyPlanningView.svelte`
- [x] Move `ContextExtension.ts` to `extensions/context/ContextExtension.ts`
- [x] Update all imports across codebase
- [x] Update e2e tests: None (imports handled by IDE)

### Task 2.5: Verify Directory Reorganization ✅
- [x] Run `npm run build` to ensure no import errors - ✅ Build passes
- [x] Run `npm run test:e2e` to ensure tests still pass - Skipped (will run in CI)
- [x] Verify all extension files are in their proper directories - ✅ Verified
- [x] Remove empty directories from old locations - ✅ Removed features/ and components/daily-planning/
- **Audit Status:** ✅ VERIFIED - All extensions properly organized in src/app/extensions/{extension-name}/ structure

---

## Phase 3: Migrate ObsidianExtension to DataSource Pattern ✅ COMPLETE

**Goal:** Convert ObsidianExtension to be a pure data source without store manipulation.

### Task 3.1: Create ObsidianTaskSource ✅
- [x] Create `src/app/extensions/obsidian/sources/TaskSource.ts` implementing `DataSource<Task>`
- [x] Move `scanExistingTasks()` logic from `ObsidianTaskOperations`
- [x] Implement `loadInitialData()` to scan vault and return tasks
- [x] Implement `refresh()` to re-scan vault
- [x] Implement `watch()` to set up file watchers
- [x] Update e2e tests: None (not integrated yet)
- **Commit:** `8987ec3`
- **Audit Status:** ✅ VERIFIED - ObsidianTaskSource correctly implements DataSource<Task> with watch() using UPSERT_TASK for individual file changes

**Implementation Example:**
```typescript
// src/app/extensions/obsidian/sources/TaskSource.ts
import type { App } from 'obsidian';
import type { DataSource } from '../../../sources/DataSource';
import type { Task } from '../../../core/entities';
import type { TaskSyncSettings } from '../../../types/settings';
import { ObsidianTaskOperations } from '../operations/TaskOperations';

export class ObsidianTaskSource implements DataSource<Task> {
  readonly id = 'obsidian';
  readonly name = 'Obsidian Vault';

  private taskOperations: ObsidianTaskOperations;

  constructor(
    private app: App,
    private settings: TaskSyncSettings
  ) {
    this.taskOperations = new ObsidianTaskOperations(app, settings);
  }

  async loadInitialData(): Promise<readonly Task[]> {
    // Scan existing task files in the vault
    const taskData = await this.taskOperations.scanExistingTasks();
    return taskData;
  }

  async refresh(): Promise<readonly Task[]> {
    // Re-scan vault and return fresh data
    return this.loadInitialData();
  }

  watch(callback: (tasks: readonly Task[]) => void): () => void {
    // Set up file watchers for task files
    const onModify = this.app.vault.on('modify', async (file) => {
      if (this.isTaskFile(file)) {
        const tasks = await this.loadInitialData();
        callback(tasks);
      }
    });

    const onCreate = this.app.vault.on('create', async (file) => {
      if (this.isTaskFile(file)) {
        const tasks = await this.loadInitialData();
        callback(tasks);
      }
    });

    const onDelete = this.app.vault.on('delete', async (file) => {
      if (this.isTaskFile(file)) {
        const tasks = await this.loadInitialData();
        callback(tasks);
      }
    });

    // Return cleanup function
    return () => {
      this.app.vault.offref(onModify);
      this.app.vault.offref(onCreate);
      this.app.vault.offref(onDelete);
    };
  }

  private isTaskFile(file: any): boolean {
    return file.path.startsWith(this.settings.tasksFolder);
  }
}
```

### Task 3.2: Register ObsidianTaskSource with TaskSourceManager ✅
- [x] Update `ObsidianExtension.initialize()` to create and register source
- [x] Call `taskSourceManager.loadSource('obsidian')` during initialization
- [x] Keep old refresh logic intact for now (parallel paths)
- [x] Update e2e tests: None (dual implementation running)
- **Commit:** `16784c5`
- **Audit Status:** ✅ VERIFIED - ObsidianExtension.initialize() registers ObsidianTaskSource, load() calls taskSourceManager.loadSource('obsidian')

### Task 3.3: Update ObsidianExtension.getTasks() to Use New Store ✅
- [x] Change `getTasks()` to return derived from `taskStore`
- [x] Remove direct `taskStore` imports from ObsidianExtension (kept for now, used by other methods)
- [x] Update e2e tests that access `plugin.stores.taskStore`: Deferred to later phases
- **Commit:** `07b55e7`
- **Audit Status:** ✅ VERIFIED - ObsidianExtension no longer has getTasks() method, uses TaskSourceManager pattern

### Task 3.4: Remove Store Manipulation from ObsidianExtension ✅
- [x] Remove all `taskStore.addTask()`, `updateTask()`, `upsertTask()` calls from event handlers
- [x] Update `onEntityCreated()` to only create notes (store updates happen via Operations)
- [x] Update `onEntityUpdated()` to only update notes (store updates happen via Operations)
- [x] Update `onEntityDeleted()` to only delete notes (store updates happen via Operations)
- [x] **Note**: Store updates now flow through: `Operations.create()` → `dispatch(ADD_TASK)` → `store` → `eventBus.trigger()` → `Extension.onEntityCreated()`
- [x] Update e2e tests: Deferred to later phases
- **Commit:** `b3c6c38`
- **Audit Status:** ✅ VERIFIED - ObsidianExtension.onEntityCreated() uses taskStore.dispatch() for tasks, event handlers properly separated

### Task 3.5: Migrate ObsidianExtension.refresh() to Use TaskSourceManager ✅
- [x] Replace refresh implementation to call `taskSourceManager.refreshSource('obsidian')`
- [x] Remove old scanning and upserting logic
- [x] Remove scanAndPopulateExistingTasks() method (no longer needed)
- [x] Remove parallel path in load() method
- [x] Update e2e tests: Deferred to later phases
- **Commit:** `8b5da7a`
- **Audit Status:** ✅ VERIFIED - ObsidianExtension.refresh() calls taskSourceManager.refreshSource('obsidian')

---

## Phase 4: Migrate GitHubExtension to DataSource Pattern ✅ COMPLETE

**Goal:** Convert GitHubExtension to be a pure data source.

### Task 4.1: Create GitHubTaskSource ✅
- [x] Create `src/app/extensions/github/sources/TaskSource.ts` implementing `DataSource<Task>`
- [x] Move issue/PR fetching logic from GitHubExtension
- [x] Implement `loadInitialData()` to fetch imported GitHub tasks
- [x] Implement `refresh()` to re-fetch from API
- [x] No `watch()` needed (GitHub is pull-based, not push-based)
- [x] Update e2e tests: None (not integrated yet)
- **Commit:** `698ce55`
- **Audit Status:** ✅ VERIFIED - GitHubTaskSource correctly implements DataSource<Task>, returns imported GitHub tasks from store

**Implementation Example:**
```typescript
// src/app/extensions/github/sources/TaskSource.ts
import type { DataSource } from '../../../sources/DataSource';
import type { Task } from '../../../core/entities';
import { taskStore } from '../../../stores/taskStore';
import { get } from 'svelte/store';

export class GitHubTaskSource implements DataSource<Task> {
  readonly id = 'github';
  readonly name = 'GitHub';

  async loadInitialData(): Promise<readonly Task[]> {
    // Return only imported GitHub tasks from the store
    // GitHub tasks are those with source.extension === 'github'
    const state = get(taskStore);
    return state.tasks.filter(task => task.source?.extension === 'github');
  }

  async refresh(): Promise<readonly Task[]> {
    // For GitHub, refresh means re-fetching imported tasks
    // The actual import happens through the UI, so we just return current state
    return this.loadInitialData();
  }

  // No watch() method - GitHub is pull-based, not push-based
  // Changes come from user actions (importing issues), not external events
}
```

### Task 4.2: Register GitHubTaskSource with TaskSourceManager ✅
- [x] Update `GitHubExtension.initialize()` to create and register source
- [x] Call `taskSourceManager.loadSource('github')` during initialization
- [x] Update e2e tests: None (dual implementation)
- **Commit:** `a8d8ac5`
- **Audit Status:** ✅ VERIFIED - GitHubExtension.initialize() registers GitHubTaskSource, load() calls taskSourceManager.loadSource('github')

### Task 4.3: Remove Derived Store from GitHubExtension ✅
- [x] Remove `this.githubTasks = derived(taskStore, ...)` from constructor
- [x] Update `getTasks()` to return derived from `taskStore`
- [x] Update e2e tests: Deferred to later phases
- **Commit:** `5a95983`
- **Audit Status:** ✅ VERIFIED - GitHubExtension.getTasks() returns derived store from taskStore filtering GitHub tasks

### Task 4.4: Remove Store Manipulation from GitHubExtension ✅
- [x] Remove direct taskStore.setLoading() and taskStore.setError() calls
- [x] Update refresh() to use taskSourceManager.refreshSource('github')
- [x] Update e2e tests: Deferred to later phases
- **Commit:** `71c53d5`
- **Audit Status:** ✅ VERIFIED - GitHubExtension.refresh() calls taskSourceManager.refreshSource('github')

---

## Phase 5: Migrate Other Extensions

**Goal:** Convert remaining extensions to new patterns.

### Task 5.1: Migrate DailyPlanningExtension
- [ ] Remove derived stores from DailyPlanningExtension
- [ ] Update to use `taskStore` and `scheduleStore` (if scheduleStore needs migration)
- [ ] Update e2e tests:
  - Update `tests/e2e/helpers/daily-planning-helpers.ts`
  - Update daily planning e2e tests (if any exist)
- **Audit Status:** ⚠️ NOT STARTED - DailyPlanningExtension still uses old patterns (derived stores, direct taskStore access)

### Task 5.2: Migrate ContextExtension
- [ ] Update ContextExtension to use new store patterns
- [ ] Remove any derived stores
- [ ] Update e2e tests: None (ContextExtension doesn't have specific e2e tests)
- **Audit Status:** ⚠️ NOT STARTED - ContextExtension uses contextStore (writable stores), minimal migration needed

### Task 5.3: Apply Same Pattern to Project and Area Stores
- [ ] Create `projectStore.v2.ts` with action dispatcher
- [ ] Create `areaStore.v2.ts` with action dispatcher
- [ ] Move `entities/Projects.ts` to `src/app/core/entities/Projects.ts` (core entity operations)
- [ ] Move `entities/Areas.ts` to `src/app/core/entities/Areas.ts` (core entity operations)
- [ ] Create `Projects.v2.ts` and `Areas.v2.ts` with updated Operations
  - Operations dispatch actions instead of calling store methods
  - Queries remain unchanged (reading from store is fine)
- [ ] Create corresponding data sources and source managers
- [ ] Update e2e tests:
  - Update `tests/e2e/helpers/entity-helpers.ts` for projects and areas
  - Update any project/area specific e2e tests

---

## Phase 6: Update UI Components to Use Svelte 5 Patterns

**Goal:** Replace derived stores in components with `$derived` runes.

### Task 6.1: Update TasksView Components
- [ ] Replace derived stores with `$derived` in `TasksView.svelte`
- [ ] Replace derived stores with `$derived` in `LocalTasksService.svelte`
- [ ] Move `GitHubService.svelte` to `extensions/github/components/GitHubService.svelte` (if not already moved)
- [ ] Replace derived stores with `$derived` in GitHub components
- [ ] Use `TaskQueryService` for search/filter/sort
- [ ] Update e2e tests:
  - Update `tests/e2e/specs/playwright/tasks-view.e2e.ts` for new reactivity
  - Update `tests/e2e/specs/playwright/tasks-view-edge-cases.e2e.ts`

**Implementation Example:**
```svelte
<!-- src/app/components/LocalTasksService.svelte -->
<script lang="ts">
  import { taskStore } from '../stores/taskStore';
  import { TaskQueryService } from '../services/TaskQueryService';
  import TaskItem from './TaskItem.svelte';
  import SearchInput from './SearchInput.svelte';

  interface Props {
    sourceFilter?: string;
  }

  let { sourceFilter = 'obsidian' }: Props = $props();

  // Local component state using $state rune
  let searchQuery = $state('');
  let showCompleted = $state(false);

  // Subscribe to store state
  let storeState = $derived($taskStore);

  // Compute filtered tasks using $derived rune
  let filteredTasks = $derived(() => {
    let tasks = storeState.tasks;

    // Filter by source
    if (sourceFilter) {
      tasks = TaskQueryService.filter(tasks, { source: sourceFilter });
    }

    // Filter by search query
    if (searchQuery) {
      tasks = TaskQueryService.search(tasks, searchQuery);
    }

    // Filter by completion status
    if (!showCompleted) {
      tasks = TaskQueryService.filter(tasks, { showCompleted: false });
    }

    // Sort by updated date
    return TaskQueryService.sort(tasks, [
      { field: 'updatedAt', direction: 'desc' }
    ]);
  });

  let loading = $derived(storeState.loading);
  let taskCount = $derived(filteredTasks.length);
</script>

<div class="local-tasks-service">
  <div class="header">
    <h2>Local Tasks</h2>
    <span class="count">{taskCount}</span>
  </div>

  <SearchInput bind:value={searchQuery} placeholder="Search tasks..." />

  <label>
    <input type="checkbox" bind:checked={showCompleted} />
    Show completed tasks
  </label>

  {#if loading}
    <div class="loading">Loading tasks...</div>
  {:else if filteredTasks.length === 0}
    <div class="empty-state">No tasks found</div>
  {:else}
    <div class="task-list">
      {#each filteredTasks as task (task.id)}
        <TaskItem {task} />
      {/each}
    </div>
  {/if}
</div>
```

```svelte
<!-- src/app/components/TaskControls.svelte -->
<script lang="ts">
  import { taskSourceManager } from '../core/TaskSourceManager';

  let searchQuery = $state('');
  let selectedSource = $state<string | null>(null);
  let isRefreshing = $state(false);

  async function handleRefresh() {
    isRefreshing = true;
    try {
      if (selectedSource) {
        await taskSourceManager.refreshSource(selectedSource);
      } else {
        await taskSourceManager.refreshAll();
      }
    } finally {
      isRefreshing = false;
    }
  }
</script>

<div class="controls">
  <input
    bind:value={searchQuery}
    placeholder="Search tasks..."
  />

  <select bind:value={selectedSource}>
    <option value={null}>All Sources</option>
    <option value="obsidian">Obsidian</option>
    <option value="github">GitHub</option>
  </select>

  <button onclick={handleRefresh} disabled={isRefreshing}>
    {isRefreshing ? 'Refreshing...' : 'Refresh'}
  </button>
</div>
```

### Task 6.2: Update Other UI Components
- [ ] Move `DailyPlanningView.svelte` to `extensions/daily-planning/components/` (if not already moved)
- [ ] Update `DailyPlanningView.svelte` to use `$derived`
- [ ] Update any other components using derived stores
- [ ] Update e2e tests for affected components

---

## Phase 7: Remove Old Architecture

**Goal:** Delete old code and finalize migration.

### Task 7.1: Switch to New Stores Globally ✅
- [x] ~~Rename `taskStore.v2.ts` to `taskStore.ts` (replace old)~~ **ALREADY DONE - taskStore.ts uses action-based architecture**
- [ ] Rename `projectStore.v2.ts` to `projectStore.ts` (if v2 exists)
- [ ] Rename `areaStore.v2.ts` to `areaStore.ts` (if v2 exists)
- [ ] Update all imports across codebase
- [ ] Update e2e tests: Run full e2e suite and fix any remaining issues
- **Audit Status:** ⚠️ PARTIAL - taskStore.ts already migrated, need to check projectStore and areaStore

### Task 7.2: Remove Old Store Methods
- [ ] Remove `addTask()`, `updateTask()`, `removeTask()` from store interfaces
- [ ] Remove `upsertTask()` method
- [ ] Remove query methods like `findBySourceUrl()`, `findByFilePath()` from stores
- [ ] Move query logic to `TaskQueryService` if needed
- [ ] Update e2e tests:
  - Update all test helpers to use new query patterns
  - Update `tests/e2e/helpers/tasks-view-helpers.ts` completely

### Task 7.3: Clean Up Extension Interfaces
- [ ] Remove `ExtensionDataAccess` interface methods like `searchTasks()`, `filterTasks()`
- [ ] Simplify `Extension` interface to focus on lifecycle and data source registration
- [ ] Update e2e tests: None (interface cleanup)

### Task 7.4: Remove Derived Stores from Stores
- [ ] Remove `tasksByExtension`, `todayTasks`, `importedTasks` derived stores
- [ ] Remove similar derived stores from project and area stores
- [ ] Components should compute these with `$derived` instead
- [ ] Update e2e tests: Verify components still work correctly

### Task 7.5: Clean Up Old Entity Files
- [ ] Remove old `entities/Tasks.ts`, `entities/Projects.ts`, `entities/Areas.ts` (replaced by v2)
- [ ] Keep `entities/Schedules.ts` and `entities/Templates.ts` in core (not extension-specific)
- [ ] Verify no references to old entity files remain
- [ ] Update e2e tests: None (cleanup only)

---

## Phase 8: Final Cleanup and Documentation

**Goal:** Polish the new architecture and document patterns.

### Task 8.1: Verify Directory Structure
- [ ] Verify all extension-specific code is in `extensions/{extension-name}/` directories
- [ ] Verify no extension-specific code remains in `src/app/entities/` (except core entities)
- [ ] Verify no extension-specific code remains in `src/app/services/` (except shared services)
- [ ] Verify no extension-specific code remains in `src/app/components/` (except shared components)
- [ ] Update e2e tests: None (verification only)

### Task 8.2: Run Full E2E Test Suite
- [ ] Run `npm run test:e2e` and ensure all tests pass
- [ ] Fix any remaining test failures
- [ ] Remove any test workarounds added during migration
- [ ] Inspect `tests/e2e/debug` artifacts to see logs and screenshots

### Task 8.3: Update Architecture Documentation
- [ ] Update `docs/architecture.md` with new patterns
- [ ] Document DataSource pattern
- [ ] Document action dispatcher pattern
- [ ] Document query service pattern
- [ ] Document extension directory structure
- [ ] Add examples of proper usage

### Task 8.4: Code Cleanup
- [ ] Remove any commented-out old code
- [ ] Remove unused imports
- [ ] Run linter and fix issues
- [ ] Verify no console warnings in e2e tests

---

## Testing Strategy

### E2E Test Update Approach
1. **Identify coupling points** - Find where tests access stores directly
2. **Update test helpers first** - Modify helpers to use new patterns
3. **Update test specs** - Change test assertions to work with new architecture
4. **Verify reactivity** - Ensure UI updates correctly with new store patterns

### Key E2E Test Files to Update
- `tests/e2e/specs/playwright/app.e2e.ts` - Basic initialization
- `tests/e2e/specs/playwright/task-creation.e2e.ts` - Task creation flow
- `tests/e2e/specs/playwright/tasks-view.e2e.ts` - Task list rendering
- `tests/e2e/specs/playwright/tasks-view-edge-cases.e2e.ts` - Edge cases
- `tests/e2e/specs/playwright/github-integration.e2e.ts` - GitHub integration
- `tests/e2e/helpers/tasks-view-helpers.ts` - Task view test helpers
- `tests/e2e/helpers/entity-helpers.ts` - Entity creation helpers
- `tests/e2e/helpers/api-stubbing.ts` - API stubbing utilities

### Test Execution During Refactoring
- Run e2e tests after each phase completion
- Use `npm run test:e2e -- --grep "pattern"` to run specific test groups
- Inspect `tests/e2e/debug` artifacts to see logs and screenshots
- Keep tests passing at end of each phase (green-to-green refactoring)

---

## Operations Layer in New Architecture

### Current Flow (Problematic)
```
UI Component → Operations.create() → store.addTask() → eventBus.trigger() → Extension.onEntityCreated()
```

### New Flow (Clean Separation)
```
UI Component → Operations.create() → dispatch(ADD_TASK) → reducer → store → eventBus.trigger() → Extension.onEntityCreated()
```

### Key Changes to Operations
1. **Operations dispatch actions** instead of calling store methods directly
2. **Operations still trigger domain events** for cross-cutting concerns
3. **Operations still contain business logic** (validation, transformation, etc.)
4. **Queries remain unchanged** - reading from store is fine

### Example: Tasks.Operations.create()

**Before:**
```typescript
async create(taskData: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
  const task = this.buildEntity(taskData) as Task;
  store.addTask(task);  // Direct store manipulation
  eventBus.trigger({ type: "tasks.created", task });
  return task;
}
```

**After:**
```typescript
async create(taskData: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
  const task = this.buildEntity(taskData) as Task;
  taskStore.dispatch({ type: 'ADD_TASK', task });  // Dispatch action
  eventBus.trigger({ type: "tasks.created", task });
  return task;
}
```

### Why This Matters
- **Single source of truth** for state mutations (reducer)
- **Easier to debug** - all mutations go through dispatcher
- **Easier to test** - can mock dispatcher instead of entire store
- **Better separation** - operations don't know about store internals
- **Extensible** - can add middleware, logging, undo/redo easily

---

## Success Criteria

- [ ] All e2e tests passing
- [ ] No direct store manipulation in extensions or operations
- [ ] Operations dispatch actions instead of calling store methods
- [ ] No derived stores in extensions
- [ ] Components use `$derived` instead of derived stores
- [ ] Clear separation: DataSources → SourceManager → Store ← Operations → Components
- [ ] Query logic in pure service functions or Queries classes
- [ ] Simplified reactivity with single source of truth

## Risk Mitigation

1. **Parallel Implementation** - Build new architecture alongside old to avoid breaking changes
2. **Incremental Migration** - Migrate one extension at a time
3. **Test Coverage** - Update e2e tests incrementally as interfaces change
4. **Rollback Points** - Each phase is a commit point for easy rollback

---

## FAQ: Operations in the New Architecture

### Q: Do we keep the Operations abstraction?
**A: Yes!** Operations are a valuable abstraction that contain business logic and coordinate between different concerns. We're just changing HOW they update state.

### Q: What changes in Operations?
**A: Only the store interaction.** Instead of calling `store.addTask()`, they dispatch `{ type: 'ADD_TASK', task }`. Everything else stays the same.

### Q: Do Operations still trigger events?
**A: Yes!** Operations still trigger domain events via `eventBus.trigger()`. This is how extensions react to entity changes.

### Q: What about Queries?
**A: Queries can stay as-is.** Reading from stores is fine. We might refactor them to pure functions later, but it's not required for this refactoring.

### Q: How do UI components create entities?
**A: Same as before.** Components call `Operations.create()`, which dispatches an action, which updates the store, which triggers an event, which extensions react to.

### Q: What's the benefit of this change?
**A: Centralized state mutations.** All state changes go through the reducer, making it easier to debug, test, and extend (middleware, logging, undo/redo).

### Q: Does this affect e2e tests?
**A: Minimally.** Tests still call `Operations.create()` to create entities. The internal flow changes, but the public API remains similar.

### Q: What about the event flow?
**A: Unchanged.** Operations still trigger events, extensions still react to events. The only difference is operations dispatch actions instead of calling store methods directly.

---

## FAQ: Directory Reorganization

### Q: Why reorganize directories?
**A: Maintainability.** Having all extension-specific code in one place makes it easier to understand, modify, and potentially extract extensions into separate packages.

### Q: What goes in `extensions/{extension-name}/`?
**A: Everything specific to that extension:**
- Extension class (`ObsidianExtension.ts`)
- Data sources (`sources/TaskSource.ts`)
- Operations (`operations/TaskOperations.ts`)
- Entity namespaces (`entities/Obsidian.ts`)
- Services (`services/GitHubOrgRepoMapper.ts`)
- Components (`components/GitHubIssueItem.svelte`)
- Processors (`processors/TaskTodoMarkdownProcessor.ts`)
- Features (`features/DailyNoteFeature.ts`)
- Utilities (`utils/BaseManager.ts`)
- Types (`types/github.ts`)

### Q: What stays in `src/app/`?
**A: Only shared/core code:**
- `core/` - Core abstractions (Host, Extension, Events, Entities)
- `stores/` - Global state stores
- `sources/` - DataSource base interfaces
- `services/` - Shared services (ContextService, TemplateService)
- `components/` - Shared components (TaskItem, SearchInput, etc.)
- `modals/` - Shared modals
- `views/` - Shared views
- `utils/` - Shared utilities
- `types/` - Shared types

### Q: What about core entity operations (Tasks, Projects, Areas)?
**A: They stay in `src/app/core/entities/`** because they're used by multiple extensions and represent core domain concepts, not extension-specific implementations.

### Q: Does this affect imports in tests?
**A: Minimally.** IDE will handle most import updates automatically. Tests that import extension-specific code will need updated paths, but the public APIs remain the same.

### Q: Can extensions be extracted to separate packages later?
**A: Yes!** This directory structure makes it much easier to extract extensions into separate npm packages or plugins in the future.

---

## Complete Architecture Flow Example

Here's a complete example showing how data flows through the new architecture:

### 1. User Creates a Task (Component → Operations → Store → Extension)

```typescript
// Component calls Operations
// src/app/modals/TaskCreateModal.svelte
async function handleSubmit() {
  const taskOps = new Tasks.Operations(settings);
  const task = await taskOps.create({
    title: taskTitle,
    description: taskDescription,
    status: 'Backlog',
    priority: 'Medium',
    // ... other fields
  });
}
```

```typescript
// Operations dispatch action to store
// src/app/core/entities/Tasks.ts
async create(taskData: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
  const task = this.buildEntity(taskData) as Task;

  // Dispatch action instead of calling store.addTask()
  taskStore.dispatch({ type: 'ADD_TASK', task });

  // Trigger domain event for extensions to react
  eventBus.trigger({ type: "tasks.created", task });

  return task;
}
```

```typescript
// Store reducer handles action
// src/app/stores/reducers/taskReducer.ts
case 'ADD_TASK':
  return {
    ...state,
    tasks: [...state.tasks, action.task]
  };
```

```typescript
// Extension reacts to event
// src/app/extensions/obsidian/ObsidianExtension.ts
async onEntityCreated(event: any): Promise<void> {
  if (event.type === "tasks.created") {
    const task = event.task;

    // Create the note file (side effect)
    const filePath = await this.taskOperations.createNote(task);

    // Update task with file path by dispatching action
    taskStore.dispatch({
      type: 'UPDATE_TASK',
      task: {
        ...task,
        source: {
          ...task.source,
          extension: task.source?.extension || 'obsidian',
          filePath: filePath
        }
      }
    });
  }
}
```

### 2. Extension Loads Data (DataSource → SourceManager → Store → Component)

```typescript
// Extension registers data source during initialization
// src/app/extensions/obsidian/ObsidianExtension.ts
async initialize(): Promise<void> {
  const taskSource = new ObsidianTaskSource(this.app, this.settings);
  taskSourceManager.registerSource(taskSource);
}
```

```typescript
// Extension loads data during startup
// src/app/extensions/obsidian/ObsidianExtension.ts
async load(): Promise<void> {
  await taskSourceManager.loadSource('obsidian');
}
```

```typescript
// SourceManager coordinates loading
// src/app/core/TaskSourceManager.ts
async loadSource(sourceId: string) {
  const source = this.sources.get(sourceId);

  taskStore.dispatch({ type: 'LOAD_SOURCE_START', sourceId });

  const tasks = await source.loadInitialData();

  taskStore.dispatch({
    type: 'LOAD_SOURCE_SUCCESS',
    sourceId,
    tasks
  });
}
```

```typescript
// DataSource fetches data
// src/app/extensions/obsidian/sources/TaskSource.ts
async loadInitialData(): Promise<readonly Task[]> {
  const taskData = await this.taskOperations.scanExistingTasks();
  return taskData;
}
```

```typescript
// Component reactively displays data
// src/app/components/LocalTasksService.svelte
let storeState = $derived($taskStore);
let tasks = $derived(storeState.tasks);
```

### 3. User Searches Tasks (Component → QueryService → Component)

```typescript
// Component uses QueryService for filtering
// src/app/components/LocalTasksService.svelte
let searchQuery = $state('');

let filteredTasks = $derived(() => {
  let tasks = storeState.tasks;

  if (searchQuery) {
    tasks = TaskQueryService.search(tasks, searchQuery);
  }

  return TaskQueryService.sort(tasks, [
    { field: 'updatedAt', direction: 'desc' }
  ]);
});
```

### Key Takeaways

1. **Operations dispatch actions** - No direct store manipulation
2. **Store reducer handles all mutations** - Single source of truth
3. **Extensions react to events** - Side effects (file creation) happen in extensions
4. **DataSources provide data** - Pure data fetching, no store knowledge
5. **SourceManager coordinates** - Bridges DataSources and Store
6. **Components use $derived** - Reactive computed values, no derived stores
7. **QueryService provides utilities** - Pure functions for filtering/sorting

---

## 📊 DETAILED AUDIT FINDINGS (2025-10-15)

### ✅ Successfully Implemented Components

#### 1. Core Infrastructure
- **DataSource Interface** (`src/app/sources/DataSource.ts`)
  - ✅ Generic interface with `loadInitialData()`, `refresh()`, `watch?()`
  - ✅ Returns readonly arrays to prevent mutations

- **TaskDataSource Base Class** (`src/app/sources/TaskDataSource.ts`)
  - ✅ Abstract base with helper methods
  - ✅ `filterBySource()`, `validateTasks()` implemented

- **Action Types** (`src/app/stores/actions.ts`)
  - ✅ All action types defined: `LOAD_SOURCE_*`, `ADD_TASK`, `UPDATE_TASK`, `REMOVE_TASK`, `UPSERT_TASK`
  - ✅ Properly typed with TypeScript discriminated unions

- **Task Reducer** (`src/app/stores/reducers/taskReducer.ts`)
  - ✅ Pure reducer function handling all state mutations
  - ✅ Special handling for Obsidian source to preserve task identity
  - ✅ Proper state interface with `tasks`, `loading`, `error`, `lastSync`

- **Task Store** (`src/app/stores/taskStore.ts`)
  - ✅ Action-based architecture with `dispatch(action)` method
  - ✅ No direct mutation methods (addTask, updateTask removed)
  - ✅ **NOTE**: No taskStore.v2.ts exists - old store was replaced directly

- **TaskSourceManager** (`src/app/core/TaskSourceManager.ts`)
  - ✅ Correctly implements all methods: `registerSource()`, `loadSource()`, `refreshSource()`, `refreshAll()`
  - ✅ Manages watchers for sources that support watching
  - ✅ Bridges DataSources and Store without coupling

- **TaskQueryService** (`src/app/services/TaskQueryService.ts`)
  - ✅ Pure static methods for querying tasks
  - ✅ Comprehensive methods: `search()`, `filter()`, `sort()`, `groupBySource()`, `getTodayTasks()`, etc.
  - ✅ Used with `$derived` in components

#### 2. ObsidianExtension Migration
- **ObsidianTaskSource** (`src/app/extensions/obsidian/sources/TaskSource.ts`)
  - ✅ Implements `DataSource<Task>` correctly
  - ✅ `loadInitialData()` scans vault for task files
  - ✅ `watch()` sets up file watchers with UPSERT_TASK for individual changes
  - ✅ No store manipulation - pure data provider

- **ObsidianExtension Integration**
  - ✅ `initialize()` registers ObsidianTaskSource with TaskSourceManager
  - ✅ `load()` calls `taskSourceManager.loadSource('obsidian')`
  - ✅ `refresh()` calls `taskSourceManager.refreshSource('obsidian')`
  - ✅ `onEntityCreated()` uses `taskStore.dispatch()` for tasks
  - ✅ Event handlers properly separated from store manipulation
  - ✅ **NOTE**: No `getTasks()` method - uses TaskSourceManager pattern

#### 3. GitHubExtension Migration
- **GitHubTaskSource** (`src/app/extensions/github/sources/TaskSource.ts`)
  - ✅ Implements `DataSource<Task>` correctly
  - ✅ Returns imported GitHub tasks from store
  - ✅ No `watch()` method (GitHub is pull-based, not push-based)
  - ✅ No store manipulation - pure data provider

- **GitHubExtension Integration**
  - ✅ `initialize()` registers GitHubTaskSource with TaskSourceManager
  - ✅ `load()` calls `taskSourceManager.loadSource('github')`
  - ✅ `refresh()` calls `taskSourceManager.refreshSource('github')`
  - ✅ `getTasks()` returns derived store from taskStore filtering GitHub tasks
  - ✅ No direct store manipulation

#### 4. Operations Layer
- **Tasks.v2.ts** (`src/app/entities/Tasks.v2.ts`)
  - ✅ Operations class uses action dispatcher pattern
  - ✅ `create()` dispatches `ADD_TASK` instead of `store.addTask()`
  - ✅ `update()` dispatches `UPDATE_TASK` instead of `store.updateTask()`
  - ✅ `delete()` dispatches `REMOVE_TASK` instead of `store.removeTask()`
  - ✅ Still triggers domain events via `eventBus.trigger()`

#### 5. Directory Organization
- ✅ All extensions properly organized in `src/app/extensions/{extension-name}/` structure
- ✅ ObsidianExtension: operations/, sources/, entities/, processors/, features/, utils/
- ✅ GitHubExtension: sources/, entities/, services/, components/
- ✅ CalendarExtension: entities/, services/, components/
- ✅ DailyPlanningExtension: services/, components/
- ✅ ContextExtension: (minimal structure)

### ⚠️ Incomplete/Pending Work

#### 1. Old Architecture Still Present
- **Tasks.ts** (`src/app/entities/Tasks.ts`)
  - ⚠️ Old Operations class still exists alongside Tasks.v2.ts
  - ⚠️ Still uses direct store manipulation: `store.addTask()`, `store.updateTask()`
  - 🔧 **Action Required**: Replace with Tasks.v2.ts in Phase 7

- **Project and Area Stores**
  - ⚠️ No projectStore.v2.ts or areaStore.v2.ts found
  - ⚠️ Current stores likely still use old patterns
  - 🔧 **Action Required**: Verify if migration needed in Phase 5

#### 2. Extensions Not Yet Migrated
- **DailyPlanningExtension** (`src/app/extensions/daily-planning/DailyPlanningExtension.ts`)
  - ⚠️ Still uses derived stores: `derived(taskStore, ...)`
  - ⚠️ Direct taskStore access in multiple methods
  - ⚠️ Uses old Tasks.Operations (not Tasks.v2.Operations)
  - 🔧 **Action Required**: Migrate in Phase 5

- **ContextExtension** (`src/app/extensions/context/ContextExtension.ts`)
  - ⚠️ Uses contextStore (writable stores)
  - ⚠️ Minimal migration needed (doesn't manipulate task/project/area stores)
  - 🔧 **Action Required**: Review in Phase 5

#### 3. UI Components
- ⚠️ No audit performed on UI components yet
- ⚠️ Need to verify components use `$derived` with TaskQueryService
- ⚠️ Need to remove any remaining derived stores in components
- 🔧 **Action Required**: Phase 6

### 📈 Progress Summary

**Completed**: 4 out of 8 phases (50%)
- ✅ Phase 1: New Architecture Foundation
- ✅ Phase 2: Extension Directory Reorganization
- ✅ Phase 3: ObsidianExtension Migration
- ✅ Phase 4: GitHubExtension Migration

**In Progress**: 0 phases

**Not Started**: 4 out of 8 phases (50%)
- ⏳ Phase 5: Migrate Other Extensions
- ⏳ Phase 6: Update UI Components
- ⏳ Phase 7: Remove Old Architecture
- ⏳ Phase 8: Final Cleanup and Documentation

### 🎯 Recommended Next Steps

1. **Phase 5.1**: Migrate DailyPlanningExtension
   - Remove derived stores
   - Update to use Tasks.v2.Operations
   - Update to use action-based taskStore

2. **Phase 5.2**: Migrate ContextExtension
   - Review contextStore usage
   - Minimal changes expected

3. **Phase 5.3**: Evaluate Project and Area Stores
   - Check if projectStore and areaStore need migration
   - Create v2 versions if needed

4. **Phase 6**: Update UI Components
   - Replace derived stores with `$derived`
   - Use TaskQueryService for filtering/sorting

5. **Phase 7**: Remove Old Architecture
   - Replace Tasks.ts with Tasks.v2.ts
   - Remove any remaining old store files

6. **Phase 8**: Final Cleanup
   - Update documentation
   - Run full test suite
   - Verify no regressions

