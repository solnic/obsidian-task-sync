/**
 * GitHubTaskSource - Pure data source for GitHub tasks
 *
 * Responsibilities:
 * - Return imported GitHub tasks from the store
 * - Provide refresh capability for GitHub tasks
 * - NO store manipulation - just pure data fetching
 *
 * This source provides tasks that have been imported from GitHub.
 * GitHub is a pull-based system - tasks are imported through user actions
 * (clicking "Import" in the UI), not through automatic watching.
 */

import type { DataSource } from "../../../sources/DataSource";
import type { Task } from "../../../core/entities";
import { taskStore } from "../../../stores/taskStore";
import { get } from "svelte/store";
import { SimpleTaskReconciler } from "../../../core/TaskReconciler";
import { taskSyncApp } from "../../../App";
import type { App, TFile } from "obsidian";

/**
 * GitHubTaskSource class
 *
 * Implements DataSource<Task> for GitHub imported tasks
 */
export class GitHubTaskSource implements DataSource<Task> {
  readonly id = "github";
  readonly name = "GitHub";
  readonly reconciler = new SimpleTaskReconciler();

  /**
   * Load initial data by returning imported GitHub tasks from the store
   *
   * @returns Promise resolving to array of GitHub tasks
   */
  async loadInitialData(): Promise<readonly Task[]> {
    console.log("[GitHubTaskSource] Loading initial data...");

    // Return only imported GitHub tasks from the store
    // GitHub tasks are those with source.extension === 'github'
    const state = get(taskStore);
    const githubTasks = state.tasks.filter(
      (task) => task.source?.extension === "github"
    );

    console.log(
      `[GitHubTaskSource] Loaded ${githubTasks.length} GitHub tasks from store`
    );

    return githubTasks;
  }

  /**
   * Refresh data by re-fetching imported GitHub tasks from the store
   * and syncing any changes from Obsidian files back to GitHub task data
   *
   * For GitHub, refresh means:
   * 1. Get current imported tasks from the store
   * 2. For tasks that have Obsidian files, check if the file has changes
   * 3. If changes exist, update the GitHub task data with file content
   * 4. Return the synchronized tasks
   *
   * @returns Promise resolving to array of GitHub tasks
   */
  async refresh(): Promise<readonly Task[]> {
    console.log(
      "[GitHubTaskSource] Refreshing data with bidirectional sync..."
    );

    // Get current imported tasks from the store
    const importedTasks = await this.loadInitialData();

    // For each imported task that has an Obsidian file, sync changes from the file
    const syncedTasks = await Promise.all(
      importedTasks.map(async (task) => {
        // Only sync tasks that have both GitHub and Obsidian keys
        if (task.source.keys.github && task.source.keys.obsidian) {
          return await this.syncTaskFromObsidianFile(task);
        }
        return task;
      })
    );

    console.log(`[GitHubTaskSource] Synced ${syncedTasks.length} tasks`);
    return syncedTasks;
  }

  /**
   * Sync a GitHub task with changes from its Obsidian file
   *
   * This method reads the current state of the Obsidian file and updates
   * the GitHub task data to reflect any changes made in the vault.
   *
   * @param task - The GitHub task to sync
   * @returns The task with updated data from the Obsidian file
   */
  private async syncTaskFromObsidianFile(task: Task): Promise<Task> {
    try {
      const obsidianPath = task.source.keys.obsidian;
      if (!obsidianPath) {
        return task;
      }

      // Get the Obsidian app instance
      const host = taskSyncApp.getHost();
      if (!host || !("app" in host)) {
        console.warn(
          "[GitHubTaskSource] No Obsidian app available for file sync"
        );
        return task;
      }

      const app = (host as any).app as App;
      const file = app.vault.getAbstractFileByPath(obsidianPath) as TFile;

      if (!file) {
        console.warn(`[GitHubTaskSource] File not found: ${obsidianPath}`);
        return task;
      }

      // Parse the file to get current task data
      const obsidianExtension = taskSyncApp.getExtensionById("obsidian");
      if (!obsidianExtension || !("taskOperations" in obsidianExtension)) {
        console.warn(
          "[GitHubTaskSource] Obsidian extension not available for file parsing"
        );
        return task;
      }

      const taskOperations = (obsidianExtension as any).taskOperations;
      const fileTaskData = await taskOperations.parseFileToTaskData(file);

      if (!fileTaskData) {
        console.warn(
          `[GitHubTaskSource] Could not parse task data from file: ${obsidianPath}`
        );
        return task;
      }

      // Merge the file data with the GitHub task, preserving GitHub source metadata
      const syncedTask = {
        ...task,
        // Update task properties from the file
        title: fileTaskData.title,
        description: fileTaskData.description,
        status: fileTaskData.status,
        priority: fileTaskData.priority,
        done: fileTaskData.done,
        category: fileTaskData.category,
        project: fileTaskData.project,
        areas: fileTaskData.areas,
        parentTask: fileTaskData.parentTask,
        doDate: fileTaskData.doDate,
        dueDate: fileTaskData.dueDate,
        tags: fileTaskData.tags,
        // Preserve GitHub source metadata but update timestamp
        source: {
          ...task.source,
          keys: {
            ...task.source.keys,
            obsidian: obsidianPath, // Ensure Obsidian key is current
          },
        },
        // Update timestamp to reflect the sync
        updatedAt: new Date(),
      };

      console.log(
        `[GitHubTaskSource] Synced task "${task.title}" from file ${obsidianPath}`
      );
      return syncedTask;
    } catch (error) {
      console.error(`[GitHubTaskSource] Failed to sync task from file:`, error);
      return task;
    }
  }

  // No watch() method - GitHub is pull-based, not push-based
  // Changes come from user actions (importing issues), not external events
  // The store will be updated through the normal action dispatch flow
  // when users import GitHub issues/PRs
}
