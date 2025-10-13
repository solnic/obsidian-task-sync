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
   * All state mutations must go through this method
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
