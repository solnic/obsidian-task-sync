/**
 * Extension-aware task store with event bus integration
 * Maintains reactive state for tasks from multiple extensions
 */

import { writable, derived, type Readable } from 'svelte/store';
import { Task } from '../core/entities';
import { EventBus, type DomainEvent } from '../core/events';

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
}

export function createTaskStore(eventBus: EventBus): TaskStore {
  const initialState: TaskStoreState = {
    tasks: [],
    loading: false,
    error: null,
    lastSync: null
  };

  const { subscribe, update } = writable(initialState);

  // Store cleanup functions for event subscriptions
  const unsubscribeFunctions: (() => void)[] = [];

  // Subscribe to extension events
  const unsubscribeCreated = eventBus.on('tasks.created', (event) => {
    update(state => ({
      ...state,
      tasks: [...state.tasks, event.task],
      lastSync: new Date()
    }));
  });
  unsubscribeFunctions.push(unsubscribeCreated);

  const unsubscribeUpdated = eventBus.on('tasks.updated', (event) => {
    update(state => ({
      ...state,
      tasks: state.tasks.map(t => t.id === event.task.id ? event.task : t),
      lastSync: new Date()
    }));
  });
  unsubscribeFunctions.push(unsubscribeUpdated);

  const unsubscribeDeleted = eventBus.on('tasks.deleted', (event) => {
    update(state => ({
      ...state,
      tasks: state.tasks.filter(t => t.id !== event.taskId),
      lastSync: new Date()
    }));
  });
  unsubscribeFunctions.push(unsubscribeDeleted);

  const unsubscribeLoaded = eventBus.on('tasks.loaded', (event) => {
    update(state => ({
      ...state,
      tasks: [...event.tasks],
      lastSync: new Date()
    }));
  });
  unsubscribeFunctions.push(unsubscribeLoaded);

  // Derived stores for common queries
  const tasksByExtension = derived({ subscribe }, ($store) => {
    const grouped = new Map<string, Task[]>();
    for (const task of $store.tasks) {
      const extension = task.source?.extension || 'unknown';
      if (!grouped.has(extension)) {
        grouped.set(extension, []);
      }
      grouped.get(extension)!.push(task);
    }
    return grouped;
  });

  const todayTasks = derived({ subscribe }, ($store) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return $store.tasks.filter(t =>
      t.doDate && t.doDate >= today && t.doDate < tomorrow
    );
  });

  const importedTasks = derived({ subscribe }, ($store) =>
    $store.tasks.filter(task => task.source)
  );

  // Actions
  const setLoading = (loading: boolean) => {
    update(state => ({ ...state, loading }));
  };

  const setError = (error: string | null) => {
    update(state => ({ ...state, error }));
  };

  const cleanup = () => {
    unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
  };

  return {
    subscribe,
    tasksByExtension,
    todayTasks,
    importedTasks,
    setLoading,
    setError,
    cleanup
  };
}
