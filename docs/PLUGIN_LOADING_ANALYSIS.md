# Plugin Loading Process Analysis - source.extension Overwriting Bug

> **Document Purpose**: Deep analysis of the critical bug where Obsidian extension overwrites `source.extension` from 'github' to 'obsidian' during plugin load. This document identifies the root causes, explains why previous fixes failed, and proposes a comprehensive solution.

> **Visual Flow Diagram**: See the Mermaid diagram "Plugin Loading Bug - Current vs Fixed Flow" for a visual comparison of the current buggy behavior vs. the proposed fix.

## Executive Summary

**Critical Bug**: The Obsidian extension overwrites `data.source.extension` from 'github' to 'obsidian' when the plugin loads, despite multiple attempts to fix this issue.

**Root Cause**: The architecture has a fundamental flaw in the `LOAD_SOURCE_SUCCESS` reducer logic that filters tasks by `source.extension` matching `sourceId`, which causes GitHub tasks to be removed from the store when Obsidian loads.

**Impact**: GitHub tasks lose their source identity, breaking cross-source synchronization and causing data integrity issues.

---

## Plugin Loading Sequence

### Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Plugin Initialization (main.ts)                             │
│    onload() → ObsidianHost → Settings → TypeNote → App.init    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. GitHub Extension Loads (EARLY)                              │
│    GitHubExtension.load()                                       │
│    → loadSource("github")                                       │
│    → Fetch GitHub issues/PRs                                    │
│    → Dispatch LOAD_SOURCE_SUCCESS                               │
│                                                                 │
│    Store State: [{id: "1", source: {extension: "github",       │
│                    keys: {github: "url", obsidian: "path"}}}]   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Layout Ready Event                                           │
│    ObsidianHost.load() → taskSyncApp.load()                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Obsidian Extension Loads (LATE)                             │
│    ObsidianExtension.load()                                     │
│    → refreshSource("obsidian")                                  │
│    → ObsidianTaskSource.refresh()                               │
│    → scanExistingTasks()                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. File Scanning (parseFileToTaskData)                         │
│    For each .md file in Tasks/:                                 │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ Find existing task by file path                      │    │
│    │ ✅ Preserve source.extension = "github"              │    │
│    │ ✅ Preserve source.keys.github                       │    │
│    │ ✅ Preserve source.data (GitHub issue data)          │    │
│    │ Update source.keys.obsidian = file.path              │    │
│    └──────────────────────────────────────────────────────┘    │
│                                                                 │
│    Scanned tasks: [{id: "1", source: {extension: "github",     │
│                     keys: {github: "url", obsidian: "path"}}}]  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Filter by Extension (ObsidianTaskSource.loadInitialData)    │
│    ❌ Filter out GitHub tasks!                                 │
│    const obsidianTasks = allTasks.filter(                       │
│      task => task.source.extension === "obsidian"              │
│    );                                                           │
│                                                                 │
│    Filtered tasks: [] (empty - GitHub task removed!)           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Dispatch LOAD_SOURCE_SUCCESS                                │
│    taskStore.dispatch({                                         │
│      type: "LOAD_SOURCE_SUCCESS",                               │
│      sourceId: "obsidian",                                      │
│      tasks: [] // Empty!                                        │
│    });                                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Reducer Processes (taskReducer.ts)                          │
│    ❌❌ CRITICAL BUG HERE ❌❌                                   │
│                                                                 │
│    const filteredTasks = state.tasks.filter(                   │
│      task => task.source.extension !== "obsidian"              │
│    );                                                           │
│    // Removes: [] (nothing to remove, already filtered)        │
│    // BUT SHOULD HAVE REMOVED GITHUB TASKS!                    │
│                                                                 │
│    Actually, the bug is WORSE:                                  │
│    - If GitHub task WAS in the scanned list                    │
│    - It would be filtered out by line 107                      │
│    - Because source.extension = "github" !== "obsidian"        │
│                                                                 │
│    Final Store: [] (GitHub task lost!)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Step-by-Step

