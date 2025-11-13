/**
 * CalendarTaskSource - Data source implementation for calendar tasks
 * Maps calendar events to task entities
 */

import { get } from "svelte/store";
import type { Task } from "../../../core/entities";
import type { DataSource } from "../../../sources/DataSource";
import type { CalendarExtension } from "../CalendarExtension";

/**
 * CalendarTaskSource class
 *
 * Implements DataSource<Task> for calendar tasks (events mapped to tasks)
 */
export class CalendarTaskSource implements DataSource<Task> {
  readonly id = "calendar";
  readonly name = "Calendar";

  private calendarExtension: CalendarExtension;

  constructor(calendarExtension: CalendarExtension) {
    this.calendarExtension = calendarExtension;
  }

  /**
   * Load initial data by returning tasks from the extension's entity store
   *
   * The extension's entity store contains calendar events that have been
   * mapped to task entities.
   *
   * @returns Promise resolving to array of calendar tasks
   */
  async loadInitialData(): Promise<readonly Task[]> {
    console.log("[CalendarTaskSource] loadInitialData called");

    // Get tasks from the extension's entity store
    const entityStore = this.calendarExtension.getEntityStore();
    const tasks = get(entityStore);

    console.log(`[CalendarTaskSource] Loaded ${tasks.length} tasks from entity store`);

    return tasks;
  }

  /**
   * Refresh data by fetching fresh calendar data from services
   *
   * For calendar, refresh means:
   * 1. Fetch fresh calendar events from enabled calendar services
   * 2. Transform events to task entities
   * 3. Update the extension's entity store
   *
   * @returns Promise resolving to array of refreshed calendar tasks
   */
  async refresh(): Promise<readonly Task[]> {
    console.log("[CalendarTaskSource] refresh called");

    try {
      // Trigger the extension's refresh to fetch latest events
      await this.calendarExtension.refresh();

      // Return the updated tasks from entity store
      const entityStore = this.calendarExtension.getEntityStore();
      const tasks = get(entityStore);

      console.log(`[CalendarTaskSource] Refreshed ${tasks.length} tasks`);

      return tasks;
    } catch (error) {
      console.error("[CalendarTaskSource] Failed to refresh calendar data:", error);
      throw error;
    }
  }

  /**
   * Apply filters to tasks (delegated to extension)
   *
   * @param tasks - Tasks to filter
   * @param criteria - Filter criteria
   * @returns Filtered tasks
   */
  filter(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
      calendarId?: string | null;
    }
  ): readonly Task[] {
    return this.calendarExtension.filterTasks(tasks, criteria);
  }

  /**
   * Search tasks by query (delegated to extension)
   *
   * @param query - Search query
   * @param tasks - Tasks to search
   * @returns Matching tasks
   */
  search(query: string, tasks: readonly Task[]): readonly Task[] {
    return this.calendarExtension.searchTasks(query, tasks);
  }

  /**
   * Sort tasks (delegated to extension)
   *
   * @param tasks - Tasks to sort
   * @param sortFields - Sort fields
   * @returns Sorted tasks
   */
  sort(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    return this.calendarExtension.sortTasks(tasks, sortFields);
  }
}
