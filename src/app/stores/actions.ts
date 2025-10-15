/**
 * Action type definitions for the new action-based store architecture
 *
 * All state mutations go through actions dispatched to the store reducer.
 * This provides a single source of truth for state changes and makes
 * debugging, testing, and extending (middleware, logging, undo/redo) easier.
 */

import type { Task, Project, Area } from "../core/entities";
import type { TaskReconciler } from "../core/TaskReconciler";

/**
 * Task-related actions
 *
 * Action types:
 * - LOAD_SOURCE_* - For loading data from external sources
 * - ADD_TASK - For adding a new task (user creation)
 * - UPDATE_TASK - For updating an existing task
 * - REMOVE_TASK - For removing a task
 * - UPSERT_TASK - For scanning operations (preserves natural key matching)
 */
export type TaskAction =
  | { type: "LOAD_SOURCE_START"; sourceId: string }
  | {
      type: "LOAD_SOURCE_SUCCESS";
      sourceId: string;
      tasks: readonly Task[];
      reconciler: TaskReconciler;
    }
  | { type: "LOAD_SOURCE_ERROR"; sourceId: string; error: string }
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; task: Task }
  | { type: "REMOVE_TASK"; taskId: string }
  | {
      type: "UPSERT_TASK";
      taskData: Omit<Task, "id"> & { naturalKey: string };
      reconciler: TaskReconciler;
    };

/**
 * Project-related actions
 *
 * Action types:
 * - ADD_PROJECT - For adding a new project
 * - UPDATE_PROJECT - For updating an existing project
 * - REMOVE_PROJECT - For removing a project
 * - SET_LOADING - For setting loading state
 * - SET_ERROR - For setting error state
 */
export type ProjectAction =
  | { type: "ADD_PROJECT"; project: Project }
  | { type: "UPDATE_PROJECT"; project: Project }
  | { type: "REMOVE_PROJECT"; projectId: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null };

/**
 * Area-related actions
 *
 * Action types:
 * - ADD_AREA - For adding a new area
 * - UPDATE_AREA - For updating an existing area
 * - REMOVE_AREA - For removing an area
 * - SET_LOADING - For setting loading state
 * - SET_ERROR - For setting error state
 */
export type AreaAction =
  | { type: "ADD_AREA"; area: Area }
  | { type: "UPDATE_AREA"; area: Area }
  | { type: "REMOVE_AREA"; areaId: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null };
