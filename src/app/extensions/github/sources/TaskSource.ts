/**
 * GitHubTaskSource - Pure data source for GitHub tasks
 *
 * Responsibilities:
 * - Fetch fresh GitHub data from API during refresh
 * - Transform GitHub issues/PRs into tasks
 * - Return imported GitHub tasks from the store during initial load
 * - NO store manipulation - just pure data fetching
 *
 * This source provides tasks from GitHub API. During refresh, it fetches
 * fresh data from GitHub API based on current filters and transforms
 * issues/PRs into tasks. GitHub is the authoritative source during refresh.
 */

import type { DataSource } from "../../../sources/DataSource";
import type { Task } from "../../../core/entities";
import { taskStore } from "../../../stores/taskStore";
import { get } from "svelte/store";

import type { GitHubExtension } from "../GitHubExtension";
import type {
  GitHubIssue,
  GitHubPullRequest,
} from "../../../cache/schemas/github";
import { extractRepositoryFromGitHubUrl } from "../utils/GitHubUrlUtils";

/**
 * Filter parameters for GitHub data fetching
 */
export interface GitHubSourceFilters {
  repository: string | null;
  type: "issues" | "pull-requests";
}

/**
 * GitHubTaskSource class
 *
 * Implements DataSource<Task> for GitHub tasks
 */
export class GitHubTaskSource implements DataSource<Task> {
  readonly id = "github";
  readonly name = "GitHub";

  private githubExtension: GitHubExtension;

  constructor(githubExtension: GitHubExtension) {
    this.githubExtension = githubExtension;
  }

  /**
   * Load initial data by returning imported GitHub tasks from the store
   *
   * @returns Promise resolving to array of GitHub tasks
   */
  async loadInitialData(): Promise<readonly Task[]> {
    console.log("[GitHubTaskSource] Loading initial data...");

    // Return imported GitHub tasks from the main task store
    // These are tasks that have source.extension = "github"
    const storeState = get(taskStore);
    const githubTasks = storeState.tasks.filter(
      (task) => task.source.extension === "github"
    );

    console.log(
      `[GitHubTaskSource] Returning ${githubTasks.length} imported GitHub tasks from main taskStore`
    );

    return githubTasks;
  }

  /**
   * Refresh data by fetching fresh GitHub data from API
   *
   * For GitHub, refresh means:
   * 1. Get current filters from the extension
   * 2. Fetch fresh data from GitHub API based on filters
   * 3. Transform GitHub items into tasks
   * 4. Update extension's entity store with fresh tasks
   *
   * This makes GitHub the authoritative source during refresh.
   * The SyncManager will handle merging with other sources.
   *
   * @returns Promise resolving to array of GitHub tasks
   */
  async refresh(): Promise<readonly Task[]> {
    console.log("[GitHubTaskSource] Refreshing GitHub tasks from API...");

    // Get current filters from the extension
    const filters = this.githubExtension.getCurrentFilters();

    if (!filters.repository) {
      console.log(
        "[GitHubTaskSource] No repository selected, returning imported tasks only"
      );
      return this.loadInitialData();
    }

    try {
      // Fetch fresh data from GitHub API
      const githubItems =
        filters.type === "issues"
          ? await this.githubExtension.fetchIssues(filters.repository)
          : await this.githubExtension.fetchPullRequests(filters.repository);

      console.log(
        `[GitHubTaskSource] Fetched ${githubItems.length} ${filters.type} from GitHub API`
      );

      // Transform GitHub items into tasks
      const tasks = await this.transformGitHubItemsToTasks(
        githubItems,
        filters
      );

      console.log(`[GitHubTaskSource] Transformed into ${tasks.length} tasks`);

      // Update the extension's entity store with fresh GitHub tasks
      this.githubExtension.updateEntityStore(tasks);
      console.log(
        `[GitHubTaskSource] Updated extension entity store with ${tasks.length} GitHub tasks`
      );

      // Return only imported tasks (those with obsidian keys) for main taskStore
      // Non-imported GitHub tasks stay only in extension entity store
      const importedTasks = tasks.filter((task) => task.source?.keys?.obsidian);
      console.log(
        `[GitHubTaskSource] Returning ${importedTasks.length} imported tasks for main taskStore`
      );
      return importedTasks;
    } catch (error) {
      console.error(
        "[GitHubTaskSource] Failed to refresh from GitHub API:",
        error
      );
      // Fallback to current entity store data on error
      return this.loadInitialData();
    }
  }

  /**
   * Transform GitHub issues/PRs into tasks
   *
   * This method creates fresh GitHub tasks from API data. For imported tasks,
   * it preserves the existing task ID and metadata while updating with fresh GitHub data.
   * The result goes to the extension's entity store, and SyncManager handles merging.
   */
  private async transformGitHubItemsToTasks(
    githubItems: (GitHubIssue | GitHubPullRequest)[],
    filters: GitHubSourceFilters
  ): Promise<Task[]> {
    // Get imported tasks for this repository from the store
    const state = get(taskStore);
    const importedTasks = state.tasks.filter((task) => {
      // Must have both github and obsidian keys to be imported
      if (!task.source?.keys?.github || !task.source?.keys?.obsidian)
        return false;
      const url = task.source.keys.github;
      const taskRepository = extractRepositoryFromGitHubUrl(url);
      return taskRepository === filters.repository;
    });

    console.log(
      `[GitHubTaskSource] Found ${importedTasks.length} imported tasks for repository ${filters.repository}`
    );
    console.log(
      `[GitHubTaskSource] Imported tasks:`,
      importedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        github: t.source?.keys?.github,
        obsidian: t.source?.keys?.obsidian,
      }))
    );

    // Transform GitHub items into tasks
    const tasks = githubItems.map((item: GitHubIssue | GitHubPullRequest) => {
      // Check if this item is already imported
      const existingTask = importedTasks.find(
        (task: Task) => task.source?.keys?.github === item.html_url
      );

      if (existingTask) {
        // Create fresh task from GitHub API data, preserving only ID and timestamps
        const freshTask =
          filters.type === "issues"
            ? this.githubExtension.transformIssueToTask(
                item,
                filters.repository!
              )
            : this.githubExtension.transformPullRequestToTask(
                item,
                filters.repository!
              );

        // Preserve ID, timestamps, and source keys from existing task
        return {
          ...freshTask,
          id: existingTask.id,
          createdAt: existingTask.createdAt,
          updatedAt: existingTask.updatedAt,
          source: {
            ...freshTask.source,
            keys: {
              ...freshTask.source.keys,
              ...existingTask.source.keys, // Preserve obsidian key
            },
          },
        } as Task;
      } else {
        // Create a new task representation with GitHub data
        const taskData =
          filters.type === "issues"
            ? this.githubExtension.transformIssueToTask(
                item,
                filters.repository!
              )
            : this.githubExtension.transformPullRequestToTask(
                item,
                filters.repository!
              );

        // Use buildEntity to generate proper ID and timestamps
        const task = this.githubExtension.buildTaskEntity({
          ...taskData,
          source: {
            ...taskData.source,
            data: item, // Store the raw GitHub data
          },
        }) as Task;

        return task;
      }
    });

    return tasks;
  }

  // No watch() method - GitHub is pull-based, not push-based
  // Changes come from user actions (importing issues) or refresh operations
  // The extension entity store is updated directly, and SyncManager handles
  // merging with other sources into the main taskStore
}
