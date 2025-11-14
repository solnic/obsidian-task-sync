# Lint TODO

**Total Issues:** 539 (61 errors, 478 warnings)

## DONE - Phase 1: Critical Errors - Promises & Async (Priority: HIGH)

**Issue:** `@typescript-eslint/no-floating-promises` - Promises must be handled
**Count:** 28 errors
**Impact:** These can cause unhandled rejections and runtime errors

### Files to fix:
- `src/app/components/settings/SettingsTab.ts` (line 43)
- `src/app/core/filters/FilterManager.ts` (lines 84, 129, 144)
- `src/app/core/note-kit/file-watcher.ts` (lines 125, 133, 141, 149)
- `src/app/extensions/github/GitHubExtension.ts` (line 438)
- `src/app/extensions/obsidian/ObsidianExtension.ts` (lines 786, 788, 792, 807, 809)
- `src/app/hosts/ObsidianHost.ts` (none - has @typescript-eslint/no-misused-promises)
- `src/app/modals/AreaCreateModal.ts` (line 53)
- `src/app/modals/CreateEntityModal.ts` (line 109)
- `src/app/modals/ProjectCreateModal.ts` (line 55)
- `src/app/utils/oauth/GoogleOAuthService.ts` (line 387)
- `src/app/views/DailyPlanningView.ts` (line 80)
- `src/app/views/DayView.ts` (lines 55, 65)
- `src/app/views/TasksView.ts` (line 89)
- `src/main.ts` (lines 203, 211, 252, 286, 598, 666, 770, 869)

**Fix:** Add `await`, `.catch()`, `.then()`, or mark with `void` operator

---

## DONE - Phase 2: Critical Errors - Promise Misuse (Priority: HIGH)

**Issue:** `@typescript-eslint/no-misused-promises` - Promises in wrong contexts
**Count:** 15 errors (ALL FIXED ✅)
**Impact:** Can cause unexpected behavior with conditionals and callbacks

### Files fixed:
- ✅ `src/app/core/note-kit/file-watcher.ts` (line 332) - Promise in function arg expecting void
- ✅ `src/app/extensions/apple-reminders/AppleRemindersExtension.ts` (line 401) - Promise in conditional
- ✅ `src/app/extensions/calendar/services/AppleCalendarService.ts` (line 589) - Promise in conditional
- ✅ `src/app/extensions/calendar/services/GoogleCalendarService.ts` (lines 234, 425) - Promises in conditionals
- ✅ `src/app/extensions/daily-planning/DailyPlanningExtension.ts` (lines 747, 748, 749) - Promises in function args
- ✅ `src/app/hosts/ObsidianHost.ts` (lines 252, 287-300) - Multiple promises in function args expecting void
- ✅ `src/app/utils/oauth/GoogleOAuthService.ts` (line 147) - Promise in conditional
- ✅ `src/app/views/TasksView.ts` (line 112) - Promise-returning method where void expected
- ✅ `src/main.ts` (line 488) - Promise-returning method where void expected
- ✅ `src/vendor/obsidian.d.ts` (line 3420) - Excluded from linting via eslint config

**Fix Applied:** 
- Used explicit `!== null` or `!== undefined` checks instead of truthy checks for promises in conditionals
- Wrapped async functions with `void` operator when used as event handlers expecting void returns
- Added `src/vendor/**` to eslint ignore patterns

---

## Phase 3: High Priority Errors - Code Quality (Priority: MEDIUM-HIGH)

### 3a. TypeScript Comment Abuse
**Issue:** `@typescript-eslint/ban-ts-comment` - Using `@ts-ignore` instead of `@ts-expect-error`
**Count:** 1 error
**Files:**
- `src/app/cache/SchemaCache.ts` (line 2)

**Fix:** Replace `@ts-ignore` with `@ts-expect-error` or fix the underlying issue

### 3b. Unsafe Declaration Merging
**Issue:** `@typescript-eslint/no-unsafe-declaration-merging`
**Count:** 1 error
**Files:**
- `src/app/core/extension.ts` (line 102)

**Fix:** Separate class and interface declarations

### 3c. Namespace Usage
**Issue:** `@typescript-eslint/no-namespace` - ES2015 modules preferred
**Count:** 5 errors
**Files:**
- `src/app/entities/Schedules.ts` (line 14)
- `src/app/extensions/calendar/entities/Calendar.ts` (line 18)
- `src/app/extensions/github/entities/GitHub.ts` (line 21)
- `src/app/extensions/obsidian/entities/Obsidian.ts` (line 63)

**Fix:** Convert namespaces to ES2015 modules

