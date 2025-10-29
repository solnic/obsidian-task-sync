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
import { projectStore } from "../stores/projectStore";
import { areaStore } from "../stores/areaStore";
import { taskSyncApp } from "../App";
import { get } from "svelte/store";
import { syncManager } from "./SyncManager";

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

  constructor() {
    // SyncManager is now generic and doesn't need dependencies
    // Data providers will be registered by extensions as they initialize
  }

  /**
   * Register a task data source
   *
   * NOTE: This only registers the source. Watchers are NOT set up until loadSource()
   * is called. This prevents watchers from triggering during initial data load.
   *
   * @param source - The data source to register
   */
  registerSource(source: DataSource<Task>): void {
    this.sources.set(source.id, source);
  }

  /**
   * Get list of registered source IDs
   */
  getRegisteredSources(): string[] {
    return Array.from(this.sources.keys());
  }

  /**
   * Set up watcher for a registered source
   *
   * This is called automatically by loadSource() after initial data is loaded.
   * The source can notify about changes in two ways:
   * 1. Incremental updates (onItemChanged, onItemDeleted) - efficient for file-based sources
   * 2. Bulk refresh (onBulkRefresh) - for API-based sources that re-fetch everything
   *
   * @param sourceId - ID of the source to watch
   */
  private setupWatcher(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source || !source.watch) {
      return;
    }

    // Don't set up watcher if already watching
    if (this.watchers.has(sourceId)) {
      return;
    }

    console.log(`[TaskSourceManager] Setting up watcher for ${sourceId}...`);

    const unwatch = source.watch({
      // Incremental update: single item changed
      onItemChanged: (task) => {
        console.log(
          `[TaskSourceManager] Item changed from ${sourceId}: ${task.id}`
        );
        taskStore.dispatch({
          type: "UPSERT_TASK",
          taskData: task,
        });
      },

      // Incremental update: single item deleted
      onItemDeleted: (taskId) => {
        console.log(
          `[TaskSourceManager] Item deleted from ${sourceId}: ${taskId}`
        );
        taskStore.dispatch({
          type: "REMOVE_TASK",
          taskId,
        });
      },

      // Bulk refresh: entire dataset replaced
      onBulkRefresh: (tasks) => {
        console.log(
          `[TaskSourceManager] Bulk refresh from ${sourceId}: ${tasks.length} tasks`
        );
        taskStore.dispatch({
          type: "LOAD_SOURCE_SUCCESS",
          sourceId: sourceId,
          tasks,
        });
      },
    });

    this.watchers.set(sourceId, unwatch);
    console.log(`[TaskSourceManager] Watcher set up for ${sourceId}`);
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
   * Sets up the watcher AFTER initial data is loaded to prevent watchers from
   * triggering during the initial scan and causing spurious updatedAt changes.
   *
   * @param sourceId - ID of the source to load
   */
  async loadSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    try {
      taskStore.dispatch({ type: "LOAD_SOURCE_START", sourceId });
      const tasks = await source.loadInitialData();
      taskStore.dispatch({
        type: "LOAD_SOURCE_SUCCESS",
        sourceId,
        tasks,
      });

      // Set up watcher AFTER initial load completes
      // This prevents watchers from triggering during initial scan
      this.setupWatcher(sourceId);
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

    try {
      taskStore.dispatch({ type: "LOAD_SOURCE_START", sourceId });
      const tasks = await source.refresh();
      taskStore.dispatch({
        type: "LOAD_SOURCE_SUCCESS",
        sourceId,
        tasks,
      });

      // Set up watcher if not already watching
      // This ensures watchers are set up even when using refreshSource instead of loadSource
      this.setupWatcher(sourceId);

      // Automatically sync after successful refresh
      await this.syncSourceData(sourceId);

      // Perform cross-source sync for entities that exist in multiple sources
      console.log(
        `[TaskSourceManager] About to call SyncManager for ${sourceId} refresh...`
      );
      await syncManager.syncAllCrossSourceEntities();
      console.log(
        `[TaskSourceManager] SyncManager completed for ${sourceId} refresh`
      );
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
   * Sync loaded data with persisted storage after a source refresh
   *
   * This method reconciles the current store state (after LOAD_SOURCE_SUCCESS)
   * with the persisted data to ensure consistency. It handles cases where:
   * - External changes occurred while the app was running
   * - Data was modified outside the app
   * - Multiple sources need to be kept in sync
   *
   * @param sourceId - ID of the source that was refreshed
   */
  async syncSourceData(sourceId: string): Promise<void> {
    try {
      console.log(`[TaskSourceManager] Syncing data for source: ${sourceId}`);

      // Get current tasks from store (after reducer processed new data)
      const storeState = get(taskStore);

      // Get persisted tasks from host storage
      const host = taskSyncApp.getHost();
      if (!host) {
        console.warn(`[TaskSourceManager] No host available for sync`);
        return;
      }

      const persistedData = await host.loadData();
      const persistedTasks = persistedData?.tasks || [];

      console.log(
        `[TaskSourceManager] Current store has ${storeState.tasks.length} tasks`
      );
      console.log(
        `[TaskSourceManager] Persisted storage has ${persistedTasks.length} tasks`
      );

      // For now, we trust the store state as authoritative after refresh
      // The store has already reconciled the fresh source data with existing data
      // We just need to persist the current state
      const data = {
        tasks: storeState.tasks,
        projects: get(projectStore).projects,
        areas: get(areaStore).areas,
        lastSync: new Date().toISOString(),
      };

      await host.saveData(data);
      console.log(`[TaskSourceManager] Sync completed for source: ${sourceId}`);
    } catch (error: any) {
      console.error(
        `[TaskSourceManager] Failed to sync data for source ${sourceId}:`,
        error
      );
      // Don't throw - sync failure shouldn't break the refresh operation
    }
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