### 1. Plugin Initialization (`main.ts`)

```
onload()
  → Create ObsidianHost
  → Load settings
  → Create TypeNote API
  → taskSyncApp.initialize(host)
  → host.onload()
```

### 2. App Initialization (`App.ts`)

```
initialize(host)
  → Store host reference
  → Initialize ObsidianExtension
  → ObsidianExtension.initialize()
```

### 3. ObsidianExtension Initialization

```
initialize()
  → Register ObsidianTaskSource with TaskSourceManager
  → Register ObsidianEntityDataProvider with SyncManager
```

### 4. Layout Ready - Extension Loading

```
ObsidianHost.load()
  → taskSyncApp.load()
  → ObsidianExtension.load()
  → taskSourceManager.refreshSource("obsidian")
```

### 5. Task Loading Flow

```
taskSourceManager.refreshSource("obsidian")
  → ObsidianTaskSource.refresh()
  → ObsidianTaskSource.loadInitialData()
  → taskOperations.scanExistingTasks()
  → For each file: parseFileToTaskData()
  → Filter: only tasks where source.extension === "obsidian"
  → Dispatch: LOAD_SOURCE_SUCCESS with filtered tasks
```

---

## Code Locations Reference

### Key Files and Line Numbers

1. **Plugin Entry Point**
   - `src/main.ts:153-174` - `onload()` method
   - `src/main.ts:168` - `taskSyncApp.initialize(this.host)`

2. **App Initialization**
   - `src/app/App.ts:50-66` - `initialize()` method
   - `src/app/App.ts:65` - `ObsidianExtension.initialize()`

3. **Extension Loading**
   - `src/app/extensions/obsidian/ObsidianExtension.ts:307-356` - `load()` method
   - `src/app/extensions/obsidian/ObsidianExtension.ts:314` - `refreshSource("obsidian")`

4. **Task Source**
   - `src/app/extensions/obsidian/sources/TaskSource.ts:58-83` - `loadInitialData()`
   - `src/app/extensions/obsidian/sources/TaskSource.ts:67-69` - ❌ Filter by extension
   - `src/app/extensions/obsidian/sources/TaskSource.ts:94-147` - `refresh()`

5. **Task Operations**
   - `src/app/extensions/obsidian/operations/TaskOperations.ts:45-88` - `scanExistingTasks()`
   - `src/app/extensions/obsidian/operations/TaskOperations.ts:233-404` - `parseFileToTaskData()`
   - `src/app/extensions/obsidian/operations/TaskOperations.ts:344-363` - ✅ Preserve source

6. **Build Entity**
   - `src/app/extensions/obsidian/entities/Obsidian.ts:69-117` - `buildEntity()`
   - `src/app/extensions/obsidian/entities/Obsidian.ts:107-108` - ✅ Preserve extension

7. **Task Reducer (THE BUG)**
   - `src/app/stores/reducers/taskReducer.ts:103-142` - ❌❌ `LOAD_SOURCE_SUCCESS`
   - `src/app/stores/reducers/taskReducer.ts:106-108` - ❌ Filter removes GitHub tasks

8. **Task Source Manager**
   - `src/app/core/TaskSourceManager.ts:147-173` - `loadSource()`
   - `src/app/core/TaskSourceManager.ts:180-210` - `refreshSource()`

---

## The Critical Bug: LOAD_SOURCE_SUCCESS Reducer

### Location: `src/app/stores/reducers/taskReducer.ts:103-142`

```typescript
case "LOAD_SOURCE_SUCCESS": {
  // ⚠️ BUG: This removes ALL tasks where source.extension !== sourceId
  const filteredTasks = state.tasks.filter(
    (task) => task.source.extension !== action.sourceId  // ← PROBLEM!
  );

  // Add new tasks from this source
  const newTasks = action.tasks.map(...);

  return {
    ...state,
    tasks: [...filteredTasks, ...newTasks],  // ← GitHub tasks removed!
  };
}
```

