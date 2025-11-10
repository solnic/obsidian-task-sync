# Merge-By-Key Implementation Specification

> **Purpose**: Detailed technical specification for implementing the merge-by-key strategy in LOAD_SOURCE_SUCCESS reducer

## Current Buggy Implementation

```typescript
case "LOAD_SOURCE_SUCCESS": {
  // ❌ BUG: Removes tasks where source.extension !== sourceId
  const filteredTasks = state.tasks.filter(
    (task) => task.source.extension !== action.sourceId
  );

  const newTasks = action.tasks.map((newTask) => {
    const existingTask = state.tasks.find((t) => t.id === newTask.id);
    if (existingTask) {
      return {
        ...newTask,
        id: existingTask.id,
        createdAt: existingTask.createdAt,
        updatedAt: isMeaningfullyDifferent(existingTask, newTask) 
          ? new Date() 
          : existingTask.updatedAt,
      };
    }
    return newTask;
  });

  return {
    ...state,
    tasks: [...filteredTasks, ...newTasks],
    loading: false,
  };
}
```

**Problems**:
1. Filters by `source.extension !== sourceId` - removes cross-source tasks
2. Merges by ID only - doesn't handle tasks with different IDs but same source key
3. Doesn't merge source.keys from existing and new tasks

## New Merge-By-Key Implementation

### Algorithm Overview

1. **Index existing tasks** by all their source keys
2. **For each new task**, look up by source key
3. **If match found**: Merge, preserving ID and source.extension
4. **If no match**: Add as new task
5. **Extract unique tasks** by ID to avoid duplicates

### Detailed Implementation

```typescript
case "LOAD_SOURCE_SUCCESS": {
  const taskMap = new Map<string, Task>();

  // Step 1: Index existing tasks by ALL their source keys
  for (const task of state.tasks) {
    if (task.source.keys) {
      for (const [sourceId, key] of Object.entries(task.source.keys)) {
        if (key) {
          taskMap.set(`${sourceId}:${key}`, task);
        }
      }
    }
  }

  // Step 2: Process new tasks from this source
  for (const newTask of action.tasks) {
    const sourceKey = newTask.source.keys?.[action.sourceId];
    
    if (!sourceKey) {
      console.warn(`Task ${newTask.id} missing source key for ${action.sourceId}`);
      continue;
    }

    const lookupKey = `${action.sourceId}:${sourceKey}`;
    const existing = taskMap.get(lookupKey);

    if (existing) {
      // Step 3: Merge with existing task
      const merged: Task = {
        ...existing,           // Start with existing task
        ...newTask,            // Override with new data
        id: existing.id,       // ✅ Preserve ID
        createdAt: existing.createdAt,  // ✅ Preserve creation time
        source: {
          extension: existing.source.extension,  // ✅ Preserve owner
          keys: {
            ...existing.source.keys,  // ✅ Keep existing keys
            ...newTask.source.keys,   // ✅ Merge new keys
          },
          data: newTask.source.data || existing.source.data,  // Prefer new data
        },
      };

      // Check if meaningfully different for updatedAt
      const changed = isMeaningfullyDifferent(existing, merged);
      merged.updatedAt = changed ? new Date() : existing.updatedAt;

      // Update all key mappings to point to merged task
      for (const [sid, key] of Object.entries(merged.source.keys)) {
        if (key) {
          taskMap.set(`${sid}:${key}`, merged);
        }
      }
    } else {
      // Step 4: New task - add to map
      taskMap.set(lookupKey, newTask);
    }
  }

  // Step 5: Extract unique tasks by ID
  const uniqueTasks = Array.from(
    new Map(
      Array.from(taskMap.values()).map(t => [t.id, t])
    ).values()
  );

  return {
    ...state,
    tasks: uniqueTasks,
    loading: false,
    lastSync: new Map(state.lastSync).set(action.sourceId, new Date()),
  };
}
```

## Key Behaviors

### Scenario 1: GitHub Task with Obsidian File

