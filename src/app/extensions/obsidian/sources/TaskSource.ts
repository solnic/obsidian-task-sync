/**
 * ObsidianTaskSource - Pure data source for Obsidian vault tasks
 *
 * Responsibilities:
 * - Scan vault for task files
 * - Parse task files into Task entities
 * - Watch for file changes and notify callbacks
 * - NO store manipulation - just pure data fetching
 *
 * This source provides tasks from the Obsidian vault by scanning the tasks folder
 * and parsing markdown files with task front-matter.
 */

import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { DataSource } from "../../../sources/DataSource";
import type { Task } from "../../../core/entities";
import type { TaskSyncSettings } from "../../../types/settings";
import { ObsidianTaskOperations } from "../operations/TaskOperations";
import { taskStore } from "../../../stores/taskStore";
import { get } from "svelte/store";
import { ObsidianTaskReconciler } from "../../../core/TaskReconciler";

/**
 * Task data without ID but with natural key for reconciliation
 * This is the format returned by scanExistingTasks before the store assigns IDs
 */
type TaskDataWithNaturalKey = Omit<Task, "id"> & { naturalKey: string };

/**
 * ObsidianTaskSource class
 *
 * Implements DataSource<Task> for Obsidian vault tasks
 */
export class ObsidianTaskSource implements DataSource<Task> {
  readonly id = "obsidian";
  readonly name = "Obsidian Vault";
  readonly reconciler = new ObsidianTaskReconciler();

  private taskOperations: ObsidianTaskOperations;

  constructor(private app: App, private settings: TaskSyncSettings) {
    this.taskOperations = new ObsidianTaskOperations(app, settings);
  }

  /**
   * Load initial data by scanning the vault for task files
   *
   * @returns Promise resolving to array of tasks (without IDs, with natural keys)
   *
   * Note: The returned tasks don't have IDs yet - they have naturalKey instead.
   * The store reducer will use the reconciler to match tasks and assign IDs.
   *
   * Type Safety: This method returns TaskDataWithNaturalKey[] but the interface
   * requires Task[]. This is intentional - the reconciler pattern expects tasks
   * without IDs and generates them during reconciliation. The type assertion is
   * safe because:
   * 1. The reducer calls reconciler.reconcileTask() for each task
   * 2. The reconciler generates IDs for tasks that don't have them
   * 3. The naturalKey is used for matching, then discarded
   * 4. The final tasks in the store always have valid IDs
   *
   * Alternative approaches considered:
   * - Changing DataSource<T> to DataSource<T, TPartial = T> would require updating
   *   all data sources and add complexity to the interface
   * - Creating a separate PartialTaskSource interface would fragment the architecture
   * - Current approach: Document the contract and use type assertion with clear explanation
   */
  async loadInitialData(): Promise<readonly Task[]> {
    console.log("[ObsidianTaskSource] Loading initial data...");

    // Scan existing task files in the vault
    // scanExistingTasks returns TaskDataWithNaturalKey (Omit<Task, "id"> & { naturalKey: string })
    const taskData: readonly TaskDataWithNaturalKey[] =
      await this.taskOperations.scanExistingTasks();

    console.log(
      `[ObsidianTaskSource] Loaded ${taskData.length} tasks from vault`
    );

    // Type assertion: TaskDataWithNaturalKey[] -> Task[]
    // Safe because reconciler.reconcileTask() generates IDs for tasks without them
    // See ObsidianTaskReconciler.reconcileTask() for ID generation logic
    // The reconciler is called by taskReducer for each task in LOAD_SOURCE_SUCCESS action
    return taskData as unknown as readonly Task[];
  }

  /**
   * Refresh data by re-scanning the vault
   *
   * @returns Promise resolving to array of tasks (without IDs, with natural keys)
   */
  async refresh(): Promise<readonly Task[]> {
    console.log("[ObsidianTaskSource] Refreshing data...");

    // Re-scan vault and return fresh data
    // This is the same as loadInitialData - we just re-scan everything
    return this.loadInitialData();
  }

  /**
   * Watch for file changes in the vault
   *
   * Sets up event listeners for file modifications, creations, and deletions
   * in the tasks folder. When changes are detected, triggers a full refresh
   * and calls the callback with updated data.
   *
   * @param callback - Function to call with updated tasks when changes are detected
   * @returns Cleanup function to stop watching
   */
  watch(_callback: (tasks: readonly Task[]) => void): () => void {
    console.log("[ObsidianTaskSource] Setting up file watchers...");

    const tasksFolder = this.settings.tasksFolder;

    // Helper to check if a file is in the tasks folder
    const isTaskFile = (file: any): boolean => {
      return file instanceof TFile && file.path.startsWith(tasksFolder + "/");
    };

    // Helper to handle individual file changes with UPSERT_TASK
    const handleFileChange = async (
      file: TFile,
      action: "create" | "modify"
    ) => {
      try {
        console.log(`[ObsidianTaskSource] Task file ${action}: ${file.path}`);

        // Parse the individual file
        const taskData = await this.taskOperations.parseFileToTaskData(file);
        if (taskData) {
          // Use UPSERT_TASK for individual file changes to preserve existing task metadata
          taskStore.dispatch({
            type: "UPSERT_TASK",
            taskData,
            reconciler: this.reconciler,
          });
          console.log(
            `[ObsidianTaskSource] Upserted task from ${file.path}: ${taskData.title}`
          );
        }
      } catch (error) {
        console.error(
          `[ObsidianTaskSource] Error handling ${action} for ${file.path}:`,
          error
        );
      }
    };

    // Helper to handle file deletion
    const handleFileDelete = async (file: TFile) => {
      try {
        console.log(`[ObsidianTaskSource] Task file deleted: ${file.path}`);

        // Find task by filePath and remove it
        const currentState = get(taskStore);
        const existingTask = currentState.tasks.find(
          (t) => t.source?.filePath === file.path
        );

        if (existingTask) {
          taskStore.dispatch({
            type: "REMOVE_TASK",
            taskId: existingTask.id,
          });
          console.log(
            `[ObsidianTaskSource] Removed task ${existingTask.id} for deleted file ${file.path}`
          );
        }
      } catch (error) {
        console.error(
          `[ObsidianTaskSource] Error handling deletion for ${file.path}:`,
          error
        );
      }
    };

    // Listen for file modifications (front-matter changes)
    const onModify = this.app.metadataCache.on("changed", async (file) => {
      if (isTaskFile(file)) {
        await handleFileChange(file, "modify");
      }
    });

    // Listen for file creations
    const onCreate = this.app.vault.on("create", async (file) => {
      if (file instanceof TFile && isTaskFile(file)) {
        await handleFileChange(file, "create");
      }
    });

    // Listen for file deletions
    const onDelete = this.app.vault.on("delete", async (file) => {
      if (file instanceof TFile && isTaskFile(file)) {
        await handleFileDelete(file);
      }
    });

    // Return cleanup function
    return () => {
      console.log("[ObsidianTaskSource] Cleaning up file watchers...");
      this.app.metadataCache.offref(onModify);
      this.app.vault.offref(onCreate);
      this.app.vault.offref(onDelete);
    };
  }
}