### 3d. Empty Object Types
**Issue:** `@typescript-eslint/no-empty-object-type`
**Count:** 1 error
**Files:**
- `src/app/extensions/obsidian/ObsidianExtension.ts` (line 161)

**Fix:** Remove empty interface or extend with members

---

## Phase 4: Code Cleanup - Unused Variables (Priority: MEDIUM)

**Issue:** `@typescript-eslint/no-unused-vars` - Defined but never used
**Count:** 34 warnings
**Impact:** Dead code, reduced maintainability

### Categories:
- **Unused imports:** ~15 instances
- **Unused function parameters:** ~10 instances
- **Unused variables:** ~9 instances

### High-impact files:
- `src/app/core/note-kit/backup-manager.ts` (5 unused vars)
- `src/app/core/note-kit/bulk-operations.ts` (5 unused vars)
- `src/app/core/note-kit/file-manager.ts` (6 unused vars)
- `src/app/core/note-kit/note-processor.ts` (4 unused vars)
- `src/app/core/note-kit/property-processor.ts` (1 unused var)
- `src/main.ts` (2 unused vars)

**Fix:** Remove unused code or prefix with `_` if intentionally unused

---

## Phase 5: Type Safety - Explicit Any (Priority: LOW-MEDIUM)

**Issue:** `@typescript-eslint/no-explicit-any` - Using `any` type
**Count:** 478 warnings
**Impact:** Reduces type safety, increases risk of runtime errors

### Files with most violations (top 20):
1. `src/app/core/note-kit/template-engine.ts` - 15 instances
2. `src/app/core/note-kit/property-processor.ts` - 15 instances
3. `src/app/core/note-kit/types.ts` - 15 instances
4. `src/app/extensions/apple-reminders/AppleRemindersExtension.ts` - 27 instances
5. `src/app/extensions/obsidian/ObsidianExtension.ts` - 8 instances
6. `src/app/extensions/obsidian/entities/Obsidian.ts` - 6 instances
7. `src/app/extensions/github/GitHubExtension.ts` - 14 instances
8. `src/app/extensions/calendar/services/GoogleCalendarService.ts` - 8 instances
9. `src/app/extensions/calendar/services/AppleCalendarService.ts` - 9 instances
10. `src/app/extensions/daily-planning/DailyPlanningExtension.ts` - 6 instances
11. `src/app/components/settings/svelte/TypeNoteSettings.svelte` - 13 instances
12. `src/app/components/context/TaskContext.svelte` - 7 instances
13. `src/app/components/ServiceView.svelte` - 8 instances
14. `src/app/components/LocalTasksService.svelte` - 5 instances
15. `src/app/components/filters/GitHubFilters.svelte` - 7 instances
16. `src/app/App.ts` - 9 instances
17. `src/app/hosts/ObsidianHost.ts` - 7 instances
18. `src/main.ts` - 6 instances
19. `src/app/core/note-kit/front-matter-processor.ts` - 9 instances
20. `src/app/core/note-kit/note-processor.ts` - 12 instances

**Fix Strategy:**
1. Start with type definitions in `types.ts` files
2. Fix entity classes and their methods
3. Fix Svelte components
4. Fix service layers
5. Add proper type guards and interfaces

---

## Summary by Priority

| Phase | Type | Count | Estimated Effort |
|-------|------|-------|------------------|
| 1 | Promise floating | 28 errors | 4-6 hours |
| 2 | Promise misuse | 15 errors | 6-8 hours |
| 3 | Code quality | 8 errors | 2-3 hours |
| 4 | Unused code | 34 warnings | 2-3 hours |
| 5 | Explicit any | 478 warnings | 20-30 hours |
| **Total** | | **563** | **34-50 hours** |

---

## Recommended Approach

### Sprint 1 (Critical - Must Fix)
- ✅ Phase 1: Fix all floating promises
- ✅ Phase 2: Fix promise misuse

### Sprint 2 (Important - Should Fix)
- ✅ Phase 3: Fix code quality errors
- ✅ Phase 4: Clean up unused code

### Sprint 3+ (Nice to Have - Incremental)
- ⏳ Phase 5: Gradually replace `any` types
  - Start with core types and work outward
  - Do 10-20 files per sprint
  - Focus on high-impact areas first (entities, services)

---

## Notes

1. **Phase 5 is large** - Consider doing this incrementally over multiple sprints
2. **Some `any` types may be intentional** - especially for Obsidian API integration
3. **Test after each phase** - Run e2e tests to ensure no breakage
4. **Consider adding eslint rules** to gradually enforce stricter typing
5. **Document exceptions** - If keeping `any`, add `// eslint-disable-next-line` with reason
