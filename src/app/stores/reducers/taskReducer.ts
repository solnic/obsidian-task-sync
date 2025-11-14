/**
 * Task store reducer
 *
 * Handles all task state mutations through a pure reducer function.
 * All state changes go through this reducer, providing a single source of truth.
 */

import type { Task } from "../../core/entities";
import type { TaskAction } from "../actions";

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;

  // Dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Objects
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    // Ensure key sets are equal regardless of order
    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

function isMeaningfullyDifferent(a: Task, b: Task): boolean {
  // Compare all keys except timestamps
  const excluded = new Set(["createdAt", "updatedAt"]);
  const aKeys = Object.keys(a).filter((k) => !excluded.has(k));
  const bKeys = Object.keys(b).filter((k) => !excluded.has(k));
  if (aKeys.length !== bKeys.length) return true;
  for (const key of aKeys) {
    if (!deepEqual((a as any)[key], (b as any)[key])) return true;
  }
  return false;
}

/**
 * Task store state interface
 */
export interface TaskStoreState {
  /** All tasks from all sources */
  tasks: readonly Task[];

  /** Loading state */
  loading: boolean;

  /** Error message if any */
  error: string | null;

  /** Per-source sync times */
  lastSync: Map<string, Date>;
}

/**
 * Initial state for the task store
 */
export const initialTaskStoreState: TaskStoreState = {
  tasks: [],
  loading: false,
  error: null,
  lastSync: new Map(),
};

/**
 * Task reducer - pure function that handles all state mutations
 *
 * @param state - Current state
 * @param action - Action to process
 * @returns New state
 */
export function taskReducer(
  state: TaskStoreState,
  action: TaskAction
): TaskStoreState {
  switch (action.type) {
    case "LOAD_SOURCE_START":
      return {
        ...state,
        loading: true,
        error: null,
      };

    case "LOAD_SOURCE_SUCCESS": {
      // Merge-by-key strategy: Index tasks by source keys, merge matching tasks
      // This handles cross-source tasks correctly (e.g., GitHub task with Obsidian file)
      const taskMap = new Map<string, Task>();
      const taskIdMap = new Map<string, Task>(); // Track all tasks by ID

      // Step 1: Index existing tasks by ALL their source keys AND by ID
      for (const task of state.tasks) {
        // Always preserve task by ID
        taskIdMap.set(task.id, task);

        // Also index by source keys for matching
        if (task.source.keys) {
          for (const [sourceId, key] of Object.entries(task.source.keys)) {
            if (key) {
              taskMap.set(`${sourceId}:${key}`, task);
            }
          }
        }
      }

      // Step 2: Process new tasks from this source
      const newTasks = Array.isArray(action.tasks) ? action.tasks : [];
      for (const newTask of newTasks) {
        const sourceKey = newTask.source.keys?.[action.sourceId];

        let lookupKey: string;
        if (!sourceKey) {
          console.warn(
            `Task ${newTask.id} missing source key for ${action.sourceId}, using fallback key`
          );
          // Use fallback key based on task ID to prevent data loss
          lookupKey = `${action.sourceId}:fallback:${newTask.id}`;
        } else {
          lookupKey = `${action.sourceId}:${sourceKey}`;
        }

        const existing = taskMap.get(lookupKey);

        if (existing) {
          // Step 3: Merge with existing task
          const mergedSource: TaskSource = {
            extension: existing.source.extension, // Preserve owner
            keys: {
              ...existing.source.keys, // Keep existing keys
              ...newTask.source.keys, // Merge new keys
            },
          };
          
          // Only add data property if it exists
          const sourceData = newTask.source.data || existing.source.data;
          if (sourceData !== undefined) {
            mergedSource.data = sourceData;
          }
          
          const mergedBase: Task = {
            ...existing, // Start with existing task
            ...newTask, // Override with new data
            id: existing.id, // Preserve ID
            createdAt: existing.createdAt, // Preserve creation time
            source: mergedSource,
          };

          // Check if meaningfully different for updatedAt
          const changed = isMeaningfullyDifferent(existing, mergedBase);
          const merged: Task = {
            ...mergedBase,
            updatedAt: changed ? new Date() : existing.updatedAt,
          };

          // Update all key mappings to point to merged task
          for (const [sid, key] of Object.entries(merged.source.keys)) {
            if (key) {
              taskMap.set(`${sid}:${key}`, merged);
            }
          }

          // Update ID map with merged task
          taskIdMap.set(merged.id, merged);
        } else {
          // Step 4: New task - add to both maps
          taskMap.set(lookupKey, newTask);
          taskIdMap.set(newTask.id, newTask);
        }
      }

      // Step 5: Extract unique tasks by ID with duplicate detection
      const seenIds = new Set<string>();
      const uniqueTasks: Task[] = [];
      for (const task of taskIdMap.values()) {
        if (!seenIds.has(task.id)) {
          seenIds.add(task.id);
          uniqueTasks.push(task);
        } else {
          // Check if it's a different object with same ID (shouldn't happen)
          const existing = uniqueTasks.find(t => t.id === task.id);
          if (existing && existing !== task) {
            console.warn(
              `Duplicate task ID detected with different objects: ${task.id}`
            );
          }
        }
      }

      return {
        ...state,
        tasks: uniqueTasks,
        loading: false,
        lastSync: new Map(state.lastSync).set(action.sourceId, new Date()),
      };
    }

    case "LOAD_SOURCE_ERROR":
      return {
        ...state,
        loading: false,
        error: action.error,
      };

    case "ADD_TASK":
      return {
        ...state,
        tasks: [...state.tasks, action.task],
      };

    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.task.id ? action.task : t
        ),
      };

    case "REMOVE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.taskId),
      };

    case "UPSERT_TASK": {
      // Validate that taskData has an ID
      if (!action.taskData.id) {
        throw new Error("UPSERT_TASK requires taskData to have an ID");
      }

      const newTaskData = action.taskData;

      // Simple ID-based matching
      const existingTask = state.tasks.find((t) => t.id === newTaskData.id);

      if (existingTask) {
        // Update existing task, preserving creation timestamp
        const updatedTask = {
          ...newTaskData,
          createdAt: existingTask.createdAt,
          updatedAt: new Date(),
        };

        return {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === existingTask.id ? updatedTask : t
          ),
        };
      } else {
        // Add new task
        return {
          ...state,
          tasks: [...state.tasks, newTaskData],
        };
      }
    }

    case "CLEAR_ALL_TASKS":
      return {
        ...state,
        tasks: [],
        loading: false,
        error: null,
      };

    default:
      return state;
  }
}