**Initial State**:
```typescript
tasks = [{
  id: "task-1",
  source: {
    extension: "github",
    keys: { github: "https://...", obsidian: "Tasks/foo.md" }
  }
}]
```

**Obsidian Refresh Dispatches**:
```typescript
LOAD_SOURCE_SUCCESS {
  sourceId: "obsidian",
  tasks: [{
    id: "task-2",  // Different ID!
    source: {
      extension: "obsidian",
      keys: { obsidian: "Tasks/foo.md" }
    }
  }]
}
```

**Result After Merge**:
```typescript
tasks = [{
  id: "task-1",  // ✅ Preserved from existing
  source: {
    extension: "github",  // ✅ Preserved from existing
    keys: { 
      github: "https://...",  // ✅ Preserved
      obsidian: "Tasks/foo.md"  // ✅ Updated
    }
  }
}]
```

### Scenario 2: New Obsidian Task

**Initial State**: Empty store

**Obsidian Load Dispatches**:
```typescript
LOAD_SOURCE_SUCCESS {
  sourceId: "obsidian",
  tasks: [{
    id: "task-1",
    source: {
      extension: "obsidian",
      keys: { obsidian: "Tasks/new.md" }
    }
  }]
}
```

**Result**: Task added as-is (no existing match)

### Scenario 3: Race Condition - Obsidian Before GitHub

**Step 1 - Obsidian loads first**:
```typescript
// Finds GitHub task file, no existing task
LOAD_SOURCE_SUCCESS {
  sourceId: "obsidian",
  tasks: [{
    id: "obs-1",
    source: {
      extension: "obsidian",
      keys: { obsidian: "Tasks/github-task.md" }
    }
  }]
}
// Result: Task created with extension="obsidian"
```

**Step 2 - GitHub loads**:
```typescript
LOAD_SOURCE_SUCCESS {
  sourceId: "github",
  tasks: [{
    id: "gh-1",
    source: {
      extension: "github",
      keys: { 
        github: "https://...",
        obsidian: "Tasks/github-task.md"  // Same file!
      }
    }
  }]
}
```

**Result After Merge**:
```typescript
// Lookup by "obsidian:Tasks/github-task.md" finds obs-1
// Merge preserves obs-1's ID but GitHub's data wins
tasks = [{
  id: "obs-1",  // ✅ Preserved (first task created)
  source: {
    extension: "obsidian",  // ⚠️ Preserved from first
    keys: {
      obsidian: "Tasks/github-task.md",
      github: "https://..."  // ✅ Merged from GitHub
    }
  }
}]
```

**Note**: This still has an issue - extension should be "github" but is "obsidian". 
**Solution**: Need to handle "ownership transfer" when GitHub provides more authoritative data.

## Edge Cases to Handle

### Edge Case 1: Task Deleted from Source
If a task is deleted from GitHub but file still exists in Obsidian:
- GitHub refresh won't include the task
- Obsidian refresh will find the file
- Task remains in store with Obsidian ownership
- ✅ This is correct behavior

### Edge Case 2: Multiple Sources Update Same Task
If both GitHub and Obsidian update the same task:
- Last source to refresh wins for task data
- All source keys are preserved
- ✅ This is correct behavior

### Edge Case 3: Source Key Changes
If a file is renamed in Obsidian:
- Old key: "Tasks/old.md"
- New key: "Tasks/new.md"
- Lookup by new key fails
- Creates new task (duplicate)
- ⚠️ This is a known limitation - file renames create duplicates

## Testing Strategy

### Unit Tests for Reducer

1. Test merge with matching source key
2. Test new task without match
3. Test preserving ID and extension
4. Test merging source.keys
5. Test updatedAt preservation
6. Test unique task extraction

### E2E Tests

1. Test race condition (Obsidian before GitHub)
2. Test refresh preserves cross-source tasks
3. Test multiple sources loading
4. Test task updates from different sources

## Migration Notes

- No data migration needed
- Existing tasks will work correctly
- Behavior change is transparent to users
- May fix existing duplicate task issues

