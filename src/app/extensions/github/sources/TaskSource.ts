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

/**
 * GitHubTaskSource class
 *
 * Implements DataSource<Task> for GitHub imported tasks
 */
export class GitHubTaskSource implements DataSource<Task> {
  readonly id = "github";
  readonly name = "GitHub";

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
   *
   * For GitHub, refresh means returning the current state of imported tasks.
   * The actual import happens through the UI (user clicking "Import"),
   * so we just return the current state from the store.
   *
   * @returns Promise resolving to array of GitHub tasks
   */
  async refresh(): Promise<readonly Task[]> {
    console.log("[GitHubTaskSource] Refreshing data...");

    // For GitHub, refresh is the same as loadInitialData
    // We just return the current state of imported tasks
    return this.loadInitialData();
  }

  // No watch() method - GitHub is pull-based, not push-based
  // Changes come from user actions (importing issues), not external events
  // The store will be updated through the normal action dispatch flow
  // when users import GitHub issues/PRs
}

