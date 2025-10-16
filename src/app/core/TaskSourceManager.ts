/**
 * TaskSourceManager - Coordinates data sources and store updates
 *
 * Responsibilities:
 * - Register and manage task data sources
 * - Load data from sources and dispatch to store
 * - Coordinate refresh operations
 * - Set up watchers for external changes
 *
 * This is the bridge between DataSources (pure data providers) and
 * the Store (state management). Sources don't know about stores,
 * and stores don't know about sources - the manager coordinates.
 */

import type { DataSource } from "../sources/DataSource";
import type { Task } from "./entities";
import { taskStore } from "../stores/taskStore";

/**
 * TaskSourceManager class
 *
 * Manages task data sources and coordinates loading/refreshing
 */
export class TaskSourceManager {
  /** Registered data sources by ID */
  private sources = new Map<string, DataSource<Task>>();

  /** Active watchers by source ID */
  private watchers = new Map<string, () => void>();

  /**
   * Register a task data source
   *
   * Sets up watching if the source supports it. The source can notify about changes
   * in two ways:
   * 1. Incremental updates (onItemChanged, onItemDeleted) - efficient for file-based sources
   * 2. Bulk refresh (onBulkRefresh) - for API-based sources that re-fetch everything
   *
   * @param source - The data source to register
   */
  registerSource(source: DataSource<Task>): void {
    this.sources.set(source.id, source);

    // Set up watching if supported
    if (source.watch) {
      if (!source.reconciler) {
        throw new Error(`Source ${source.id} must provide a reconciler`);
      }

      const unwatch = source.watch({
        // Incremental update: single item changed
        onItemChanged: (task) => {
          console.log(
            `[TaskSourceManager] Item changed from ${source.id}: ${task.id}`
          );
          taskStore.dispatch({
            type: "UPSERT_TASK",
            taskData: task,
            reconciler: source.reconciler!,
          });
        },

        // Incremental update: single item deleted
        onItemDeleted: (taskId) => {
          console.log(
            `[TaskSourceManager] Item deleted from ${source.id}: ${taskId}`
          );
          taskStore.dispatch({
            type: "REMOVE_TASK",
            taskId,
          });
        },

        // Bulk refresh: entire dataset replaced
        onBulkRefresh: (tasks) => {
          console.log(
            `[TaskSourceManager] Bulk refresh from ${source.id}: ${tasks.length} tasks`
          );
          taskStore.dispatch({
            type: "LOAD_SOURCE_SUCCESS",
            sourceId: source.id,
            tasks,
            reconciler: source.reconciler!,
          });
        },
      });

      this.watchers.set(source.id, unwatch);
    }
  }

  /**
   * Unregister a task data source
   *
   * @param sourceId - ID of the source to unregister
   */
  unregisterSource(sourceId: string): void {
    // Clean up watcher
    const unwatch = this.watchers.get(sourceId);
    if (unwatch) {
      unwatch();
      this.watchers.delete(sourceId);
    }

    this.sources.delete(sourceId);
  }

  /**
   * Load initial data from a source
   *
   * @param sourceId - ID of the source to load
   */
  async loadSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (!source.reconciler) {
      throw new Error(`Source ${sourceId} must provide a reconciler`);
    }

    try {
      taskStore.dispatch({ type: "LOAD_SOURCE_START", sourceId });
      const tasks = await source.loadInitialData();
      taskStore.dispatch({
        type: "LOAD_SOURCE_SUCCESS",
        sourceId,
        tasks,
        reconciler: source.reconciler,
      });
    } catch (error: any) {
      taskStore.dispatch({
        type: "LOAD_SOURCE_ERROR",
        sourceId,
        error: error.message || "Unknown error loading source",
      });
      throw error;
    }
  }

  /**
   * Refresh data from a source
   *
   * @param sourceId - ID of the source to refresh
   */
  async refreshSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (!source.reconciler) {
      throw new Error(`Source ${sourceId} must provide a reconciler`);
    }

    try {
      taskStore.dispatch({ type: "LOAD_SOURCE_START", sourceId });
      const tasks = await source.refresh();
      taskStore.dispatch({
        type: "LOAD_SOURCE_SUCCESS",
        sourceId,
        tasks,
        reconciler: source.reconciler,
      });
    } catch (error: any) {
      taskStore.dispatch({
        type: "LOAD_SOURCE_ERROR",
        sourceId,
        error: error.message || "Unknown error refreshing source",
      });
      throw error;
    }
  }

  /**
   * Refresh all registered sources
   */
  async refreshAll(): Promise<void> {
    const refreshPromises = Array.from(this.sources.keys()).map((id) =>
      this.refreshSource(id).catch((error) => {
        console.error(`Failed to refresh source ${id}:`, error);
        // Don't throw - allow other sources to continue refreshing
      })
    );

    await Promise.all(refreshPromises);
  }

  /**
   * Get a registered source by ID
   *
   * @param sourceId - ID of the source to get
   * @returns The data source, or undefined if not found
   */
  getSource(sourceId: string): DataSource<Task> | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Get all registered source IDs
   *
   * @returns Array of source IDs
   */
  getSourceIds(): string[] {
    return Array.from(this.sources.keys());
  }

  /**
   * Check if a source is registered
   *
   * @param sourceId - ID of the source to check
   * @returns True if the source is registered
   */
  hasSource(sourceId: string): boolean {
    return this.sources.has(sourceId);
  }
}

/**
 * Global TaskSourceManager instance
 *
 * Usage:
 * - Register: taskSourceManager.registerSource(source)
 * - Load: await taskSourceManager.loadSource('obsidian')
 * - Refresh: await taskSourceManager.refreshSource('obsidian')
 * - Refresh all: await taskSourceManager.refreshAll()
 */
export const taskSourceManager = new TaskSourceManager();
