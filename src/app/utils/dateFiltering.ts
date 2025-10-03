/**
 * Date filtering utilities for tasks
 * Provides functions to filter tasks by Do Date property and group by completion status
 */

import type { Task } from "../core/entities";

/**
 * Get date string in YYYY-MM-DD format using local timezone
 */
export function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date string
 */
export function getTodayString(): string {
  return getDateString(new Date());
}

/**
 * Get yesterday's date string
 */
export function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateString(yesterday);
}

/**
 * Get tomorrow's date string
 */
export function getTomorrowString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateString(tomorrow);
}

/**
 * Check if a date string matches today
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayString();
}

/**
 * Check if a date string matches yesterday
 */
export function isYesterday(dateString: string): boolean {
  return dateString === getYesterdayString();
}

/**
 * Check if a date string matches tomorrow
 */
export function isTomorrow(dateString: string): boolean {
  return dateString === getTomorrowString();
}

/**
 * Check if a task has a Do Date set
 */
export function hasDoDate(task: Task): boolean {
  return !!(task.doDate instanceof Date && !isNaN(task.doDate.getTime()));
}

/**
 * Filter tasks by Do Date property
 */
export function filterTasksByDoDate(tasks: Task[], targetDate: string): Task[] {
  return tasks.filter((task) => {
    if (!hasDoDate(task)) return false;
    return getDateString(task.doDate!) === targetDate;
  });
}

/**
 * Get tasks scheduled for today
 */
export function getTasksForToday(tasks: Task[]): Task[] {
  return filterTasksByDoDate(tasks, getTodayString());
}

/**
 * Get tasks scheduled for yesterday
 */
export function getTasksForYesterday(tasks: Task[]): Task[] {
  return filterTasksByDoDate(tasks, getYesterdayString());
}

/**
 * Get tasks scheduled for tomorrow
 */
export function getTasksForTomorrow(tasks: Task[]): Task[] {
  return filterTasksByDoDate(tasks, getTomorrowString());
}

/**
 * Get tasks scheduled for a specific date
 */
export function getTasksForDate(tasks: Task[], date: Date): Task[] {
  return filterTasksByDoDate(tasks, getDateString(date));
}

/**
 * Group tasks by completion status
 */
export function groupTasksByCompletion(tasks: Task[]): {
  done: Task[];
  notDone: Task[];
} {
  return {
    done: tasks.filter((task) => task.done === true),
    notDone: tasks.filter((task) => task.done !== true),
  };
}

/**
 * Get tasks from yesterday grouped by completion status
 */
export function getYesterdayTasksGrouped(tasks: Task[]): {
  done: Task[];
  notDone: Task[];
} {
  const yesterdayTasks = getTasksForYesterday(tasks);
  return groupTasksByCompletion(yesterdayTasks);
}

/**
 * Get tasks from today grouped by completion status
 */
export function getTodayTasksGrouped(tasks: Task[]): {
  done: Task[];
  notDone: Task[];
} {
  const todayTasks = getTasksForToday(tasks);
  return groupTasksByCompletion(todayTasks);
}

/**
 * Get tasks without a Do Date
 */
export function getTasksWithoutDoDate(tasks: Task[]): Task[] {
  return tasks.filter((task) => !hasDoDate(task));
}

/**
 * Get tasks with a Do Date
 */
export function getTasksWithDoDate(tasks: Task[]): Task[] {
  return tasks.filter((task) => hasDoDate(task));
}

/**
 * Get overdue tasks (Do Date is before today and not done)
 */
export function getOverdueTasks(tasks: Task[]): Task[] {
  const today = getTodayString();
  return tasks.filter((task) => {
    if (!hasDoDate(task) || task.done) {
      return false;
    }
    return getDateString(task.doDate!) < today;
  });
}

/**
 * Get upcoming tasks (Do Date is after today)
 */
export function getUpcomingTasks(tasks: Task[]): Task[] {
  const today = getTodayString();
  return tasks.filter((task) => {
    if (!hasDoDate(task)) {
      return false;
    }
    return getDateString(task.doDate!) > today;
  });
}

/**
 * Get tasks for a date range
 */
export function getTasksForDateRange(
  tasks: Task[],
  startDate: Date,
  endDate: Date
): Task[] {
  const startString = getDateString(startDate);
  const endString = getDateString(endDate);

  return tasks.filter((task) => {
    if (!hasDoDate(task)) {
      return false;
    }
    const taskDateString = getDateString(task.doDate!);
    return taskDateString >= startString && taskDateString <= endString;
  });
}
