import { writable, get } from "svelte/store";
import type { Task } from "../types/entities";

/**
 * Store for managing tasks scheduled during Daily Planning wizard
 */
export interface DailyPlanningState {
  scheduledTasks: Task[];
  isActive: boolean;
}

const initialState: DailyPlanningState = {
  scheduledTasks: [],
  isActive: false,
};

export const dailyPlanningStore = writable<DailyPlanningState>(initialState);

/**
 * Add a task to the scheduled tasks list
 */
export function scheduleTaskForToday(task: Task): void {
  dailyPlanningStore.update((state) => {
    const newScheduledTasks = [...state.scheduledTasks, task];
    return {
      ...state,
      scheduledTasks: newScheduledTasks,
    };
  });
}

/**
 * Remove a task from the scheduled tasks list
 */
export function unscheduleTask(task: Task): void {
  dailyPlanningStore.update((state) => ({
    ...state,
    scheduledTasks: state.scheduledTasks.filter(
      (t) => t.filePath !== task.filePath
    ),
  }));
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
    // Clear scheduled tasks when deactivating
    scheduledTasks: isActive ? state.scheduledTasks : [],
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
