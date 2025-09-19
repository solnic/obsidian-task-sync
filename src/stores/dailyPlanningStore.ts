import { writable, get } from "svelte/store";
import type { Task } from "../types/entities";

/**
 * Store for managing tasks scheduled during Daily Planning wizard
 */
export interface DailyPlanningState {
  scheduledTasks: Task[];
  unscheduledTasks: Task[];
  isActive: boolean;
}

const initialState: DailyPlanningState = {
  scheduledTasks: [],
  unscheduledTasks: [],
  isActive: false,
};

export const dailyPlanningStore = writable<DailyPlanningState>(initialState);

/**
 * Add a task to the scheduled tasks list
 */
export function scheduleTaskForToday(task: Task): void {
  dailyPlanningStore.update((state) => {
    // Remove from unscheduled if it exists there
    const newUnscheduledTasks = state.unscheduledTasks.filter(
      (t) => t.filePath !== task.filePath
    );

    // Add to scheduled if not already there
    const newScheduledTasks = state.scheduledTasks.some(
      (t) => t.filePath === task.filePath
    )
      ? state.scheduledTasks
      : [...state.scheduledTasks, task];

    return {
      ...state,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
    };
  });
}

/**
 * Remove a task from the scheduled tasks list and add to unscheduled
 */
export function unscheduleTask(task: Task): void {
  dailyPlanningStore.update((state) => {
    // Remove from scheduled tasks
    const newScheduledTasks = state.scheduledTasks.filter(
      (t) => t.filePath !== task.filePath
    );

    // Add to unscheduled if not already there
    const newUnscheduledTasks = state.unscheduledTasks.some(
      (t) => t.filePath === task.filePath
    )
      ? state.unscheduledTasks
      : [...state.unscheduledTasks, task];

    return {
      ...state,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
    };
  });
}

/**
 * Move a task from unscheduled back to scheduled
 */
export function rescheduleTask(task: Task): void {
  dailyPlanningStore.update((state) => {
    // Remove from unscheduled tasks
    const newUnscheduledTasks = state.unscheduledTasks.filter(
      (t) => t.filePath !== task.filePath
    );

    // Add to scheduled if not already there
    const newScheduledTasks = state.scheduledTasks.some(
      (t) => t.filePath === task.filePath
    )
      ? state.scheduledTasks
      : [...state.scheduledTasks, task];

    return {
      ...state,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
    };
  });
}

/**
 * Check if a task is scheduled
 */
export function isTaskScheduled(task: Task, scheduledTasks: Task[]): boolean {
  return scheduledTasks.some((t) => t.filePath === task.filePath);
}

/**
 * Set the Daily Planning wizard active state
 */
export function setDailyPlanningActive(isActive: boolean): void {
  dailyPlanningStore.update((state) => ({
    ...state,
    isActive,
    // Clear scheduled and unscheduled tasks when deactivating
    scheduledTasks: isActive ? state.scheduledTasks : [],
    unscheduledTasks: isActive ? state.unscheduledTasks : [],
  }));
}

/**
 * Get all scheduled tasks
 */
export function getScheduledTasks(): Task[] {
  const state = get(dailyPlanningStore);
  return state.scheduledTasks;
}

/**
 * Clear all scheduled tasks
 */
export function clearScheduledTasks(): void {
  dailyPlanningStore.update((state) => ({
    ...state,
    scheduledTasks: [],
  }));
}
