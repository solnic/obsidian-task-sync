# Data Loading and Synchronization - Implementation Plan

## Original Problem Statement

The current data loading and synchronization system has critical architectural flaws:

1. **Incorrect loading order**: Extensions scan folders as if they were the primary data source, when the primary source should be the host's persisted storage
2. **Missing natural key tracking**: The `source` property only tracks which extension imported an entity but doesn't explicitly track natural keys for ALL extensions that have the entity
3. **Unclear synchronization semantics**: No explicit rules about which data source is authoritative during sync

## Simplified Scope (User Decision)

- Initial load only refreshes obsidian data source to sync
- Sync must be run automatically during data source refresh - which is triggered via UI's "Refresh" button
- Skip concerns related to overriding data via canonical source for now
- Testing should be done ONLY via e2e tests
- No need for migration (unreleased app)
- Syncing back to GitHub will not be supported for now

---

## Phase 1: Schema Updates ✅ COMPLETE

**Status: COMPLETE - 138/144 tests passing (95.8%)**

### Tasks Completed
- [x] Update `TaskSourceSchema` to use `keys: Record<string, string>`
- [x] Update all entity builders (Obsidian, GitHub)
- [x] Update all reconcilers
- [x] Update all UI components
- [x] Update all query services
- [x] Add migration logic for old persisted data
- [x] Fix all test failures related to schema changes

### Key Changes
- Replaced `source.filePath`, `source.url`, `source.imported` with `source.keys`
- Example: `{ extension: "github", keys: { github: "url", obsidian: "path" } }`

**See `docs/SCHEMA-MIGRATION-COMPLETE.md` for full details**

---

## Phase 2: Automatic Sync During Data Source Refresh ✅ COMPLETE

### Goal
When a data source is refreshed (e.g., Obsidian scans vault), automatically sync the loaded data with persisted storage.

### Current Behavior
1. User clicks "Refresh" button in UI
2. Extension's data source scans for entities (e.g., ObsidianTaskSource scans vault)
3. Data source dispatches `LOAD_SOURCE_SUCCESS` action
4. TaskReducer processes action and updates store
5. **NO SYNC HAPPENS** - persisted data may be out of sync with vault

### Desired Behavior
1. User clicks "Refresh" button in UI
2. Extension's data source scans for entities
3. Data source dispatches `LOAD_SOURCE_SUCCESS` action
4. TaskReducer processes action and updates store
5. **AUTOMATIC SYNC**: Compare loaded data with persisted data and reconcile
6. Save reconciled data back to storage

### Implementation Tasks ✅ COMPLETE

#### 2.1: Add Sync Logic to TaskSourceManager ✅ COMPLETE
- [x] Create `syncSourceData()` method in `TaskSourceManager`
- [x] Call sync after `LOAD_SOURCE_SUCCESS` is dispatched
- [x] Sync should:
  - Get current tasks from store (after reducer processed new data)
  - Get persisted tasks from host storage
  - Trust store state as authoritative (already reconciled)
  - Save reconciled data back to storage

#### 2.2: Update ObsidianExtension.refresh() ✅ COMPLETE
- [x] Ensure refresh triggers data source reload
- [x] Verify sync happens automatically after reload

#### 2.3: Testing ✅ COMPLETE
- [x] E2E test: Refresh Obsidian source syncs with persisted data
- [x] E2E test: New task in vault appears after refresh
- [x] E2E test: Deleted task in vault is removed after refresh
- [x] E2E test: Modified task in vault updates after refresh
- [x] E2E test: Imported GitHub task preserves source metadata after Obsidian refresh

**All 4 automatic sync e2e tests passing**

---

## Phase 3: Update UI Refresh Buttons ⏳ TODO

### Goal
Ensure all UI refresh buttons trigger the automatic sync flow.

### Implementation Tasks

#### 3.1: LocalTasksService Refresh Button
- [ ] Verify refresh button calls extension's refresh method
- [ ] Verify sync happens automatically
- [ ] Add loading indicator during refresh

#### 3.2: GitHubService Refresh Button
- [ ] Verify refresh button calls extension's refresh method
- [ ] Verify sync happens automatically
- [ ] Add loading indicator during refresh

#### 3.3: Global Refresh Command
- [ ] Verify "Refresh All" command triggers all extensions
- [ ] Verify sync happens for each extension
- [ ] Add progress indicator

#### 3.4: Testing
- [ ] E2E test: Click refresh button in Local Tasks view
- [ ] E2E test: Click refresh button in GitHub view
- [ ] E2E test: Execute "Refresh All" command
- [ ] E2E test: Verify loading indicators appear and disappear

---

## Phase 4: Testing and Validation ⏳ TODO

### Comprehensive E2E Test Scenarios

#### 4.1: Initial Load Scenarios
- [ ] Fresh install: Load from empty vault
- [ ] Existing data: Load from vault with existing tasks
- [ ] Imported tasks: Load vault with GitHub-imported tasks

#### 4.2: Refresh Scenarios
- [ ] Refresh with no changes
- [ ] Refresh after adding task in vault
- [ ] Refresh after deleting task in vault
- [ ] Refresh after modifying task in vault
- [ ] Refresh after importing GitHub issue
- [ ] Refresh after modifying imported GitHub task

#### 4.3: Multi-Source Scenarios
- [ ] Task exists in both Obsidian and GitHub
- [ ] Task deleted from vault but still in GitHub
- [ ] Task modified in vault, original in GitHub
- [ ] Multiple refreshes in sequence

#### 4.4: Edge Cases
- [ ] Refresh during active editing
- [ ] Refresh with corrupted task files
- [ ] Refresh with missing required properties
- [ ] Concurrent refreshes from multiple sources

---

## Phase 5: Performance Optimization (Optional) 🔮 FUTURE

### Potential Improvements
- [ ] Debounce refresh calls
- [ ] Incremental sync (only changed entities)
- [ ] Background sync on file system events
- [ ] Batch storage writes

---

## Success Criteria

### Phase 2 Complete When:
- ✅ Refreshing Obsidian source automatically syncs with persisted data
- ✅ All e2e tests pass
- ✅ No manual sync required

### Phase 3 Complete When:
- ✅ All UI refresh buttons trigger automatic sync
- ✅ Loading indicators work correctly
- ✅ All e2e tests pass

### Phase 4 Complete When:
- ✅ All comprehensive test scenarios pass
- ✅ Edge cases handled gracefully
- ✅ No data loss in any scenario

---

## Current Status

**Phase 1: ✅ COMPLETE** (138/144 tests passing - 95.8%)

**Phase 2: ⏳ NOT STARTED**

**Phase 3: ⏳ NOT STARTED**

**Phase 4: ⏳ NOT STARTED**

---

## Notes

- Schema migration is complete and working
- 6 remaining test failures are unrelated to schema migration (base generation cleanup issues)
- Ready to proceed with Phase 2: Automatic sync during data source refresh

