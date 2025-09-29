/**
 * Extension-aware task store with event bus integration
 * Maintains reactive state for tasks from multiple extensions
 */

import { writable, derived, type Readable } from "svelte/store";
import { Task } from "../core/entities";
import { generateId } from "../utils/idGenerator";

interface TaskStoreState {
  tasks: readonly Task[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export interface TaskStore extends Readable<TaskStoreState> {
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

  // Upsert method for extension scanning
  upsertTask: (taskData: Omit<Task, "id"> & { naturalKey: string }) => Task;
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

  // Upsert method for extension scanning - handles natural key matching and ID generation
  const upsertTask = (
    taskData: Omit<Task, "id"> & { naturalKey: string }
  ): Task => {
    let resultTask: Task;

    update((state) => {
      // Find existing task by natural key (source.source for Obsidian = file path)
      const existingTask = state.tasks.find(
        (t) => t.source?.source === taskData.naturalKey
      );

      if (existingTask) {
        // Update existing task, preserving ID and created timestamp
        resultTask = {
          ...taskData,
          id: existingTask.id,
          createdAt: existingTask.createdAt,
          updatedAt: new Date(),
        } as Task;

        return {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === existingTask.id ? resultTask : t
          ),
          lastSync: new Date(),
        };
      } else {
        // Create new task with generated ID
        resultTask = {
          ...taskData,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Task;

        return {
          ...state,
          tasks: [...state.tasks, resultTask],
          lastSync: new Date(),
        };
      }
    });

    return resultTask!;
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
    upsertTask,
  };
}

// Global task store instance
export const taskStore = createTaskStore();
