# Option B Execution Plan - Merge-Based Reducer Fix

> **Based on**: PLUGIN_LOADING_ANALYSIS.md
> **Strategy**: Test-Driven Development - Reproduce bugs FIRST, then fix
> **Branch**: fix-task-loading

## Executive Summary

This plan implements **Option B (Merge-Based Approach)** from the analysis document. We will:

1. **Reproduce all 3 bugs** in e2e tests (following TDD workflow)
2. **Fix the root cause** in the LOAD_SOURCE_SUCCESS reducer
3. **Simplify extension code** by removing defensive workarounds
4. **Verify all tests pass** to ensure no regressions

## Critical Rules to Follow

🚨 **MANDATORY TDD WORKFLOW**:
- Write failing e2e test FIRST
- Verify test fails on ASSERTION (not imports)
- Commit with "WIP - " prefix
- Implement fix
- Verify test passes
- Commit without "WIP - "
- Squash commits
- Mark task complete

🚨 **NO DEFENSIVE CODE**:
- No fallback chains: `data.foo || data.fooValue || 'default'`
- No excessive try-catch blocks
- Trust contracts, fail fast

🚨 **E2E TESTING IN DOCKER**:
- DO NOT use `npx playwright show-trace` or UI tools
- Analyze artifacts in `tests/e2e/debug/`
- Use screenshots, logs, and programmatic trace analysis

## The Three Bugs to Reproduce

### Bug #1: Race Condition - Obsidian Loads Before GitHub
**Scenario**: When Obsidian extension loads before GitHub extension
**Problem**: Obsidian finds GitHub task file but no existing task in store
**Result**: Creates new task with `source.extension = "obsidian"` and different ID
**Impact**: Duplicate tasks when GitHub loads later

### Bug #2: Filter Removes Cross-Source Tasks on Refresh
**Location**: `TaskSource.ts:67-69`
**Problem**: `allTasks.filter(task => task.source.extension === "obsidian")`
**Result**: GitHub tasks filtered out before dispatch
**Impact**: GitHub tasks disappear from store on Obsidian refresh

### Bug #3: Reducer Removes Tasks by Extension Mismatch
**Location**: `taskReducer.ts:106-108`
**Problem**: `state.tasks.filter(task => task.source.extension !== action.sourceId)`
**Result**: Removes cross-source tasks
**Impact**: GitHub tasks lost when Obsidian loads

## Phase 1: Reproduce Bugs in E2E Tests

### Task 1: Reproduce Bug #1 - Race Condition
**Test File**: Create new test in existing e2e test file or new file
**Test Scenario**:
1. Create GitHub task file manually (simulate GitHub import)
2. Clear task store
3. Load Obsidian extension ONLY (GitHub not loaded)
4. Verify: Task created with `source.extension = "obsidian"` (WRONG)
5. Load GitHub extension
6. Verify: Two tasks exist with same file path but different IDs (BUG)

**Expected Failure**: Assertion fails showing duplicate tasks

### Task 2: Reproduce Bug #2 - Filter on Refresh
**Test File**: Extend existing refresh test or create new
**Test Scenario**:
1. Create GitHub task with Obsidian file (proper cross-source task)
2. Verify: Task has `source.extension = "github"` and both keys
3. Execute refresh Obsidian tasks command
4. Verify: Task still exists with `source.extension = "github"` (should FAIL)

**Expected Failure**: Task disappears or extension changes to "obsidian"

### Task 3: Reproduce Bug #3 - Reducer Extension Filter
**Test File**: Unit test for reducer or e2e integration test
**Test Scenario**:
1. Set up store with GitHub task (source.extension = "github")
2. Dispatch LOAD_SOURCE_SUCCESS with sourceId = "obsidian", tasks = []
3. Verify: GitHub task still in store (should FAIL with current code)

**Expected Failure**: GitHub task removed from store

## Phase 2: Implement Fixes

### Fix 1: Change Reducer to Merge-By-Key Strategy
**File**: `src/app/stores/reducers/taskReducer.ts:103-142`
**Implementation**: See PLUGIN_LOADING_ANALYSIS.md lines 752-806
**Key Changes**:
- Index tasks by source keys: `${sourceId}:${key}`
- Merge tasks with matching keys
- Preserve ID from existing task
- Preserve source.extension from existing task
- Merge source.keys from both tasks
- Handle new tasks without existing match

### Fix 2: Remove Filter in ObsidianTaskSource
**File**: `src/app/extensions/obsidian/sources/TaskSource.ts:67-69`
**Change**: Remove filter, return all scanned tasks
```typescript
// BEFORE:
const obsidianTasks = allTasks.filter(
  (task) => task.source.extension === "obsidian"
);
return obsidianTasks;

// AFTER:
return allTasks; // Let reducer handle merging
```

### Fix 3: Simplify parseFileToTaskData
**File**: `src/app/extensions/obsidian/operations/TaskOperations.ts:344-363`
**Change**: Just report Obsidian's view, trust reducer to merge
```typescript
// Simplified - just set what Obsidian knows
sourceInfo = {
  extension: existingTask?.source.extension || "obsidian",
  keys: { obsidian: file.path },
};
```

### Fix 4: Simplify buildEntity
**File**: `src/app/extensions/obsidian/entities/Obsidian.ts:107-108`
**Change**: Remove defensive preservation logic
```typescript
// Simplified - trust reducer
source: {
  extension: "obsidian",
  keys: { obsidian: filePath },
}
```

## Phase 3: Verification

### Task: Run All E2E Tests
**Command**: `npm run test:e2e`
**Expected**: All tests pass, including 3 new bug reproduction tests

### Task: Run Full Test Suite
**Command**: `npm test`
**Expected**: All tests pass, no regressions

## Success Criteria

✅ All 3 bug reproduction tests fail initially (on assertions)
✅ All 3 bug reproduction tests pass after fixes
✅ All existing e2e tests still pass
✅ All unit tests still pass
✅ No defensive code patterns introduced
✅ Code is simpler after fixes (less complexity)

## Files to Modify

1. `src/app/stores/reducers/taskReducer.ts` - Main fix (merge-by-key)
2. `src/app/extensions/obsidian/sources/TaskSource.ts` - Remove filter
3. `src/app/extensions/obsidian/operations/TaskOperations.ts` - Simplify
4. `src/app/extensions/obsidian/entities/Obsidian.ts` - Simplify
5. New e2e test file(s) - Bug reproduction tests

## Commit Strategy

Each task follows:
1. WIP commit with failing test
2. Implementation commit
3. Squash into single commit
4. Clear commit message explaining what was fixed

Final commits should be:
- "Fix race condition in task loading - merge by source keys"
- "Remove defensive filtering in ObsidianTaskSource"
- "Simplify source preservation logic in task operations"
- "Simplify buildEntity source handling"

## Additional Resources

- **PLUGIN_LOADING_ANALYSIS.md** - Complete analysis of the bugs
- **MERGE_BY_KEY_IMPLEMENTATION.md** - Detailed technical specification
- **Task List** - 9 tasks created in task management system

## Next Steps

1. Review this plan and the implementation specification
2. Start with Phase 1, Task 1 - Reproduce Bug #1
3. Follow TDD workflow strictly for each task
4. Mark tasks complete only after squashing commits
5. Verify all tests pass before considering work complete

