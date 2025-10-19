/**
 * SyncManager - Generic entity data merging pipeline
 *
 * This is a generic implementation for merging entity data across multiple sources.
 * The source extension (entity.source.extension) is the authoritative source.
 * Other sources provide additional data that gets merged into the authoritative source.
 *
 * Responsibilities:
 * - Detect entities that exist in multiple sources (have multiple source.keys)
 * - Merge entity data from different sources using a pipeline approach
 * - Apply conflict resolution strategies when data differs
 * - Maintain data integrity across sources
 */

import { get } from "svelte/store";
import { taskStore } from "../stores/taskStore";
import type { Task } from "./entities";

/**
 * Sync strategy for handling conflicts between data sources
 */
export type SyncStrategy =
  | "source-wins" // Source extension (creator) data takes precedence
  | "last-modified" // Most recently modified wins
  | "manual-resolve"; // Require manual conflict resolution

/**
 * Configuration for sync operations
 */
export interface SyncConfig {
  strategy: SyncStrategy;
}

/**
 * Interface for entity data providers that can read/write entity data
 */
export interface EntityDataProvider {
  /** Extension ID that owns this provider */
  extensionId: string;

  /** Read entity data from this provider's storage */
  readEntityData(entityId: string): Promise<Partial<Task> | null>;

  /** Write entity data to this provider's storage */
  writeEntityData(entityId: string, data: Partial<Task>): Promise<void>;

  /** Check if this provider can handle the given entity */
  canHandle(entity: Task): boolean;
}

/**
 * Result of a sync operation
 */
export interface EntitySyncResult {
  entityId: string;
  success: boolean;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    source: string;
  }>;
  errors: string[];
}

/**
 * SyncManager class
 *
 * Generic entity data merging pipeline that works with any entity type.
 * Uses registered data providers to read/write entity data from different sources.
 */
export class SyncManager {
  private config: SyncConfig;
  private providers = new Map<string, EntityDataProvider>();

  constructor(config: SyncConfig = { strategy: "source-wins" }) {
    this.config = config;
  }

  /**
   * Register an entity data provider for a specific extension
   */
  registerProvider(provider: EntityDataProvider): void {
    this.providers.set(provider.extensionId, provider);
  }

  /**
   * Unregister an entity data provider
   */
  unregisterProvider(extensionId: string): void {
    this.providers.delete(extensionId);
  }

  /**
   * Update sync configuration
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Sync all entities that exist in multiple sources
   * This should be called after any source refresh operation
   */
  async syncAllCrossSourceEntities(): Promise<EntitySyncResult[]> {
    console.log("[SyncManager] Starting cross-source entity sync...");

    const currentTasks = get(taskStore).tasks;
    const crossSourceTasks = this.findCrossSourceEntities(currentTasks);

    console.log(
      `[SyncManager] Found ${crossSourceTasks.length} cross-source entities`
    );

    const results: EntitySyncResult[] = [];

    for (const task of crossSourceTasks) {
      try {
        console.log(`[SyncManager] Syncing entity: ${task.title} (${task.id})`);
        const syncResult = await this.syncEntity(task);
        results.push(syncResult);

        if (syncResult.success) {
          console.log(
            `[SyncManager] Successfully synced entity: ${task.title}`
          );
        } else {
          console.log(
            `[SyncManager] Failed to sync entity: ${task.title}`,
            syncResult.errors
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[SyncManager] Error syncing entity ${task.title}:`,
          error
        );
        results.push({
          entityId: task.id,
          success: false,
          changes: [],
          errors: [errorMessage],
        });
      }
    }

    console.log(
      `[SyncManager] Cross-source sync completed: ${
        results.filter((r) => r.success).length
      } success, ${results.filter((r) => !r.success).length} failures`
    );

    return results;
  }

  /**
   * Sync a specific entity across all its sources
   */
  async syncEntity(entity: Task): Promise<EntitySyncResult> {
    const result: EntitySyncResult = {
      entityId: entity.id,
      success: false,
      changes: [],
      errors: [],
    };

    try {
      // Get all source keys for this entity
      const sourceKeys = Object.keys(entity.source.keys);

      if (sourceKeys.length < 2) {
        result.errors.push("Entity does not exist in multiple sources");
        return result;
      }

      // Read data from all sources
      const sourceData = new Map<string, Partial<Task>>();

      for (const sourceKey of sourceKeys) {
        const provider = this.providers.get(sourceKey);
        if (provider && provider.canHandle(entity)) {
          const data = await provider.readEntityData(entity.id);
          if (data) {
            sourceData.set(sourceKey, data);
          }
        }
      }

      // Merge data using the configured strategy
      const mergedData = this.mergeEntityData(entity, sourceData);

      // Write merged data back to all sources
      for (const [sourceKey, data] of sourceData) {
        const provider = this.providers.get(sourceKey);
        if (provider && provider.canHandle(entity)) {
          await provider.writeEntityData(entity.id, mergedData);

          // Track changes
          this.trackChanges(result, data, mergedData, sourceKey);
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Unknown sync error"
      );
    }

    return result;
  }

  /**
   * Find entities that exist in multiple sources (have multiple source.keys)
   */
  private findCrossSourceEntities(entities: readonly Task[]): Task[] {
    return entities.filter((entity) => {
      const sourceKeys = Object.keys(entity.source.keys);
      return sourceKeys.length > 1;
    });
  }

  /**
   * Merge entity data from multiple sources using the configured strategy
   */
  private mergeEntityData(
    entity: Task,
    sourceData: Map<string, Partial<Task>>
  ): Partial<Task> {
    switch (this.config.strategy) {
      case "source-wins":
        // Source extension (creator) data takes precedence
        const sourceExtension = entity.source.extension;
        const sourceData_priority = sourceData.get(sourceExtension);
        if (sourceData_priority) {
          return sourceData_priority;
        }
        // Fallback to first available data
        return sourceData.values().next().value || {};

      case "last-modified":
        // Most recently modified wins
        let latestData: Partial<Task> = {};
        let latestTime = 0;

        for (const data of sourceData.values()) {
          const modTime = data.updatedAt
            ? new Date(data.updatedAt).getTime()
            : 0;
          if (modTime > latestTime) {
            latestTime = modTime;
            latestData = data;
          }
        }
        return latestData;

      case "manual-resolve":
        // For now, just return the source extension data
        // In the future, this could trigger a UI for manual resolution
        const manualSourceData = sourceData.get(entity.source.extension);
        return manualSourceData || sourceData.values().next().value || {};

      default:
        return sourceData.values().next().value || {};
    }
  }

  /**
   * Track changes between old and new data
   */
  private trackChanges(
    result: EntitySyncResult,
    oldData: Partial<Task>,
    newData: Partial<Task>,
    source: string
  ): void {
    for (const [field, newValue] of Object.entries(newData)) {
      const oldValue = oldData[field as keyof Task];
      if (oldValue !== newValue) {
        result.changes.push({
          field,
          oldValue,
          newValue,
          source,
        });
      }
    }
  }
}

/**
 * Global sync manager instance
 */
export const syncManager = new SyncManager();