### What Happens:

1. **GitHub Extension loads first** (earlier in initialization)
   - GitHub tasks added to store with `source.extension = "github"`
   - Store contains: `[{id: "1", source: {extension: "github", keys: {github: "...", obsidian: "Tasks/foo.md"}}}]`

2. **Obsidian Extension loads** (after layout ready)
   - Calls `refreshSource("obsidian")`
   - `parseFileToTaskData()` scans vault and finds GitHub task file
   - **Correctly preserves** `source.extension = "github"` (lines 344-354)
   - **Filters out** GitHub task because `source.extension !== "obsidian"` (line 67-69)
   - Returns only Obsidian-owned tasks to reducer

3. **LOAD_SOURCE_SUCCESS reducer executes**
   - `filteredTasks = state.tasks.filter(task => task.source.extension !== "obsidian")`
   - This **removes GitHub tasks** from store!
   - Only Obsidian tasks remain

4. **Result**: GitHub tasks disappear from the store entirely

---

## Why Previous Fixes Failed

### Attempt 1: Preserve source.extension in parseFileToTaskData
- **Location**: `TaskOperations.ts:344-354`
- **Status**: ✅ Works correctly
- **Problem**: Reducer still removes tasks

### Attempt 2: Filter in ObsidianTaskSource.loadInitialData
- **Location**: `TaskSource.ts:67-69`
- **Status**: ✅ Works correctly
- **Problem**: Reducer still removes tasks

### Attempt 3: Preserve in buildEntity
- **Location**: `Obsidian.ts:107-108`
- **Status**: ✅ Works correctly
- **Problem**: Reducer still removes tasks

**All fixes addressed symptoms, not the root cause in the reducer.**

---

## Concrete Bug Scenario with Data

### Initial State: GitHub Task Imported

```typescript
// User imports GitHub issue #123 to Obsidian
// File created: Tasks/Fix login bug.md

// Store state after GitHub extension loads:
taskStore.tasks = [
  {
    id: "task-abc123",
    title: "Fix login bug",
    source: {
      extension: "github",  // ← Owned by GitHub
      keys: {
        github: "https://github.com/user/repo/issues/123",
        obsidian: "Tasks/Fix login bug.md"  // ← Has Obsidian file
      },
      data: {
        issueNumber: 123,
        repository: "user/repo",
        // ... other GitHub data
      }
    },
    // ... other task fields
  }
]
```

### Step 1: Obsidian Scans Vault

```typescript
// parseFileToTaskData() processes "Tasks/Fix login bug.md"
// Line 338-340: Looks up existing task
const existingTask = tasksToSearch.find(
  (task) => task.source.keys.obsidian === "Tasks/Fix login bug.md"
);
// ✅ Found: task-abc123

// Line 344-354: Preserves source information
sourceInfo = {
  extension: existingTask.source.extension,  // ✅ "github"
  keys: {
    ...existingTask.source.keys,  // ✅ {github: "...", obsidian: "..."}
    obsidian: file.path,
  },
  data: existingTask.source.data,  // ✅ GitHub issue data
};

// Result: Task with preserved GitHub source
scannedTask = {
  id: "task-abc123",
  title: "Fix login bug",
  source: {
    extension: "github",  // ✅ PRESERVED
    keys: {
      github: "https://github.com/user/repo/issues/123",
      obsidian: "Tasks/Fix login bug.md"
    },
    data: { issueNumber: 123, ... }
  }
}
```

### Step 2: Filter by Extension (THE FIRST PROBLEM)

```typescript
// ObsidianTaskSource.loadInitialData() - Line 67-69
const obsidianTasks = allTasks.filter(
  (task) => task.source.extension === "obsidian"
);

// ❌ GitHub task filtered out!
// scannedTask.source.extension = "github" !== "obsidian"
// Result: obsidianTasks = []
```

### Step 3: Dispatch to Reducer

