# Copilot Instructions for Obsidian Task Sync

## Project Overview

An Obsidian plugin for unified task management with external system integrations (GitHub, Apple Reminders, Apple Calendar). Built with **Svelte 5** on a Redux-like action dispatcher architecture with an extensible plugin system.

## Core Architecture

### Action Dispatcher Pattern (Redux-like)

**ALL state mutations** go through `store.dispatch(action)` → pure reducer → new state. Never mutate stores directly.

```typescript
// ✅ Correct
taskStore.dispatch({ type: "ADD_TASK", task: newTask });
taskStore.dispatch({ type: "UPDATE_TASK", id: taskId, updates: { done: true } });

// ❌ Wrong - no direct mutation methods exist
taskStore.addTask(newTask); // Does not exist
taskStore.tasks.push(newTask); // Never mutate directly
```

**Store locations:**
- `src/app/stores/` - Store definitions with dispatch interfaces
- `src/app/stores/actions.ts` - Action type definitions
- `src/app/stores/reducers/` - Pure reducer functions

### Query Service Pattern

Queries are **static methods**, NOT store methods. No store dependencies in query logic.

```typescript
// ✅ Correct - pure static functions
const filtered = TaskQueryService.filter(tasks, { showCompleted: false });
const sorted = TaskQueryService.sort(filtered, [{ key: "dueDate", direction: "asc" }]);

// ❌ Wrong - queries don't live on stores
taskStore.filter(...); // Does not exist
```

**Query service locations:** `src/app/services/*QueryService.ts`

### Extension System

Extensions provide pluggable integrations (Obsidian, GitHub, Apple Reminders). Each extension:
- Implements `Extension` interface from `src/app/core/extension.ts`
- Has its own namespace in `src/app/extensions/{extension-name}/`
- Provides entity operations through namespace classes (e.g., `Obsidian.TaskOperations`)
- Reacts to domain events via `onEntityCreated/Updated/Deleted`

**Extension structure:**
```
src/app/extensions/{name}/
├── {Name}Extension.ts        # Main extension class
├── entities/                  # Extension-specific entity builders
├── operations/                # Extension-specific operations
└── services/                  # Extension-specific services
```

### Host Abstraction

`Host` (in `src/app/core/host.ts`) abstracts the mounting environment (currently only Obsidian). Host provides:
- Settings persistence (`loadSettings`, `saveSettings`)
- Canonical data storage (`loadData`, `saveData`) - high-level entity objects with IDs/metadata
- Extension management (`load`, `onload`, `onunload`)

