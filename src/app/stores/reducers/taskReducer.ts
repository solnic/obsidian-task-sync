/**
 * Task store reducer
 *
 * Handles all task state mutations through a pure reducer function.
 * All state changes go through this reducer, providing a single source of truth.
 */

import type { Task } from "../../core/entities";
import type { TaskAction } from "../actions";

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
      // Simple strategy: Remove all tasks from this source, then add new tasks
      // Each source is authoritative for its own data
      const filteredTasks = state.tasks.filter(
        (task) => task.source.extension !== action.sourceId
      );

      // Preserve existing task IDs and timestamps for tasks that already exist
      const newTasks = Array.isArray(action.tasks)
        ? action.tasks.map((newTask) => {
            // Find existing task by ID to preserve timestamps
            const existingTask = state.tasks.find((t) => t.id === newTask.id);

            if (existingTask) {
              // Preserve ID and creation timestamp, update everything else
              return {
                ...newTask,
                id: existingTask.id,
                createdAt: existingTask.createdAt,
                updatedAt: new Date(),
              };
            }

            return newTask;
          })
        : [];

      return {
        ...state,
        tasks: [...filteredTasks, ...newTasks],
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