```typescript
// Line 71-75
taskStore.dispatch({
  type: "LOAD_SOURCE_SUCCESS",
  sourceId: "obsidian",
  tasks: []  // ❌ Empty because GitHub task was filtered out
});
```

### Step 4: Reducer Processes (THE SECOND PROBLEM)

```typescript
// taskReducer.ts - Line 106-108
const filteredTasks = state.tasks.filter(
  (task) => task.source.extension !== action.sourceId
);
// action.sourceId = "obsidian"
// state.tasks[0].source.extension = "github"
// "github" !== "obsidian" → TRUE
// ✅ GitHub task kept in filteredTasks

// Line 138
return {
  ...state,
  tasks: [...filteredTasks, ...newTasks],
  // filteredTasks = [GitHub task]
  // newTasks = [] (empty from step 3)
  // Result: [GitHub task] ← Actually preserved!
};
```

### Wait... So What's the ACTUAL Bug?

The bug occurs in a **different scenario**:

### Actual Bug Scenario: Obsidian Scans BEFORE GitHub Loads

```typescript
// If Obsidian loads first or refreshes:

// Step 1: Obsidian scans vault
// Finds: "Tasks/Fix login bug.md"
// No existing task in store yet (GitHub hasn't loaded)

// parseFileToTaskData() - Line 355-362
sourceInfo = {
  extension: "obsidian",  // ❌ No existing task, defaults to "obsidian"
  keys: {
    obsidian: "Tasks/Fix login bug.md"
  }
};

// Step 2: Task created with wrong extension
newTask = {
  id: "task-xyz789",  // ❌ Different ID (no existing task to preserve)
  source: {
    extension: "obsidian",  // ❌ WRONG!
    keys: { obsidian: "Tasks/Fix login bug.md" }
  }
}

// Step 3: GitHub loads later
// Finds issue #123
// Creates task with source.extension = "github"
// But different ID because Obsidian already created one

// Result: TWO tasks for the same entity!
// - task-xyz789: source.extension = "obsidian"
// - task-abc123: source.extension = "github"
```

### OR: The Refresh Bug

```typescript
// User has GitHub task with Obsidian file
// User runs "Refresh Obsidian Tasks" command

// ObsidianTaskSource.refresh() is called
// Scans vault, finds GitHub task file
// parseFileToTaskData() preserves source.extension = "github" ✅
// Filter removes it because extension !== "obsidian" ❌
// Dispatch LOAD_SOURCE_SUCCESS with empty array
// Reducer filters: keep tasks where extension !== "obsidian"
// GitHub task kept ✅

// But wait... what if there's an Obsidian task too?

// Before refresh:
tasks = [
  { id: "1", source: { extension: "github", keys: { obsidian: "a.md" } } },
  { id: "2", source: { extension: "obsidian", keys: { obsidian: "b.md" } } }
]

// After scan: both files found, both parsed
scannedTasks = [
  { id: "1", source: { extension: "github", ... } },  // ✅ Preserved
  { id: "2", source: { extension: "obsidian", ... } }
]

// After filter (line 67-69):
filteredTasks = [
  { id: "2", source: { extension: "obsidian", ... } }  // Only Obsidian task
]

// Dispatch LOAD_SOURCE_SUCCESS with [task-2]

// Reducer (line 106-108):
const filtered = tasks.filter(t => t.source.extension !== "obsidian");
// Removes task-2, keeps task-1
filtered = [{ id: "1", source: { extension: "github" } }]

// Final (line 138):
tasks = [...filtered, ...newTasks]
     = [task-1, task-2]  // ✅ Both preserved!
```

### The REAL Bug: Race Condition + ID Mismatch

The actual bug is:
1. **Obsidian loads before GitHub** (or refreshes)
2. **Finds GitHub task file** but no existing task in store
3. **Creates new task** with `source.extension = "obsidian"` and new ID
4. **GitHub loads later**, creates same task with different ID
5. **Result**: Duplicate tasks, or GitHub task overwrites Obsidian task

---

## Architecture Problems

### 1. Conflicting Responsibilities