**Critical distinction:** Host storage ≠ Extension storage. Host stores canonical entities; extensions store their own representations (e.g., Obsidian stores tasks as markdown files, but that's not the source of truth).

### Entities & Operations

Entities use a namespace pattern with nested `Operations` and `Queries` classes:

```typescript
// Entity namespace structure
namespace Tasks {
  export class Operations extends EntitiesOperations {
    async create(data: Partial<Task>): Promise<Task> { ... }
    async update(id: string, updates: Partial<Task>): Promise<Task> { ... }
  }

  export class Queries extends EntitiesQueries {
    static filter(tasks: Task[], criteria: FilterCriteria): Task[] { ... }
  }
}
```

**Entity locations:**
- Core entities: `src/app/core/entities.ts`
- Entity namespaces: `src/app/entities/{Entity}.ts`
- Extension-specific: `src/app/extensions/{ext}/entities/{Ext}.ts`

### NoteKit - Type-Safe Note System

**NoteKit** (`src/app/core/note-kit/`) is a typed note management system with:
- `NoteType` definitions with Zod schema validation
- `TypeRegistry` for managing note types (shared across plugin and app via `plugin.typeNote`)
- `TypeCache` with persistence adapter for note type storage
- Template versioning and migration support

**Critical:** The plugin's `typeNote` instance is shared with `ObsidianExtension` to maintain a single registry. Extensions access it via constructor injection.

## Development Workflows

### Building & Running

```bash
npm run build           # Production build
npm test                # Unit tests (Vitest)
npm run test:e2e        # E2E tests (Playwright + Electron)
```

**Cross-platform development:** Run `./scripts/setup-dev.sh` when switching platforms (macOS/Linux) to reinstall platform-specific dependencies (especially esbuild).

### Testing

**Unit tests** (Vitest, jsdom):
- Location: `tests/unit/`, `tests/app/`
- Mocks: `tests/__mocks__/obsidian.ts`
- Config: `vitest.config.mjs`

**E2E tests** (Playwright with Electron):
- Location: `tests/e2e/specs/playwright/*.e2e.ts`
- Config: `playwright.config.ts`
- Setup: `tests/e2e/global-setup.ts` builds plugin and kills stale Electron processes
- **Linux requirement:** Uses `xvfb-maybe` for headless Electron (auto-configured in `package.json`)
- Each test creates isolated Electron instance with pristine vault copy

**Test vault:** `tests/vault/Test.pristine/` - pristine state, copied per test

### Accessing Plugin APIs in Tests

```typescript
// From main plugin instance
await plugin.operations.task.create({ title: "Test" });
const task = plugin.query.findTaskByTitle("Test");
const state = get(plugin.stores.taskStore);

// Extension-specific operations
const obsExt = plugin.host.getExtensionById("obsidian") as ObsidianExtension;
await obsExt.todoPromotionOperations.promoteTodoToTask();
```

## Project-Specific Conventions

### Svelte 5 Reactivity

Use Svelte 5's runes, **not** old store utilities:

```typescript
// ✅ Correct - Svelte 5 runes
let searchQuery = $state("");
const filteredTasks = $derived.by(() => {
  let result = $taskStore.tasks;
  if (searchQuery) result = TaskQueryService.search(result, searchQuery);
  return result;
});

// ❌ Wrong - don't use old svelte/store utilities
import { derived } from "svelte/store"; // Avoid this
```

### Fail-Fast Philosophy

**Trust contracts.** Fail immediately on invalid data instead of defensive fallbacks:

```typescript
// ✅ Correct - trust the data or throw
const project = projects.find(p => p.id === task.projectId);
if (!project) throw new Error(`Project not found: ${task.projectId}`);

// ❌ Wrong - don't mask data issues with fallbacks
const project = projects.find(p => p.id === task.projectId) ||
                projects.find(p => p.name === task.projectName) ||
                { name: "Default Project" };
```

Only use try-catch at **UI/API boundaries** where graceful degradation makes sense.

### Source Keys Pattern

Entities have `source.keys` mapping extension IDs to their identifiers:

```typescript
task.source = {
  extension: "obsidian",
  keys: {
    obsidian: "Tasks/My Task.md",    // File path
    github: "https://github.com/...", // Issue URL
  },
  data: { /* extension-specific metadata */ }
};
```

Use `plugin.query.findTaskBySourceKey("github", url)` to find entities by source.

### Event-Driven Side Effects

Domain events (`src/app/core/events.ts`) decouple operations from reactions:

```typescript
// Operations emit events
class TaskOperations {
  async create(data: Partial<Task>): Promise<Task> {
    const task = buildTask(data);
    taskStore.dispatch({ type: "ADD_TASK", task });
    eventBus.emit({ type: "TASK_CREATED", payload: task });
    return task;
  }
}

// Extensions react to events
async onEntityCreated(event: DomainEvent): Promise<void> {
  if (event.type === "TASK_CREATED") {
    await this.createNoteForTask(event.payload);
  }
}
```

## Key Files for Understanding

- `src/main.ts` - Plugin entry point, bootstraps Svelte app with Host
- `src/app/App.ts` - Main application class, initializes extensions
- `src/app/core/extension.ts` - Extension system interfaces
- `src/app/core/host.ts` - Host abstraction layer
- `docs/architecture.md` - Comprehensive architectural patterns documentation
- `docs/type-note.md` - NoteKit implementation plan and design

## Common Pitfalls

1. **Don't bypass the dispatcher:** All state changes must go through `dispatch(action)`
2. **Don't add queries to stores:** Use static `QueryService` methods instead
3. **Don't confuse Host storage with Extension storage:** Host = canonical entities with IDs/metadata; Extensions = their own representations
4. **Don't use defensive fallback chains:** Fail fast when data doesn't match contracts
5. **Don't create isolated Obsidian API instances:** Reuse plugin.app, plugin.vault from constructor injection
6. **Don't mutate note types directly:** Always go through the shared `plugin.typeNote` registry

## Migration Notes

This codebase is actively migrating from old patterns. See `old-stuff/` for legacy code being replaced. When in doubt, follow patterns in `src/app/` over `old-stuff/`.
