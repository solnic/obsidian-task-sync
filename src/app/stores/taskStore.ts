/**
 * Extension-aware task store with event bus integration
 * Maintains reactive state for tasks from multiple extensions
 */

import { writable, derived, type Readable } from "svelte/store";
import { Task } from "../core/entities";

interface TaskStoreState {
  tasks: readonly Task[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

interface TaskStore extends Readable<TaskStoreState> {
  // Derived stores for common queries
  tasksByExtension: Readable<Map<string, Task[]>>;
  todayTasks: Readable<Task[]>;
  importedTasks: Readable<Task[]>;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  cleanup: () => void;

  // Direct store manipulation methods (for core operations)
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  removeTask: (taskId: string) => void;
}

export function createTaskStore(): TaskStore {
  const initialState: TaskStoreState = {
    tasks: [],
    loading: false,
    error: null,
    lastSync: null,
  };

  const { subscribe, update } = writable(initialState);

  // Store cleanup functions for event subscriptions
  const unsubscribeFunctions: (() => void)[] = [];

  // Store should NOT listen to domain events - that creates circular dependencies
  // Domain events are for extensions to react to, not for updating the store

  // Derived stores for common queries
  const tasksByExtension = derived({ subscribe }, ($store) => {
    const grouped = new Map<string, Task[]>();
    for (const task of $store.tasks) {
      const extension = task.source?.extension || "unknown";
      if (!grouped.has(extension)) {
        grouped.set(extension, []);
      }
      grouped.get(extension)?.push(task);
    }
    return grouped;
  });

  const todayTasks = derived({ subscribe }, ($store) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return $store.tasks.filter(
      (t) => t.doDate && t.doDate >= today && t.doDate < tomorrow
    );
  });

  const importedTasks = derived({ subscribe }, ($store) =>
    $store.tasks.filter((task) => task.source)
  );

  // Actions
  const setLoading = (loading: boolean) => {
    update((state) => ({ ...state, loading }));
  };

  const setError = (error: string | null) => {
    update((state) => ({ ...state, error }));
  };

  const cleanup = () => {
    unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  };

  // Direct store manipulation methods (for core operations)
  const addTask = (task: Task): void => {
    update((state) => ({
      ...state,
      tasks: [...state.tasks, task],
      lastSync: new Date(),
    }));
  };

  const updateTask = (task: Task): void => {
    update((state) => ({
      ...state,
      tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
      lastSync: new Date(),
    }));
  };

  const removeTask = (taskId: string): void => {
    update((state) => ({
      ...state,
      tasks: state.tasks.filter((t) => t.id !== taskId),
      lastSync: new Date(),
    }));
  };

  return {
    subscribe,
    tasksByExtension,
    todayTasks,
    importedTasks,
    setLoading,
    setError,
    cleanup,
    addTask,
    updateTask,
    removeTask,
  };
}

// Global task store instance
export const taskStore = createTaskStore();
