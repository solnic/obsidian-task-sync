/**
 * LocalTasks service class
 * Handles local task operations with extension delegation
 */

import { Task } from "../core/entities";
import { taskStore } from "../stores/taskStore";

export interface TaskExtension {
  scanExistingTasks(): Promise<
    Array<Omit<Task, "id"> & { naturalKey: string }>
  >;
}

export class LocalTasksService {
  private extension: TaskExtension | null = null;

  constructor(extension?: TaskExtension) {
    this.extension = extension || null;
  }

  /**
   * Set the extension that will handle the actual task operations
   */
  setExtension(extension: TaskExtension): void {
    this.extension = extension;
  }

  /**
   * Refresh tasks by delegating to the injected extension
   * Preserves existing task IDs to maintain consistency
   */
  async refresh(): Promise<void> {
    if (!this.extension) {
      throw new Error("No extension available for refresh operation");
    }

    try {
      taskStore.setLoading(true);
      taskStore.setError(null);

      console.log("Refreshing local tasks via extension...");

      // Get current tasks to identify which ones to remove (no longer exist in files)
      const currentState = await new Promise((resolve) => {
        let unsubscribe: (() => void) | undefined;
        unsubscribe = taskStore.subscribe((state) => {
          resolve(state);
          if (unsubscribe) unsubscribe();
        });
      });

      const currentTasks = (currentState as any).tasks;

      // Delegate to extension to get fresh task data (without IDs)
      const freshTasksData = await this.extension.scanExistingTasks();
      console.log(`Refresh found ${freshTasksData.length} tasks`);

      // Create a set of natural keys from fresh data to identify removed tasks
      const freshNaturalKeys = new Set(
        freshTasksData.map((taskData) => taskData.naturalKey)
      );

      // Remove tasks that no longer exist in the file system
      for (const task of currentTasks) {
        if (
          task.source?.extension === "obsidian" &&
          task.source?.filePath &&
          !freshNaturalKeys.has(task.source.filePath)
        ) {
          console.log(
            `Removing deleted task: ${task.title} (${task.source.filePath})`
          );
          taskStore.removeTask(task.id);
        }
      }

      // Upsert fresh tasks - store will handle ID generation/preservation
      for (const taskData of freshTasksData) {
        taskStore.upsertTask(taskData);
      }

      taskStore.setLoading(false);
      console.log("Refresh completed successfully");
    } catch (err: any) {
      console.error("Failed to refresh tasks:", err);
      taskStore.setError(err.message);
      taskStore.setLoading(false);
      throw err;
    }
  }

  /**
   * Get all local tasks from the store
   */
  async getAllTasks(): Promise<readonly Task[]> {
    return new Promise((resolve) => {
      const unsubscribe = taskStore.subscribe((state) => {
        resolve(state.tasks);
        unsubscribe();
      });
    });
  }

  /**
   * Get tasks by extension ID
   */
  async getTasksByExtension(extensionId: string): Promise<readonly Task[]> {
    return new Promise((resolve) => {
      const unsubscribe = taskStore.subscribe((state) => {
        const tasks = state.tasks.filter(
          (t) => t.source?.extension === extensionId
        );
        resolve(tasks);
        unsubscribe();
      });
    });
  }
}
