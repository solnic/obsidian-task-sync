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
 * - Each source is authoritative for its own data
 * - Support both bulk refresh and incremental updates
 */

import type { Task } from "../core/entities";

/**
 * Callbacks for watching data source changes
 *
 * DataSources can notify about changes in two ways:
 * 1. Incremental updates (onItemChanged, onItemDeleted) - efficient for file-based sources
 * 2. Bulk refresh (onBulkRefresh) - for API-based sources that re-fetch everything
 *
 * @template T - The entity type
 */
export interface DataSourceWatchCallbacks<T> {
  /**
   * Called when a single item is created or updated
   * More efficient than bulk refresh for file-based sources
   *
   * @param item - The created or updated item
   */
  onItemChanged?: (item: T) => void;

  /**
   * Called when a single item is deleted
   * More efficient than bulk refresh for file-based sources
   *
   * @param itemId - The ID of the deleted item
   */
  onItemDeleted?: (itemId: string) => void;

  /**
   * Called when the entire dataset should be refreshed
   * Used by API-based sources that re-fetch everything on change
   *
   * @param items - All items from the source
   */
  onBulkRefresh?: (items: readonly T[]) => void;
}

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
   *
   * DataSources can use either incremental updates or bulk refresh:
   * - File-based sources (Obsidian): Use onItemChanged/onItemDeleted for efficiency
   * - API-based sources (GitHub): Use onBulkRefresh to re-fetch everything
   *
   * @param callbacks - Callbacks for different types of changes
   * @returns Cleanup function to stop watching
   */
  watch?(callbacks: DataSourceWatchCallbacks<T>): () => void;
}
