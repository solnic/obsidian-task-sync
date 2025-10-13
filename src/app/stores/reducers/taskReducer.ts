/**
 * Task store reducer
 *
 * Handles all task state mutations through a pure reducer function.
 * All state changes go through this reducer, providing a single source of truth.
 */

import type { Task } from "../../core/entities";
import type { TaskAction } from "../actions";
import { generateId } from "../../utils/idGenerator";

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
      // For Obsidian source: Remove ALL tasks that have filePath (vault-backed tasks)
      // This includes GitHub tasks that were imported and have vault files
      // For other sources: Remove only tasks from that specific extension
      const filteredTasks = state.tasks.filter((t) => {
        if (action.sourceId === "obsidian") {
          // Remove all vault-backed tasks (those with filePath)
          return !t.source?.filePath;
        } else {
          // For other sources, remove only tasks from that extension
          return t.source?.extension !== action.sourceId;
        }
      });

      // For Obsidian source, preserve ID, createdAt, and source.extension from old tasks
      // This ensures tasks maintain their identity and GitHub tasks keep their source.extension = "github" after refresh
      const tasksToAdd = Array.isArray(action.tasks)
        ? action.tasks.map((newTask) => {
            if (action.sourceId === "obsidian" && newTask.source?.filePath) {
              // Find old task with same filePath
              const oldTask = state.tasks.find(
                (t) => t.source?.filePath === newTask.source?.filePath
              );
              if (oldTask) {
                // Preserve ID, createdAt, and source metadata from old task
                return {
                  ...newTask,
                  id: oldTask.id, // Preserve ID to maintain task identity
                  createdAt: oldTask.createdAt, // Preserve creation timestamp
                  source: {
                    ...newTask.source,
                    // Preserve original extension (e.g., "github" for imported tasks)
                    extension:
                      oldTask.source?.extension ||
                      newTask.source?.extension ||
                      "obsidian",
                    // Preserve source URL (e.g., GitHub issue URL)
                    url: oldTask.source?.url || newTask.source?.url,
                    // Preserve source data (e.g., GitHub issue data)
                    data: oldTask.source?.data || newTask.source?.data,
                  },
                } as Task;
              }
            }
            // For new tasks (no old task found), generate ID
            return {
              ...newTask,
              id: newTask.id || crypto.randomUUID(),
            } as Task;
          })
        : [];

      // Add new tasks from source
      return {
        ...state,
        tasks: [...filteredTasks, ...tasksToAdd],
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
      // Find existing task by natural key (source.filePath for Obsidian)
      const existingTask = state.tasks.find(
        (t) => t.source?.filePath === action.taskData.naturalKey
      );

      if (existingTask) {
        // Update existing task, preserving ID, created timestamp, and important source metadata
        const updatedTask: Task = {
          ...action.taskData,
          id: existingTask.id,
          createdAt: existingTask.createdAt,
          updatedAt: new Date(),
          source: {
            ...action.taskData.source,
            // Preserve original extension (e.g., "github" for imported tasks)
            extension:
              existingTask.source?.extension ||
              action.taskData.source?.extension ||
              "obsidian",
            // Preserve source URL (e.g., GitHub issue URL)
            url: existingTask.source?.url || action.taskData.source?.url,
            // Preserve source data (e.g., GitHub issue data)
            data: existingTask.source?.data || action.taskData.source?.data,
          },
        } as Task;

        return {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === existingTask.id ? updatedTask : t
          ),
        };
      } else {
        // Create new task with generated ID
        const newTask: Task = {
          ...action.taskData,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Task;

        return {
          ...state,
          tasks: [...state.tasks, newTask],
        };
      }
    }

    default:
      return state;
  }
}
