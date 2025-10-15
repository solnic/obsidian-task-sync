/**
 * DataSource interface for pure data providers
 *
 * DataSources are responsible for fetching and watching data from external systems.
 * They do NOT manipulate stores directly - that's the job of the SourceManager.
 *
 * Key principles:
 * - Pure data fetching - no store manipulation
 * - No UI concerns - just data
 * - Optional watching for external changes
 * - Return readonly arrays to prevent accidental mutations
 * - Provide reconciliation strategy for merging data
 */

import type { TaskReconciler } from "../core/TaskReconciler";
import type { Task } from "../core/entities";

/**
 * Generic DataSource interface for any entity type
 *
 * @template T - The entity type this source provides (Task, Project, Area, etc.)
 */
export interface DataSource<T> {
  /**
   * Unique identifier for this data source
   * Examples: 'obsidian', 'github', 'linear'
   */
  readonly id: string;

  /**
   * Human-readable name for this data source
   * Examples: 'Obsidian Vault', 'GitHub', 'Linear'
   */
  readonly name: string;

  /**
   * Reconciliation strategy for this data source
   *
   * Only applicable for Task data sources. For other entity types, this will be undefined.
   * The reconciler defines how tasks from this source should be merged with existing tasks.
   */
  readonly reconciler?: T extends Task ? TaskReconciler : never;

  /**
   * Load initial data from the source
   * Called once during initialization
   *
   * @returns Promise resolving to readonly array of entities
   */
  loadInitialData(): Promise<readonly T[]>;

  /**
   * Refresh data from the source
   * Called when user explicitly requests a refresh
   *
   * @returns Promise resolving to readonly array of entities
   */
  refresh(): Promise<readonly T[]>;

  /**
   * Optional: Watch for external changes to the data
   * If implemented, the callback will be invoked whenever the source detects changes
   *
   * @param callback - Function to call with updated data when changes are detected
   * @returns Cleanup function to stop watching
   */
  watch?(callback: (items: readonly T[]) => void): () => void;
}
