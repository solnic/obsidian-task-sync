/**
 * Task Reconciliation Strategy Interface
 *
 * Defines how tasks from different sources should be reconciled when loading/refreshing.
 * Each extension can provide its own reconciliation strategy to handle source-specific
 * logic without coupling the reducer to specific extensions.
 *
 * Key Responsibilities:
 * - Determine which tasks to remove when new tasks arrive from a source
 * - Match incoming tasks with existing tasks in the store
 * - Merge new task data with existing task data, preserving important metadata
 */

import type { Task } from "./entities";

/**
 * Reconciliation strategy for handling task updates from a specific source
 */
export interface TaskReconciler {
  /**
   * Determines which tasks should be removed when new tasks arrive from this source
   *
   * This is called during LOAD_SOURCE_SUCCESS to filter out tasks that will be
   * replaced by the incoming tasks from the source.
   *
   * @param currentTasks - All tasks currently in the store
   * @param sourceId - The ID of the source providing new tasks
   * @returns Tasks that should be kept (not removed)
   */
  filterTasksOnRefresh(
    currentTasks: readonly Task[],
    sourceId: string
  ): readonly Task[];

  /**
   * Merges new task data with existing task data, preserving important metadata
   *
   * This is called for each incoming task to reconcile it with any existing task
   * in the store. The reconciler decides what metadata to preserve (ID, timestamps,
   * source information, etc.).
   *
   * @param existingTask - The task currently in the store (if it exists)
   * @param newTask - The new task data from the source
   * @returns The reconciled task
   */
  reconcileTask(existingTask: Task | undefined, newTask: Task): Task;

  /**
   * Identifies if a task belongs to this reconciler's source
   *
   * Used to find existing tasks that match new incoming tasks.
   * Different sources may use different matching strategies:
   * - File-based sources: match by filePath
   * - API-based sources: match by source URL or external ID
   * - Simple sources: match by task ID
   *
   * @param task - Existing task in the store
   * @param newTask - New incoming task
   * @returns True if the tasks match (represent the same entity)
   */
  matchesTask(task: Task, newTask: Task): boolean;
}

/**
 * Default reconciler for simple sources (GitHub, Linear, etc.)
 *
 * Strategy:
 * - Remove all tasks from the same source extension
 * - Replace them with new tasks
 * - Preserve ID and creation timestamp if task already exists
 * - Match tasks by source URL or ID
 *
 * This is appropriate for sources where:
 * - Tasks are uniquely identified by source URL or ID
 * - The source is the single source of truth for its tasks
 * - No complex metadata preservation is needed
 */
export class SimpleTaskReconciler implements TaskReconciler {
  /**
   * Remove all tasks from the same source extension
   */
  filterTasksOnRefresh(
    currentTasks: readonly Task[],
    sourceId: string
  ): readonly Task[] {
    return currentTasks.filter((t) => t.source?.extension !== sourceId);
  }

  /**
   * Preserve ID and creation timestamp, update everything else
   */
  reconcileTask(existingTask: Task | undefined, newTask: Task): Task {
    if (!newTask.id) {
      throw new Error("SimpleTaskReconciler: newTask must have an ID");
    }

    if (existingTask) {
      // Preserve ID and creation timestamp
      return {
        ...newTask,
        id: existingTask.id,
        createdAt: existingTask.createdAt,
        updatedAt: new Date(),
      };
    }

    // New task - use the ID from buildEntity
    return {
      ...newTask,
      updatedAt: new Date(),
    };
  }

  /**
   * Match by source URL if available, fallback to ID
   */
  matchesTask(task: Task, newTask: Task): boolean {
    // Match by source URL if both tasks have it
    if (task.source?.url && newTask.source?.url) {
      return task.source.url === newTask.source.url;
    }

    // Fallback to ID match
    return task.id === newTask.id;
  }
}

/**
 * Obsidian-specific reconciler for vault-backed tasks
 *
 * Strategy:
 * - Remove all vault-backed tasks (those with filePath)
 * - This includes GitHub tasks that were imported into the vault
 * - Preserve ID, createdAt, and critical source metadata
 * - Match tasks by filePath
 * - Preserve original extension (e.g., "github" for imported tasks)
 * - Preserve source URL and data (e.g., GitHub issue URL and data)
 *
 * This is appropriate for Obsidian because:
 * - The vault is the source of truth for all file-backed tasks
 * - GitHub tasks imported into vault should maintain their GitHub identity
 * - File path is the natural key for vault-backed tasks
 * - Source metadata must be preserved across vault scans
 */
export class ObsidianTaskReconciler implements TaskReconciler {
  /**
   * Remove all vault-backed tasks (those with filePath)
   *
   * This includes:
   * - Native Obsidian tasks (source.extension = "obsidian")
   * - Imported GitHub tasks (source.extension = "github" but have filePath)
   * - Any other tasks that have been persisted to the vault
   */
  filterTasksOnRefresh(
    currentTasks: readonly Task[],
    _sourceId: string
  ): readonly Task[] {
    // Remove all vault-backed tasks (those with filePath)
    // This includes GitHub tasks that were imported into the vault
    return currentTasks.filter((t) => !t.source?.filePath);
  }

  /**
   * Preserve ID, createdAt, and critical source metadata
   *
   * This is crucial for maintaining task identity and preserving
   * the original source information for imported tasks.
   *
   * For example, a GitHub task imported into the vault should:
   * - Keep its original ID
   * - Keep its creation timestamp
   * - Keep source.extension = "github" (not "obsidian")
   * - Keep source.url pointing to the GitHub issue
   * - Keep source.data with the GitHub issue data
   * - Keep source.imported flag
   * - Update source.filePath to the vault file path
   */
  reconcileTask(existingTask: Task | undefined, newTask: Task): Task {
    if (!newTask.id) {
      throw new Error("ObsidianTaskReconciler: newTask must have an ID");
    }

    if (existingTask) {
      // Preserve ID, createdAt, and critical source metadata
      return {
        ...newTask,
        id: existingTask.id,
        createdAt: existingTask.createdAt,
        updatedAt: new Date(),
        source: {
          ...newTask.source,
          // Preserve original extension (e.g., "github" for imported tasks)
          extension:
            existingTask.source?.extension || newTask.source?.extension,
          // Preserve source URL (e.g., GitHub issue URL)
          url: existingTask.source?.url || newTask.source?.url,
          // Preserve imported flag
          imported: existingTask.source?.imported ?? newTask.source?.imported,
          // Preserve source data (e.g., GitHub issue data)
          data: existingTask.source?.data || newTask.source?.data,
        },
      };
    }

    // New task from vault - use the ID from buildEntity
    return {
      ...newTask,
      updatedAt: new Date(),
    };
  }

  /**
   * Match tasks by ID, filePath, or URL
   *
   * Matching strategy:
   * 1. By ID - if both tasks have the same ID (primary match)
   * 2. By filePath - if both tasks have the same filePath (vault-backed tasks)
   * 3. By URL - if both tasks have the same source URL (external tasks)
   *
   * This ensures that:
   * - Tasks imported from external sources (GitHub) preserve their source.extension
   * - Tasks are correctly reconciled after plugin reload
   * - Duplicate tasks are avoided when scanning the vault
   */
  matchesTask(task: Task, newTask: Task): boolean {
    return (
      task.id == newTask.id ||
      (task.source?.filePath &&
        newTask.source?.filePath &&
        task.source.filePath == newTask.source.filePath) ||
      (task.source?.url &&
        newTask.source?.url &&
        task.source.url == newTask.source.url)
    );
  }
}
