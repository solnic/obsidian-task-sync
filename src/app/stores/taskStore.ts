/**
 * Task store - Action-based architecture
 *
 * Architecture using action dispatcher pattern:
 * - All mutations go through dispatch(action)
 * - Pure reducer handles state changes
 * - No direct mutation methods (addTask, updateTask, etc.)
 * - Cleaner separation of concerns
 * - Easier to debug, test, and extend
 */

import { writable, type Readable } from "svelte/store";
import {
  taskReducer,
  initialTaskStoreState,
  type TaskStoreState,
} from "./reducers/taskReducer";
import type { TaskAction } from "./actions";

/**
 * Task store interface
 */
export interface TaskStore extends Readable<TaskStoreState> {
  /**
   * Dispatch an action to update the store
   *
   * All state mutations must go through this method. The action is processed
   * by the pure reducer function which returns a new state.
   *
   * @param action - The action to dispatch. Must be one of the TaskAction types:
   *   - LOAD_SOURCE_START: Begin loading tasks from a source
   *   - LOAD_SOURCE_SUCCESS: Tasks loaded successfully from a source
   *   - LOAD_SOURCE_ERROR: Error loading tasks from a source
   *   - ADD_TASK: Add a new task to the store
   *   - UPDATE_TASK: Update an existing task in the store
   *   - REMOVE_TASK: Remove a task from the store
   *   - UPSERT_TASK: Insert or update a task using natural key matching
   *
   * @example
   * ```typescript
   * // Add a new task
   * taskStore.dispatch({
   *   type: 'ADD_TASK',
   *   task: newTask
   * });
   *
   * // Load tasks from a source
   * taskStore.dispatch({
   *   type: 'LOAD_SOURCE_SUCCESS',
   *   sourceId: 'obsidian',
   *   tasks: loadedTasks,
   *   reconciler: new ObsidianTaskReconciler()
   * });
   * ```
   */
  dispatch: (action: TaskAction) => void;
}

/**
 * Create the task store with action dispatcher pattern
 */
function createTaskStore(): TaskStore {
  const { subscribe, update } = writable<TaskStoreState>(initialTaskStoreState);

  /**
   * Dispatch an action to the store
   * The reducer will handle the state mutation
   */
  const dispatch = (action: TaskAction) => {
    update((state) => taskReducer(state, action));
  };

  return {
    subscribe,
    dispatch,
  };
}

/**
 * Global task store instance
 *
 * Usage:
 * - Subscribe: $taskStore in components
 * - Dispatch: taskStore.dispatch({ type: 'ADD_TASK', task })
 */
export const taskStore = createTaskStore();
