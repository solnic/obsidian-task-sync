/**
 * TaskQueryService - Pure functions for querying and filtering tasks
 *
 * Provides stateless utility functions for searching, filtering, sorting,
 * and grouping tasks. These are pure functions with no side effects.
 *
 * Components can use these functions with $derived runes for reactive
 * computed values instead of creating derived stores.
 */

import type { Task } from "../core/entities";

/**
 * Filter criteria for tasks
 */
export interface TaskFilterCriteria {
  /** Filter by source extension ID */
  source?: string;

  /** Filter by status */
  status?: string;

  /** Filter by project */
  project?: string;

  /** Filter by area (task must have this area) */
  area?: string;

  /** Whether to show completed tasks */
  showCompleted?: boolean;

  /** Whether to show only scheduled tasks (tasks with doDate) */
  showScheduled?: boolean;
}

/**
 * Sort field and direction
 */
export interface TaskSortField {
  /** Field to sort by */
  field: keyof Task;

  /** Sort direction */
  direction: "asc" | "desc";
}

/**
 * TaskQueryService - Pure functions for task queries
 */
export class TaskQueryService {
  /**
   * Search tasks by query string
   * Searches in title, description, project, and areas
   *
   * @param tasks - Array of tasks to search
   * @param query - Search query string
   * @returns Filtered array of tasks matching the query
   */
  static search(tasks: readonly Task[], query: string): readonly Task[] {
    if (!query.trim()) {
      return tasks;
    }

    const lowerQuery = query.toLowerCase();

    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(lowerQuery) ||
        task.description?.toLowerCase().includes(lowerQuery) ||
        task.project?.toLowerCase().includes(lowerQuery) ||
        task.areas.some((area) => area.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Filter tasks by various criteria
   *
   * @param tasks - Array of tasks to filter
   * @param filters - Filter criteria
   * @returns Filtered array of tasks
   */
  static filter(
    tasks: readonly Task[],
    filters: TaskFilterCriteria
  ): readonly Task[] {
    return tasks.filter((task) => {
      // Filter by source
      if (filters.source && task.source?.extension !== filters.source) {
        return false;
      }

      // Filter by status
      if (filters.status && task.status !== filters.status) {
        return false;
      }

      // Filter by project
      if (filters.project && task.project !== filters.project) {
        return false;
      }

      // Filter by area
      if (filters.area && !task.areas.includes(filters.area)) {
        return false;
      }

      // Filter by completion status
      if (!filters.showCompleted && task.done) {
        return false;
      }

      // Filter by scheduled status (only show tasks with doDate if showScheduled is true)
      if (filters.showScheduled && !task.doDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Sort tasks by multiple fields
   *
   * @param tasks - Array of tasks to sort
   * @param sortBy - Array of sort fields (applied in order)
   * @returns Sorted array of tasks
   */
  static sort(
    tasks: readonly Task[],
    sortBy: TaskSortField[]
  ): readonly Task[] {
    return [...tasks].sort((a, b) => {
      for (const { field, direction } of sortBy) {
        const aVal = a[field];
        const bVal = b[field];

        let comparison = 0;

        // Handle null/undefined values
        if (aVal == null && bVal == null) {
          comparison = 0;
        } else if (aVal == null) {
          comparison = 1; // null sorts to end
        } else if (bVal == null) {
          comparison = -1; // null sorts to end
        } else if (aVal < bVal) {
          comparison = -1;
        } else if (aVal > bVal) {
          comparison = 1;
        }

        if (comparison !== 0) {
          return direction === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Get tasks grouped by source extension
   *
   * @param tasks - Array of tasks to group
   * @returns Map of source ID to tasks
   */
  static groupBySource(tasks: readonly Task[]): Map<string, Task[]> {
    const grouped = new Map<string, Task[]>();

    for (const task of tasks) {
      const sourceId = task.source?.extension || "unknown";
      if (!grouped.has(sourceId)) {
        grouped.set(sourceId, []);
      }
      grouped.get(sourceId)!.push(task);
    }

    return grouped;
  }

  /**
   * Get tasks for today (doDate is today)
   *
   * @param tasks - Array of tasks to filter
   * @returns Tasks scheduled for today
   */
  static getTodayTasks(tasks: readonly Task[]): readonly Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks.filter((task) => {
      if (!task.doDate) {
        return false;
      }

      const doDate = new Date(task.doDate);
      doDate.setHours(0, 0, 0, 0);

      return doDate >= today && doDate < tomorrow;
    });
  }

  /**
   * Get tasks by project
   *
   * @param tasks - Array of tasks to filter
   * @param projectName - Project name to filter by
   * @returns Tasks belonging to the project
   */
  static getTasksByProject(
    tasks: readonly Task[],
    projectName: string
  ): readonly Task[] {
    return tasks.filter((task) => task.project === projectName);
  }

  /**
   * Get tasks by area
   *
   * @param tasks - Array of tasks to filter
   * @param areaName - Area name to filter by
   * @returns Tasks belonging to the area
   */
  static getTasksByArea(
    tasks: readonly Task[],
    areaName: string
  ): readonly Task[] {
    return tasks.filter((task) => task.areas.includes(areaName));
  }

  /**
   * Get overdue tasks (dueDate is in the past and not done)
   *
   * @param tasks - Array of tasks to filter
   * @returns Overdue tasks
   */
  static getOverdueTasks(tasks: readonly Task[]): readonly Task[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return tasks.filter((task) => {
      if (!task.dueDate || task.done) {
        return false;
      }

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      return dueDate < now;
    });
  }

  /**
   * Get tasks by status
   *
   * @param tasks - Array of tasks to filter
   * @param status - Status to filter by
   * @returns Tasks with the specified status
   */
  static getTasksByStatus(
    tasks: readonly Task[],
    status: string
  ): readonly Task[] {
    return tasks.filter((task) => task.status === status);
  }

  /**
   * Get tasks by priority
   *
   * @param tasks - Array of tasks to filter
   * @param priority - Priority to filter by
   * @returns Tasks with the specified priority
   */
  static getTasksByPriority(
    tasks: readonly Task[],
    priority: string
  ): readonly Task[] {
    return tasks.filter((task) => task.priority === priority);
  }

  /**
   * Get incomplete tasks (not done)
   *
   * @param tasks - Array of tasks to filter
   * @returns Incomplete tasks
   */
  static getIncompleteTasks(tasks: readonly Task[]): readonly Task[] {
    return tasks.filter((task) => !task.done);
  }

  /**
   * Get completed tasks (done)
   *
   * @param tasks - Array of tasks to filter
   * @returns Completed tasks
   */
  static getCompletedTasks(tasks: readonly Task[]): readonly Task[] {
    return tasks.filter((task) => task.done);
  }

  /**
   * Find a task by ID
   *
   * @param tasks - Array of tasks to search
   * @param id - Task ID to find
   * @returns Task with the specified ID, or undefined if not found
   */
  static findById(tasks: readonly Task[], id: string): Task | undefined {
    return tasks.find((task) => task.id === id);
  }

  /**
   * Find a task by Obsidian file path
   *
   * @param tasks - Array of tasks to search
   * @param filePath - File path to find
   * @returns Task with the specified file path, or undefined if not found
   */
  static findByFilePath(
    tasks: readonly Task[],
    filePath: string
  ): Task | undefined {
    return tasks.find((task) => task.source?.keys?.obsidian === filePath);
  }

  /**
   * Find a task by source key for a specific extension
   *
   * @param tasks - Array of tasks to search
   * @param extension - Extension ID (e.g., "github", "obsidian")
   * @param key - Source key to find
   * @returns Task with the specified source key, or undefined if not found
   */
  static findBySourceKey(
    tasks: readonly Task[],
    extension: string,
    key: string
  ): Task | undefined {
    return tasks.find((task) => task.source?.keys?.[extension] === key);
  }

  /**
   * Find a task by GitHub URL (convenience method)
   *
   * @param tasks - Array of tasks to search
   * @param url - GitHub URL to find
   * @returns Task with the specified GitHub URL, or undefined if not found
   */
  static findBySourceUrl(
    tasks: readonly Task[],
    url: string
  ): Task | undefined {
    return tasks.find((task) => task.source?.keys?.github === url);
  }

  /**
   * Find a task by title
   *
   * @param tasks - Array of tasks to search
   * @param title - Task title to find
   * @returns Task with the specified title, or undefined if not found
   */
  static findByTitle(tasks: readonly Task[], title: string): Task | undefined {
    return tasks.find((task) => task.title === title);
  }
}
