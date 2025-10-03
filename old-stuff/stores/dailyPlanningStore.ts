import { writable, get } from "svelte/store";
import type { Task } from "../types/entities";
import { taskStore } from "./taskStore";

/**
 * Store for managing tasks scheduled during Daily Planning wizard
 */
export interface DailyPlanningState {
  scheduledTasks: Task[];
  unscheduledTasks: Task[];
  alreadyScheduledTasks: Task[]; // Tasks that were already scheduled for today before planning started
  tasksToBeScheduled: Task[]; // Tasks added during planning that need to be scheduled
  tasksToUnschedule: Task[]; // Already scheduled tasks that need Do Date cleared
  isActive: boolean;
}

const initialState: DailyPlanningState = {
  scheduledTasks: [],
  unscheduledTasks: [],
  alreadyScheduledTasks: [],
  tasksToBeScheduled: [],
  tasksToUnschedule: [],
  isActive: false,
};

export const dailyPlanningStore = writable<DailyPlanningState>(initialState);

/**
 * Add a task to the scheduled tasks list (for tasks added during planning)
 */
export function scheduleTaskForToday(task: Task): void {
  dailyPlanningStore.update((state) => {
    // Remove from unscheduled if it exists there
    const newUnscheduledTasks = state.unscheduledTasks.filter(
      (t) => t.filePath !== task.filePath
    );

    // Remove from tasksToUnschedule if it exists there
    const newTasksToUnschedule = state.tasksToUnschedule.filter(
      (t) => t.filePath !== task.filePath
    );

    // Add to scheduled if not already there
    const alreadyScheduled = state.scheduledTasks.some(
      (t) => t.filePath === task.filePath
    );

    const newScheduledTasks = alreadyScheduled
      ? state.scheduledTasks
      : [...state.scheduledTasks, task];

    // Add to tasksToBeScheduled if not already there and not in alreadyScheduledTasks
    const isAlreadyScheduledForToday = state.alreadyScheduledTasks.some(
      (t) => t.filePath === task.filePath
    );
    const isAlreadyInToBeScheduled = state.tasksToBeScheduled.some(
      (t) => t.filePath === task.filePath
    );

    const newTasksToBeScheduled =
      isAlreadyScheduledForToday || isAlreadyInToBeScheduled
        ? state.tasksToBeScheduled
        : [...state.tasksToBeScheduled, task];

    return {
      ...state,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
      tasksToBeScheduled: newTasksToBeScheduled,
      tasksToUnschedule: newTasksToUnschedule,
    };
  });
}

/**
 * Remove a task from the scheduled tasks list and handle based on its origin
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

    // Check if this task was already scheduled for today before planning started
    const wasAlreadyScheduled = state.alreadyScheduledTasks.some(
      (t) => t.filePath === task.filePath
    );

    // Remove from tasksToBeScheduled if it exists there
    const newTasksToBeScheduled = state.tasksToBeScheduled.filter(
      (t) => t.filePath !== task.filePath
    );

    let newUnscheduledTasks = state.unscheduledTasks;
    let newTasksToUnschedule = state.tasksToUnschedule;

    if (wasAlreadyScheduled) {
      // For already scheduled tasks, add to tasksToUnschedule (needs Do Date cleared)
      const alreadyInToUnschedule = state.tasksToUnschedule.some(
        (t) => t.filePath === task.filePath
      );
      if (!alreadyInToUnschedule) {
        newTasksToUnschedule = [...state.tasksToUnschedule, task];
      }
    }

    // Add to unscheduled tasks if not already there
    if (!alreadyUnscheduled) {
      newUnscheduledTasks = [...state.unscheduledTasks, task];
    }

    return {
      ...state,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
      tasksToBeScheduled: newTasksToBeScheduled,
      tasksToUnschedule: newTasksToUnschedule,
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

    // Remove from tasksToUnschedule if it exists there
    const newTasksToUnschedule = state.tasksToUnschedule.filter(
      (t) => t.filePath !== task.filePath
    );

    // Add to scheduled if not already there
    const newScheduledTasks = state.scheduledTasks.some(
      (t) => t.filePath === task.filePath
    )
      ? state.scheduledTasks
      : [...state.scheduledTasks, task];

    // Check if this task was already scheduled for today before planning started
    const wasAlreadyScheduled = state.alreadyScheduledTasks.some(
      (t) => t.filePath === task.filePath
    );

    // If it wasn't already scheduled, add to tasksToBeScheduled
    const newTasksToBeScheduled =
      wasAlreadyScheduled ||
      state.tasksToBeScheduled.some((t) => t.filePath === task.filePath)
        ? state.tasksToBeScheduled
        : [...state.tasksToBeScheduled, task];

    return {
      ...state,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
      tasksToBeScheduled: newTasksToBeScheduled,
      tasksToUnschedule: newTasksToUnschedule,
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
 * Check if a task was already scheduled for today before planning started
 */
export function isTaskAlreadyScheduled(task: Task): boolean {
  const state = get(dailyPlanningStore);
  return state.alreadyScheduledTasks.some((t) => t.filePath === task.filePath);
}

/**
 * Check if a task was added during planning
 */
export function isTaskAddedDuringPlanning(task: Task): boolean {
  const state = get(dailyPlanningStore);
  return state.tasksToBeScheduled.some((t) => t.filePath === task.filePath);
}

/**
 * Check if a task is staged to be unscheduled
 */
export function isTaskToBeUnscheduled(task: Task): boolean {
  const state = get(dailyPlanningStore);
  return state.tasksToUnschedule.some((t) => t.filePath === task.filePath);
}

/**
 * Set the Daily Planning wizard active state
 */
export function setDailyPlanningActive(isActive: boolean): void {
  dailyPlanningStore.update((state) => {
    let newScheduledTasks = state.scheduledTasks;
    let newUnscheduledTasks = state.unscheduledTasks;
    let newAlreadyScheduledTasks = state.alreadyScheduledTasks;
    let newTasksToBeScheduled = state.tasksToBeScheduled;
    let newTasksToUnschedule = state.tasksToUnschedule;

    if (isActive) {
      // When activating, load any existing tasks scheduled for today
      // This handles the case where tasks were imported while the wizard was not active
      if (state.scheduledTasks.length === 0) {
        const todayTasks = taskStore.getTasksForToday();

        // All existing today tasks are considered "already scheduled"
        newAlreadyScheduledTasks = [...todayTasks];
        // Add all today tasks to scheduled tasks
        newScheduledTasks = [...todayTasks];
      } else {
        // Keep existing tasks
        newScheduledTasks = state.scheduledTasks;
        newAlreadyScheduledTasks = state.alreadyScheduledTasks;
      }
      newUnscheduledTasks = state.unscheduledTasks;
      newTasksToBeScheduled = state.tasksToBeScheduled;
      newTasksToUnschedule = state.tasksToUnschedule;
    } else {
      // When deactivating, clear all tasks
      newScheduledTasks = [];
      newUnscheduledTasks = [];
      newAlreadyScheduledTasks = [];
      newTasksToBeScheduled = [];
      newTasksToUnschedule = [];
    }

    return {
      ...state,
      isActive,
      scheduledTasks: newScheduledTasks,
      unscheduledTasks: newUnscheduledTasks,
      alreadyScheduledTasks: newAlreadyScheduledTasks,
      tasksToBeScheduled: newTasksToBeScheduled,
      tasksToUnschedule: newTasksToUnschedule,
    };
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
