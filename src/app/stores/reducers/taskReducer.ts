/**
 * Task store reducer
 *
 * Handles all task state mutations through a pure reducer function.
 * All state changes go through this reducer, providing a single source of truth.
 */

import type { Task } from "../../core/entities";
import type { TaskAction } from "../actions";

/**
 * Placeholder ID used for temporary tasks during reconciliation
 * This ID is replaced by the reconciler with a proper ID
 */
const TEMP_TASK_ID = "__TEMP__" as const;

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
      // Delegate filtering logic to the reconciler
      const filteredTasks = action.reconciler.filterTasksOnRefresh(
        state.tasks,
        action.sourceId
      );

      // Reconcile each new task using the reconciler's strategy
      // IMPORTANT: Search for existing tasks in the ORIGINAL state.tasks (before filtering)
      // This allows the reconciler to find and preserve metadata from tasks that will be replaced
      // For example, a GitHub task imported to vault should preserve source.extension='github'
      const reconciledTasks = Array.isArray(action.tasks)
        ? action.tasks.map((newTask) => {
            // Find existing task in ORIGINAL state.tasks, not filtered tasks
            // This is crucial for preserving source metadata from persisted storage
            const existingTask = state.tasks.find((t) =>
              action.reconciler.matchesTask(t, newTask)
            );

            // Let reconciler merge the tasks
            return action.reconciler.reconcileTask(existingTask, newTask);
          })
        : [];

      // Add reconciled tasks to filtered tasks
      return {
        ...state,
        tasks: [...filteredTasks, ...reconciledTasks],
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
      // Create a temporary task object for matching purposes
      // The reconciler will handle ID generation if needed
      const newTaskData = {
        ...action.taskData,
        id: TEMP_TASK_ID, // Explicit placeholder - reconciler will set proper ID
      } as Task;

      // Use reconciler to find matching task
      const existingTask = state.tasks.find((t) =>
        action.reconciler.matchesTask(t, newTaskData)
      );

      // Let reconciler merge the data
      const reconciledTask = action.reconciler.reconcileTask(
        existingTask,
        newTaskData
      );

      if (existingTask) {
        // Update existing task
        return {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === existingTask.id ? reconciledTask : t
          ),
        };
      } else {
        // Add new task
        return {
          ...state,
          tasks: [...state.tasks, reconciledTask],
        };
      }
    }

    default:
      return state;
  }
}
