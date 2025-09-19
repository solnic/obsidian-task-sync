import { writable, get } from "svelte/store";
import type { Task } from "../types/entities";
import { taskStore } from "./taskStore";

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
    const alreadyScheduled = state.scheduledTasks.some(
      (t) => t.filePath === task.filePath
    );

    const newScheduledTasks = alreadyScheduled
      ? state.scheduledTasks
      : [...state.scheduledTasks, task];

    const newState = {
      ...state,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
    };

    return newState;
  });
}

/**
 * Remove a task from the scheduled tasks list and add to unscheduled
 */
export function unscheduleTask(task: Task): void {
  dailyPlanningStore.update((state) => {
    // Check if task is already unscheduled
    const alreadyUnscheduled = state.unscheduledTasks.some(
      (t) => t.filePath === task.filePath
    );

    // Remove from scheduled tasks
    const newScheduledTasks = state.scheduledTasks.filter(
      (t) => t.filePath !== task.filePath
    );

    // Add to unscheduled tasks if not already there
    const newUnscheduledTasks = alreadyUnscheduled
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
  dailyPlanningStore.update((state) => {
    let newScheduledTasks = state.scheduledTasks;
    let newUnscheduledTasks = state.unscheduledTasks;

    if (isActive) {
      // When activating, load any existing tasks scheduled for today
      // This handles the case where tasks were imported while the wizard was not active
      if (state.scheduledTasks.length === 0) {
        const todayTasks = taskStore.getTasksForToday();

        // Add all today tasks to scheduled tasks
        newScheduledTasks = [...state.scheduledTasks, ...todayTasks];
      } else {
        // Keep existing tasks
        newScheduledTasks = state.scheduledTasks;
      }
      newUnscheduledTasks = state.unscheduledTasks;
    } else {
      // When deactivating, clear tasks
      newScheduledTasks = [];
      newUnscheduledTasks = [];
    }

    const newState = {
      ...state,
      isActive,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
    };

    return newState;
  });
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
