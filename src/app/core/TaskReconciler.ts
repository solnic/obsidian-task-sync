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
 * Helper function to check if two tasks have meaningful differences
 * Ignores updatedAt timestamp to avoid false positives
 * Returns true if tasks are different, false if they are the same
 */
function hasTaskChanged(existingTask: Task, newTask: Task): boolean {
  // Compare all fields except updatedAt and id
  const fieldsToCompare: (keyof Task)[] = [
    "title",
    "description",
    "status",
    "done",
    "category",
    "priority",
    "parentTask",
    "project",
  ];

  for (const field of fieldsToCompare) {
    const existingValue = existingTask[field];
    const newValue = newTask[field];

    // Handle null/undefined as equivalent
    if (
      (existingValue === null || existingValue === undefined) &&
      (newValue === null || newValue === undefined)
    ) {
      continue;
    }

    // Simple equality check
    if (existingValue !== newValue) return true;
  }

  // Check arrays
  if (existingTask.areas.length !== newTask.areas.length) return true;
  if (!existingTask.areas.every((val, idx) => val === newTask.areas[idx]))
    return true;

  if (existingTask.tags.length !== newTask.tags.length) return true;
  if (!existingTask.tags.every((val, idx) => val === newTask.tags[idx]))
    return true;

  // Check dates
  const existingDoDate = existingTask.doDate?.getTime();
  const newDoDate = newTask.doDate?.getTime();
  if (existingDoDate !== newDoDate) return true;

  const existingDueDate = existingTask.dueDate?.getTime();
  const newDueDate = newTask.dueDate?.getTime();
  if (existingDueDate !== newDueDate) return true;

  return false;
}

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
   * Only update updatedAt if task data actually changed
   */
  reconcileTask(existingTask: Task | undefined, newTask: Task): Task {
    if (!newTask.id) {
      throw new Error("SimpleTaskReconciler: newTask must have an ID");
    }

    if (existingTask) {
      // Check if task data actually changed
      const taskChanged = hasTaskChanged(existingTask, newTask);

      // Preserve ID and creation timestamp
      return {
        ...newTask,
        id: existingTask.id,
        createdAt: existingTask.createdAt,
        // Only update timestamp if data changed
        updatedAt: taskChanged ? new Date() : existingTask.updatedAt,
      };
    }

    // New task - use the ID and timestamp from buildEntity
    return newTask;
  }

  /**
   * Match by source key for the extension or ID
   *
   * Note: This reconciler is used by extensions like GitHub.
   * The sourceId should be passed from the extension (e.g., "github")
   * to match against the appropriate key in source.keys
   */
  matchesTask(task: Task, newTask: Task): boolean {
    // Try to match by extension-specific key
    // For GitHub: source.keys.github
    const extension = newTask.source?.extension;
    if (extension) {
      const existingKey = task.source?.keys?.[extension];
      const newKey = newTask.source?.keys?.[extension];
      if (existingKey && newKey) {
        return existingKey === newKey;
      }
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
    // Remove all vault-backed tasks (those with Obsidian key)
    // This includes GitHub tasks that were imported into the vault
    return currentTasks.filter((t) => !t.source?.keys?.obsidian);
  }

  /**
   * Preserve ID, createdAt, and critical source metadata
   * Only update updatedAt if task data actually changed
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
      // Check if task data actually changed
      const taskChanged = hasTaskChanged(existingTask, newTask);

      // Preserve ID, createdAt, and critical source metadata
      return {
        ...newTask,
        id: existingTask.id,
        createdAt: existingTask.createdAt,
        // Only update timestamp if data changed
        updatedAt: taskChanged ? new Date() : existingTask.updatedAt,
        source: {
          ...newTask.source,
          // Preserve original extension (e.g., "github" for imported tasks)
          extension: existingTask.source.extension || newTask.source.extension,
          // Merge keys from both existing and new task
          keys: {
            ...existingTask.source.keys,
            ...newTask.source.keys,
          },
          // Preserve source data (e.g., GitHub issue data)
          data: existingTask.source.data || newTask.source.data,
        },
      };
    }

    // New task from vault - use the ID and timestamp from buildEntity
    return newTask;
  }

  /**
   * Match tasks by ID or Obsidian natural key
   *
   * Matching strategy:
   * 1. By ID - if both tasks have the same ID (primary match)
   * 2. By Obsidian key - if both tasks have the same source.keys.obsidian (vault-backed tasks)
   *
   * This ensures that:
   * - Tasks imported from external sources (GitHub) preserve their source.extension
   * - Tasks are correctly reconciled after plugin reload
   * - Duplicate tasks are avoided when scanning the vault
   */
  matchesTask(task: Task, newTask: Task): boolean {
    const existingKey = task.source?.keys?.obsidian;
    const newKey = newTask.source?.keys?.obsidian;

    return (
      task.id == newTask.id || (existingKey && newKey && existingKey === newKey)
    );
  }
}