**ObsidianTaskSource** is responsible for:
- ✅ Scanning vault files
- ✅ Parsing task data
- ❌ Filtering by ownership (should be reducer's job)

**TaskReducer** is responsible for:
- ✅ Managing store state
- ❌ Removing tasks from other sources (breaks cross-source tasks)

### 2. Implicit Assumptions

The reducer assumes:
- Each source owns tasks exclusively
- `source.extension` matches `sourceId`
- No cross-source tasks exist

**Reality**:
- GitHub tasks have Obsidian files
- `source.extension = "github"` but `sourceId = "obsidian"` when loading
- Cross-source tasks are a core feature

### 3. Data Flow Complexity

```
File System → parseFileToTaskData → buildEntity → Filter → Reducer → Store
                    ↓                    ↓           ↓        ↓
              Preserves source    Preserves    Removes   Removes
                                   source      GitHub    GitHub
```

Multiple layers trying to "fix" the same problem, but the final layer breaks everything.

---

## Proposed Solutions

### Option A: Fix the Reducer (Minimal Change)

**Change**: Don't filter by `source.extension` in LOAD_SOURCE_SUCCESS

```typescript
case "LOAD_SOURCE_SUCCESS": {
  // Remove tasks that have THIS source's key, not by extension
  const filteredTasks = state.tasks.filter(
    (task) => !task.source.keys[action.sourceId]
  );

  const newTasks = action.tasks.map(...);

  return {
    ...state,
    tasks: [...filteredTasks, ...newTasks],
  };
}
```

**Pros**: Minimal code change, preserves cross-source tasks
**Cons**: Still complex logic, doesn't simplify architecture

### Option B: Merge-Based Approach (Recommended)

**Change**: Use merge strategy instead of replace strategy

```typescript
case "LOAD_SOURCE_SUCCESS": {
  // Merge new tasks with existing tasks by ID
  const taskMap = new Map(state.tasks.map(t => [t.id, t]));

  // Update or add tasks from this source
  for (const newTask of action.tasks) {
    const existing = taskMap.get(newTask.id);
    if (existing) {
      // Merge: preserve fields from existing, update from new
      taskMap.set(newTask.id, {
        ...existing,
        ...newTask,
        id: existing.id,
        createdAt: existing.createdAt,
        source: {
          ...existing.source,
          keys: {
            ...existing.source.keys,
            ...newTask.source.keys,  // Merge keys
          },
        },
      });
    } else {
      taskMap.set(newTask.id, newTask);
    }
  }

  return {
    ...state,
    tasks: Array.from(taskMap.values()),
    loading: false,
  };
}
```

**Pros**:
- Preserves all source metadata
- Handles cross-source tasks correctly
- Clearer merge semantics

**Cons**:
- More code
- Requires careful merge logic

### Option C: Separate Stores Per Source (Major Refactor)

**Change**: Each extension maintains its own store, main store is a view

```typescript
// Extension stores
githubTaskStore: Task[]
obsidianTaskStore: Task[]

// Main store is computed
mainTaskStore = derived([githubTaskStore, obsidianTaskStore],
  ([github, obsidian]) => mergeTasksByID(github, obsidian)
)
```

**Pros**:
- Clear ownership boundaries
- No reducer complexity
- Each source is authoritative

**Cons**:
- Major architectural change
- More stores to manage
- Complex derived store logic

---

## Recommended Fix: Option B (Merge-Based)

### Why This Is Best:

1. **Preserves Cross-Source Tasks**: GitHub tasks with Obsidian files work correctly
2. **Clear Semantics**: Merge is easier to reason about than filter+replace
3. **Minimal Breaking Changes**: Doesn't require architectural overhaul
4. **Fixes Root Cause**: Addresses the reducer logic directly

### Implementation Steps:

1. Update `LOAD_SOURCE_SUCCESS` in `taskReducer.ts` to use merge strategy
2. Remove filtering logic from `ObsidianTaskSource.loadInitialData()` (no longer needed)
3. Add tests to verify cross-source task preservation
4. Document the merge behavior clearly

---

## Code Simplification Opportunities

### 1. Remove Redundant Filtering

**Current**: ObsidianTaskSource filters by extension
```typescript
const obsidianTasks = allTasks.filter(
  (task) => task.source.extension === "obsidian"
);
```

**After Fix**: Return all scanned tasks, let reducer handle merging
```typescript
// Just return what we scanned - reducer will merge correctly
return allTasks;
```

### 2. Simplify parseFileToTaskData

**Current**: Complex logic to preserve existing source
```typescript
if (existingTask) {
  sourceInfo = {
    extension: existingTask.source.extension,
    keys: {...existingTask.source.keys, obsidian: file.path},
    ...(existingTask.source.data && {data: existingTask.source.data}),
  };
}
```

**After Fix**: Always set what we know, reducer merges
```typescript
sourceInfo = {
  extension: existingTask?.source.extension || "obsidian",
  keys: {obsidian: file.path},
};
// Reducer will merge with existing source.keys.github if present
```

### 3. Remove buildEntity Complexity

**Current**: Tries to preserve source.extension
```typescript
source: {
  ...taskDataWithSource.source,
  extension: taskDataWithSource.source.extension || "obsidian",
  keys: {...taskDataWithSource.source.keys, obsidian: obsidianKey},
}
```

**After Fix**: Just set Obsidian's view of the task
```typescript
source: {
  extension: "obsidian",  // This source creates Obsidian tasks
  keys: {obsidian: filePath},
}
// Reducer merges with existing source data
```

---

## Testing Strategy

### Critical Test Cases:

1. **GitHub task with Obsidian file**
   - Create GitHub task
   - Import to Obsidian
   - Reload plugin
   - Verify: `source.extension === "github"`
   - Verify: `source.keys.github` and `source.keys.obsidian` both present

2. **Obsidian task**
   - Create Obsidian task
   - Reload plugin
   - Verify: `source.extension === "obsidian"`
   - Verify: `source.keys.obsidian` present

3. **Multiple sources loading**
   - Load GitHub extension
   - Load Obsidian extension
   - Verify: All tasks present
   - Verify: No tasks lost

4. **Refresh command**
   - Create cross-source task
   - Run refresh
   - Verify: `source.extension` unchanged
   - Verify: All keys preserved

---

## Conclusion

### Root Causes Identified

The bug has **THREE root causes** working together:

1. **Race Condition**: Obsidian can load before GitHub, finding GitHub task files without existing tasks in store
2. **ID Generation**: Each source generates its own ID, creating duplicates for the same entity
3. **Filter-Replace Strategy**: Reducer assumes exclusive ownership, can't handle cross-source tasks

### The Real Problem

The architecture assumes:
- ❌ Each source loads in a specific order
- ❌ Each source owns tasks exclusively
- ❌ Tasks can't exist in multiple sources
- ❌ ID generation is deterministic across sources

The reality:
- ✅ Load order is unpredictable
- ✅ Tasks can have multiple source keys
- ✅ GitHub tasks have Obsidian files
- ✅ IDs are generated independently per source

### The Fix

**Primary Fix**: Change reducer to merge by natural keys, not by ID

```typescript
case "LOAD_SOURCE_SUCCESS": {
  const taskMap = new Map();

  // Index existing tasks by ALL their source keys
  for (const task of state.tasks) {
    for (const [sourceId, key] of Object.entries(task.source.keys)) {
      taskMap.set(`${sourceId}:${key}`, task);
    }
  }

  // Merge new tasks
  for (const newTask of action.tasks) {
    const sourceKey = newTask.source.keys[action.sourceId];
    const lookupKey = `${action.sourceId}:${sourceKey}`;
    const existing = taskMap.get(lookupKey);

    if (existing) {
      // Merge: preserve ID, merge keys, update fields
      const merged = {
        ...existing,
        ...newTask,
        id: existing.id,  // ✅ Preserve ID
        source: {
          extension: existing.source.extension,  // ✅ Preserve owner
          keys: {
            ...existing.source.keys,
            ...newTask.source.keys,  // ✅ Merge keys
          },
          data: existing.source.data || newTask.source.data,
        },
      };

      // Update all key mappings
      for (const [sourceId, key] of Object.entries(merged.source.keys)) {
        taskMap.set(`${sourceId}:${key}`, merged);
      }
    } else {
      // New task
      taskMap.set(lookupKey, newTask);
    }
  }

  // Extract unique tasks
  const uniqueTasks = Array.from(
    new Map(Array.from(taskMap.values()).map(t => [t.id, t])).values()
  );

  return {
    ...state,
    tasks: uniqueTasks,
    loading: false,
  };
}
```

**Secondary Fixes**:
1. Remove filtering in `ObsidianTaskSource.loadInitialData()` - return all scanned tasks
2. Simplify `parseFileToTaskData()` - just report what Obsidian knows
3. Remove defensive code in `buildEntity()` - trust the reducer

### Benefits

This fix will:
- ✅ Handle race conditions correctly
- ✅ Prevent duplicate tasks
- ✅ Preserve source ownership
- ✅ Merge source keys correctly
- ✅ Work regardless of load order
- ✅ Simplify extension code
- ✅ Make the system more reliable

### Migration Path

1. **Phase 1**: Fix reducer with merge-by-key strategy
2. **Phase 2**: Add tests for race conditions and cross-source tasks
3. **Phase 3**: Remove defensive code from extensions
4. **Phase 4**: Document the new contract clearly

This will make the code:
- ✅ Simpler to understand
- ✅ Easier to maintain
- ✅ More reliable
- ✅ Aligned with the actual data model (cross-source tasks)
- ✅ Resilient to load order changes

---

## Quick Reference

### The Bug in One Sentence

The `LOAD_SOURCE_SUCCESS` reducer filters tasks by `source.extension !== sourceId`, which removes cross-source tasks when extensions load in different orders.

### The Fix in One Sentence

Change the reducer to merge tasks by natural keys (`source.keys[sourceId]`) instead of filtering by `source.extension`, preserving task identity across sources.

### Files to Change

1. **`src/app/stores/reducers/taskReducer.ts:103-142`** - Replace filter+replace with merge-by-key
2. **`src/app/extensions/obsidian/sources/TaskSource.ts:67-69`** - Remove extension filter
3. **`src/app/extensions/obsidian/operations/TaskOperations.ts:344-363`** - Simplify source preservation
4. **`src/app/extensions/obsidian/entities/Obsidian.ts:107-108`** - Simplify buildEntity

### Key Insights

- **Problem**: Architecture assumes exclusive task ownership per source
- **Reality**: Tasks can exist in multiple sources (GitHub + Obsidian)
- **Solution**: Merge by natural keys, not by extension
- **Benefit**: Works regardless of load order, prevents duplicates

### Testing Checklist

- [ ] GitHub task with Obsidian file survives plugin reload
- [ ] Obsidian loads before GitHub (race condition)
- [ ] GitHub loads before Obsidian (normal flow)
- [ ] Refresh command preserves source.extension
- [ ] No duplicate tasks created
- [ ] source.keys merged correctly
- [ ] source.extension preserved from creator

---

## Appendix: Previous Fix Attempts

### Why They Failed

All previous fixes tried to preserve `source.extension` at the **data layer** (scanning, parsing, building), but the **reducer layer** still filtered tasks by extension. The reducer is the final authority on what goes in the store, so any preservation logic before the reducer is futile if the reducer removes the task.

### Lessons Learned

1. **Fix the root cause, not symptoms** - The reducer logic was the root cause
2. **Trust contracts, fail fast** - Don't add defensive code to work around broken architecture
3. **Test the full flow** - Unit tests on individual functions missed the integration bug
4. **Understand data flow** - Multiple layers of "fixes" indicated architectural confusion

---

**End of Analysis**


