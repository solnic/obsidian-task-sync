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

      // Transform GitHub items into tasks for the current repository
      const tasksForCurrentRepo = await this.transformGitHubItemsToTasks(
        githubItems,
        filters
      );

      console.log(
        `[GitHubTaskSource] Transformed into ${tasksForCurrentRepo.length} tasks for repository ${filters.repository}`
      );

      // Update the extension's entity store with fresh GitHub tasks
      // This accumulates tasks in the store, merging with existing tasks
      this.githubExtension.updateEntityStore(tasksForCurrentRepo);
      console.log(
        `[GitHubTaskSource] Updated extension entity store with ${tasksForCurrentRepo.length} GitHub tasks for repository ${filters.repository}`
      );

      // Return ALL imported GitHub tasks with fresh data from entity store
      // The key is to return ALL imported tasks (from all repos), but with fresh data
      // for the ones we just fetched
      const state = get(taskStore);
      const entityStore = get(this.githubExtension.getEntityStore()) as Task[];

      console.log(
        `[GitHubTaskSource] Building result - task store has ${state.tasks.length} total tasks, entity store has ${entityStore.length} GitHub tasks`
      );

      // Build a map of all imported tasks, preferring entity store data when available
      const resultMap = new Map<string, Task>();

      // First, add all imported tasks from task store (these are the source of truth for what's imported)
      for (const task of state.tasks) {
        if (task.source.extension === "github") {
          const githubUrl = task.source.keys.github;
          if (githubUrl) {
            console.log(
              `[GitHubTaskSource] Found imported task in task store: ${task.title} (${githubUrl})`
            );
            resultMap.set(githubUrl, task);
          }
        }
      }

      console.log(
        `[GitHubTaskSource] Found ${resultMap.size} imported tasks in task store`
      );

      // Then, override with fresh data from entity store (for tasks we've fetched)
      // IMPORTANT: Preserve source.keys.obsidian from the imported task
      let freshDataCount = 0;
      for (const githubTask of entityStore) {
        const githubUrl = githubTask.source.keys.github;
        if (githubUrl && resultMap.has(githubUrl)) {
          // This task is imported AND we have fresh GitHub data - use fresh data
          // but preserve the obsidian key from the imported task
          const importedTask = resultMap.get(githubUrl)!;

          const mergedTask = {
            ...githubTask,
            source: {
              ...githubTask.source,
              keys: {
                ...githubTask.source.keys,
                obsidian: importedTask.source.keys.obsidian, // Preserve obsidian key
              },
            },
          } as Task;

          console.log(
            `[GitHubTaskSource] Overriding with fresh data for: ${githubTask.title} (${githubUrl}), preserving obsidian key: ${importedTask.source.keys.obsidian}`
          );
          resultMap.set(githubUrl, mergedTask);
          freshDataCount++;
        }
      }

      const importedGitHubTasks = Array.from(resultMap.values());

      console.log(
        `[GitHubTaskSource] Returning ${importedGitHubTasks.length} imported GitHub tasks (${freshDataCount} with fresh data for ${filters.repository})`
      );

      return importedGitHubTasks;
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
      if (!task.source.keys.github || !task.source.keys.obsidian) return false;
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
        github: t.source.keys.github,
        obsidian: t.source.keys.obsidian,
      }))
    );

    // Transform GitHub items into tasks
    const tasks = githubItems.map((item: GitHubIssue | GitHubPullRequest) => {
      // Check if this item is already imported
      const existingTask = importedTasks.find(
        (task: Task) => task.source.keys.github === item.html_url
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
