/**
 * Base class for Task data sources
 *
 * Provides common functionality for task-specific data sources.
 * Concrete implementations should extend this class and implement the abstract methods.
 */

import type { Task } from "../core/entities";
import type { DataSource, DataSourceWatchCallbacks } from "./DataSource";

/**
 * Abstract base class for Task data sources
 *
 * Provides a foundation for implementing task-specific data sources
 * with common functionality and type safety.
 */
export abstract class TaskDataSource implements DataSource<Task> {
  /**
   * Unique identifier for this data source
   */
  abstract readonly id: string;

  /**
   * Human-readable name for this data source
   */
  abstract readonly name: string;

  /**
   * Load initial task data from the source
   * Must be implemented by concrete classes
   */
  abstract loadInitialData(): Promise<readonly Task[]>;

  /**
   * Refresh task data from the source
   * Must be implemented by concrete classes
   */
  abstract refresh(): Promise<readonly Task[]>;

  /**
   * Optional: Watch for external changes to tasks
   * Can be implemented by concrete classes if the source supports watching
   *
   * Supports both incremental updates and bulk refresh patterns.
   */
  watch?(callbacks: DataSourceWatchCallbacks<Task>): () => void;

  /**
   * Helper method to filter tasks by source extension
   * Useful for sources that need to identify their own tasks
   *
   * @param tasks - Array of tasks to filter
   * @param extensionId - Extension ID to filter by
   * @returns Filtered array of tasks
   */
  protected filterBySource(
    tasks: readonly Task[],
    extensionId: string
  ): readonly Task[] {
    return tasks.filter((task) => task.source.extension === extensionId);
  }

  /**
   * Helper method to validate that all tasks have required properties
   * Throws an error if any task is invalid
   *
   * @param tasks - Array of tasks to validate
   * @throws Error if any task is missing required properties
   */
  protected validateTasks(tasks: readonly Task[]): void {
    for (const task of tasks) {
      if (!task.id) {
        throw new Error("Task missing required property: id");
      }
      if (!task.title) {
        throw new Error(`Task ${task.id} missing required property: title`);
      }
      if (!task.createdAt) {
        throw new Error(`Task ${task.id} missing required property: createdAt`);
      }
      if (!task.updatedAt) {
        throw new Error(`Task ${task.id} missing required property: updatedAt`);
      }
    }
  }
}
