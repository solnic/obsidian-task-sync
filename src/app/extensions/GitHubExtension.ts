/**
 * GitHub Extension for TaskSync
 * Provides GitHub issue/PR import functionality following the Extension pattern
 */

import { Octokit } from "@octokit/rest";
import { requestUrl, Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../core/extension";
import { eventBus } from "../core/events";
import { taskStore } from "../stores/taskStore";
import { derived, get, type Readable } from "svelte/store";
import type { Task } from "../core/entities";
import { SchemaCache } from "../cache/SchemaCache";
import {
  GitHubIssueListSchema,
  GitHubLabelListSchema,
  GitHubRepositoryListSchema,
  GitHubOrganizationListSchema,
  type GitHubIssue,
  type GitHubIssueList,
  type GitHubLabel,
  type GitHubLabelList,
  type GitHubRepository,
  type GitHubRepositoryList,
  type GitHubOrganization,
  type GitHubOrganizationList,
  type GitHubPullRequest,
} from "../cache/schemas/github";
import { GitHub } from "../entities/GitHub";
import type {
  GitHubIntegrationSettings,
  TaskSyncSettings,
} from "../types/settings";

export class GitHubExtension implements Extension {
  readonly id = "github";
  readonly name = "GitHub";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = ["task"];

  private initialized = false;
  private octokit: Octokit | undefined;
  private plugin: Plugin;
  private settings: TaskSyncSettings;
  private githubOperations: GitHub.Operations;

  // Cache instances
  private issuesCache?: SchemaCache<GitHubIssueList>;
  private labelsCache?: SchemaCache<GitHubLabelList>;
  private repositoriesCache?: SchemaCache<GitHubRepositoryList>;
  private organizationsCache?: SchemaCache<GitHubOrganizationList>;

  constructor(settings: TaskSyncSettings, plugin: Plugin) {
    this.settings = settings;
    this.plugin = plugin;
    this.githubOperations = new GitHub.Operations(settings);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("Initializing GitHubExtension...");

      // Setup caches
      await this.setupCaches();

      // Initialize Octokit
      this.initializeOctokit();

      // Register extension
      extensionRegistry.register(this);

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: this.supportedEntities,
      });

      this.initialized = true;
      console.log("GitHubExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize GitHubExtension:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.initialized) {
      throw new Error("GitHubExtension must be initialized before loading");
    }

    try {
      console.log("Loading GitHubExtension - preloading caches...");

      // Preload caches from persistent storage
      await this.preloadCaches();

      // Trigger extension loaded event
      eventBus.trigger({
        type: "extension.loaded",
        extension: this.id,
        supportedEntities: this.supportedEntities,
      });

      console.log("GitHubExtension loaded successfully");
    } catch (error) {
      console.error("Failed to load GitHubExtension:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    eventBus.trigger({
      type: "extension.unregistered",
      extension: this.id,
    });

    this.initialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.initialized && this.octokit !== undefined;
  }

  /**
   * Get observable tasks for this extension
   * Returns tasks that were imported from GitHub
   */
  getTasks(): Readable<readonly Task[]> {
    return derived(taskStore, ($store) =>
      $store.tasks.filter((task) => task.source?.extension === "github")
    );
  }

  /**
   * Get tasks for a specific repository (both imported and available)
   * Returns Task objects for all issues/PRs in the repository, with imported status
   * @param repository - Repository in format "owner/repo"
   * @param type - Type of items to fetch ("issues" or "pull-requests")
   */
  async getTasksForRepository(
    repository: string,
    type: "issues" | "pull-requests" = "issues"
  ): Promise<Task[]> {
    if (!repository) {
      return [];
    }

    try {
      // Fetch GitHub data
      const githubItems =
        type === "issues"
          ? await this.fetchIssues(repository)
          : await this.fetchPullRequests(repository);

      // Get imported tasks from store
      const imported = get(taskStore).tasks.filter(
        (task) => task.source?.extension === "github"
      );

      // Transform GitHub items to tasks
      const tasks: Task[] = githubItems.map((item) => {
        // Check if this item is already imported
        const existingTask = imported.find(
          (task) => task.source?.url === item.html_url
        );

        if (existingTask) {
          // Return the imported task (which has the real ID, doDate, etc.)
          return existingTask;
        } else {
          // Transform to a temporary task object for display
          const taskData =
            type === "issues"
              ? this.githubOperations.tasks.transformIssueToTask(
                  item as any,
                  repository
                )
              : this.githubOperations.tasks.transformPullRequestToTask(
                  item as any,
                  repository
                );

          // Create a temporary task with a synthetic ID
          return {
            ...taskData,
            id: `github-temp-${item.id}`,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at),
          } as Task;
        }
      });

      return tasks;
    } catch (error) {
      console.error(`Failed to get tasks for repository ${repository}:`, error);
      return [];
    }
  }

  /**
   * Refresh GitHub data by clearing caches
   */
  async refresh(): Promise<void> {
    try {
      taskStore.setLoading(true);
      taskStore.setError(null);

      console.log("Refreshing GitHub data...");

      // Clear all caches to force fresh data fetch
      await this.clearCache();

      taskStore.setLoading(false);
      console.log("GitHub refresh completed successfully");
    } catch (err: any) {
      console.error("Failed to refresh GitHub data:", err);
      taskStore.setError(err.message);
      taskStore.setLoading(false);
      throw err;
    }
  }

  /**
   * Search tasks by query string
   */
  searchTasks(query: string, tasks: readonly Task[]): readonly Task[] {
    if (!query) return tasks;

    const lowerQuery = query.toLowerCase();
    return tasks.filter((task) => {
      return (
        task.title.toLowerCase().includes(lowerQuery) ||
        task.category?.toLowerCase().includes(lowerQuery) ||
        task.status.toLowerCase().includes(lowerQuery) ||
        task.project?.toLowerCase().includes(lowerQuery) ||
        task.areas.some((area) => area.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Sort tasks by multiple fields
   */
  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    return [...tasks].sort((a, b) => {
      for (const field of sortFields) {
        const aVal = (a as any)[field.key];
        const bVal = (b as any)[field.key];

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;

        if (comparison !== 0) {
          return field.direction === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Filter tasks by criteria
   */
  filterTasks(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
    }
  ): readonly Task[] {
    return tasks.filter((task) => {
      if (criteria.project && task.project !== criteria.project) return false;
      if (criteria.area && !task.areas.includes(criteria.area)) return false;
      if (criteria.source && task.source?.extension !== criteria.source)
        return false;
      if (!criteria.showCompleted && task.done) return false;
      return true;
    });
  }

  // Event handler methods required by Extension interface
  async onEntityCreated(_event: any): Promise<void> {
    // GitHub extension doesn't create entities in response to events
  }

  async onEntityUpdated(_event: any): Promise<void> {
    // GitHub extension doesn't update entities in response to events
  }

  async onEntityDeleted(_event: any): Promise<void> {
    // GitHub extension doesn't delete entities in response to events
  }

  /**
   * Setup GitHub-specific caches
   */
  private async setupCaches(): Promise<void> {
    this.issuesCache = new SchemaCache(
      this.plugin,
      "github-issues",
      GitHubIssueListSchema
    );
    this.labelsCache = new SchemaCache(
      this.plugin,
      "github-labels",
      GitHubLabelListSchema
    );
    this.repositoriesCache = new SchemaCache(
      this.plugin,
      "github-repositories",
      GitHubRepositoryListSchema
    );
    this.organizationsCache = new SchemaCache(
      this.plugin,
      "github-organizations",
      GitHubOrganizationListSchema
    );
  }

  /**
   * Preload GitHub caches from persistent storage
   */
  private async preloadCaches(): Promise<void> {
    const caches = [
      this.issuesCache,
      this.labelsCache,
      this.repositoriesCache,
      this.organizationsCache,
    ];

    await Promise.all(
      caches.map(async (cache) => {
        if (cache) {
          await cache.preloadFromStorage();
        }
      })
    );
  }

  /**
   * Initialize Octokit client if integration is enabled and token is provided
   */
  private initializeOctokit(): void {
    const githubSettings = this.settings.integrations.github;
    const trimmedToken = githubSettings.personalAccessToken?.trim();

    if (githubSettings.enabled && trimmedToken) {
      this.octokit = new Octokit({
        auth: trimmedToken,
        userAgent: "obsidian-task-sync",
        request: {
          fetch: this.createObsidianFetch(),
        },
      });
    } else {
      // Clear octokit if integration is disabled or no token
      this.octokit = undefined;
    }
  }

  /**
   * Create a fetch-compatible function using Obsidian's requestUrl
   */
  private createObsidianFetch() {
    return async (url: string, options: any = {}) => {
      try {
        // Use Obsidian's requestUrl which returns a proper response object
        const response = await requestUrl({
          url,
          method: options.method || "GET",
          headers: options.headers || {},
          body: options.body,
          throw: false, // Don't throw on HTTP errors, let Octokit handle them
        });

        // Create a Response-like object that Octokit expects
        // Make headers object iterable like the Headers API
        const headersMap = new Map();
        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            headersMap.set(key.toLowerCase(), value);
          });
        }

        return {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: response.status.toString(),
          headers: {
            get: (name: string): string | null =>
              headersMap.get(name.toLowerCase()) || null,
            has: (name: string): boolean => headersMap.has(name.toLowerCase()),
            entries: () => headersMap.entries(),
            keys: () => headersMap.keys(),
            values: () => headersMap.values(),
            [Symbol.iterator]: () => headersMap.entries(),
          },
          json: async () => JSON.parse(response.text),
          text: async () => response.text,
          url: url,
        };
      } catch (error) {
        throw error;
      }
    };
  }

  /**
   * Generate consistent cache key for GitHub resources
   */
  private generateCacheKey(
    category: "issues" | "labels" | "repositories" | "organizations",
    repository?: string,
    filters?: { state?: string; assignee?: string; labels?: string[] }
  ): string {
    const parts = ["github"];

    if (repository) {
      const [owner, repo] = repository.split("/");
      parts.push(`org:${owner}`, `repo:${repo}`);
    }

    parts.push(`category:${category}`);

    if (filters) {
      if (filters.state) {
        parts.push(`status:${filters.state}`);
      }
      if (filters.assignee) {
        parts.push(`assignee:${filters.assignee}`);
      }
      if (filters.labels && filters.labels.length > 0) {
        parts.push(`labels:${filters.labels.sort().join(",")}`);
      }
    }

    return parts.join("|");
  }

  /**
   * Validate repository format (owner/repo)
   */
  private validateRepository(repository: string): boolean {
    if (!repository || typeof repository !== "string") {
      return false;
    }

    const parts = repository.split("/");
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  }

  /**
   * Clear all GitHub-specific caches
   */
  async clearCache(): Promise<void> {
    // Clear all cache instances
    if (this.issuesCache) {
      await this.issuesCache.clear();
    }

    if (this.labelsCache) {
      await this.labelsCache.clear();
    }

    if (this.repositoriesCache) {
      await this.repositoriesCache.clear();
    }

    if (this.organizationsCache) {
      await this.organizationsCache.clear();
    }
  }

  /**
   * Check if GitHub integration is enabled
   */
  isEnabled(): boolean {
    return this.settings.integrations.github.enabled && !!this.octokit;
  }

  /**
   * Fetch issues from a GitHub repository with caching
   */
  async fetchIssues(repository: string): Promise<GitHubIssue[]> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    if (!this.validateRepository(repository)) {
      throw new Error("Invalid repository format. Expected: owner/repo");
    }

    const filters = this.settings.integrations.github.issueFilters;
    const cacheKey = this.generateCacheKey("issues", repository, {
      state: filters.state,
      assignee: filters.assignee,
      labels: filters.labels,
    });

    // Check cache first
    if (this.issuesCache) {
      const cachedIssues = await this.issuesCache.get(cacheKey);
      if (cachedIssues) {
        return cachedIssues;
      }
    }

    const [owner, repo] = repository.split("/");

    const response = await this.octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: filters.state,
      assignee: filters.assignee || undefined,
      labels: filters.labels.length > 0 ? filters.labels.join(",") : undefined,
      per_page: 100,
    });

    // Filter out pull requests - GitHub API returns both issues and PRs from the issues endpoint
    // Pull requests have a "pull_request" field that distinguishes them from actual issues
    const allItems = response.data as GitHubIssue[];
    const issues = allItems.filter((item) => !item.pull_request);

    // Cache the results
    if (this.issuesCache) {
      await this.issuesCache.set(cacheKey, issues);
    }

    return issues;
  }

  /**
   * Fetch repositories for the authenticated user
   */
  async fetchRepositories(): Promise<GitHubRepository[]> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    const cacheKey = this.generateCacheKey("repositories");

    // Check cache first
    if (this.repositoriesCache) {
      const cachedRepos = await this.repositoriesCache.get(cacheKey);
      if (cachedRepos) {
        return cachedRepos;
      }
    }

    const allRepositories: GitHubRepository[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 100,
        page: page,
      });

      const repositories = response.data as GitHubRepository[];
      allRepositories.push(...repositories);

      // Check if we have more pages
      hasMore = repositories.length === 100;
      page++;

      // Safety check to prevent infinite loops
      if (page > 50) {
        console.warn(
          "GitHub API: Stopping pagination after 50 pages (5000 repos) for safety"
        );
        break;
      }
    }

    // Cache the results
    if (this.repositoriesCache) {
      await this.repositoriesCache.set(cacheKey, allRepositories);
    }

    return allRepositories;
  }

  /**
   * Fetch organizations for the authenticated user
   */
  async fetchOrganizations(): Promise<GitHubOrganization[]> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    const cacheKey = this.generateCacheKey("organizations");

    // Check cache first
    if (this.organizationsCache) {
      const cachedOrgs = await this.organizationsCache.get(cacheKey);
      if (cachedOrgs) {
        return cachedOrgs;
      }
    }

    const response = await this.octokit.rest.orgs.listForAuthenticatedUser({
      per_page: 100,
    });

    const organizations = response.data as GitHubOrganization[];

    // Cache the results
    if (this.organizationsCache) {
      await this.organizationsCache.set(cacheKey, organizations);
    }

    return organizations;
  }

  /**
   * Fetch labels for a repository
   */
  async fetchLabels(repository: string): Promise<GitHubLabel[]> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    if (!this.validateRepository(repository)) {
      throw new Error("Invalid repository format. Expected: owner/repo");
    }

    const cacheKey = this.generateCacheKey("labels", repository);

    // Check cache first
    if (this.labelsCache) {
      const cachedLabels = await this.labelsCache.get(cacheKey);
      if (cachedLabels) {
        return cachedLabels;
      }
    }

    const [owner, repo] = repository.split("/");

    const response = await this.octokit.rest.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });

    const labels = response.data as GitHubLabel[];

    // Cache the labels
    if (this.labelsCache) {
      await this.labelsCache.set(cacheKey, labels);
    }

    return labels;
  }

  /**
   * Get the authenticated user information
   */
  async getCurrentUser(): Promise<{
    login: string;
    id: number;
    avatar_url: string;
  } | null> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    const response = await this.octokit.rest.users.getAuthenticated();
    return {
      login: response.data.login,
      id: response.data.id,
      avatar_url: response.data.avatar_url,
    };
  }

  /**
   * Fetch pull requests from a GitHub repository
   */
  async fetchPullRequests(repository: string): Promise<GitHubPullRequest[]> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    if (!this.validateRepository(repository)) {
      throw new Error("Invalid repository format. Expected: owner/repo");
    }

    const [owner, repo] = repository.split("/");

    const response = await this.octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
      per_page: 100,
    });

    return response.data as GitHubPullRequest[];
  }

  /**
   * Fetch repositories for an organization
   */
  async fetchRepositoriesForOrganization(
    org: string
  ): Promise<GitHubRepository[]> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    const cacheKey = this.generateCacheKey("repositories", `${org}/*`);

    // Check cache first
    if (this.repositoriesCache) {
      const cachedRepos = await this.repositoriesCache.get(cacheKey);
      if (cachedRepos) {
        return cachedRepos;
      }
    }

    const allRepositories: GitHubRepository[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.octokit.rest.repos.listForOrg({
        org,
        sort: "updated",
        per_page: 100,
        page: page,
      });

      const repositories = response.data as GitHubRepository[];
      allRepositories.push(...repositories);

      // Check if we have more pages
      hasMore = repositories.length === 100;
      page++;

      // Safety check to prevent infinite loops
      if (page > 50) {
        console.warn(
          `GitHub API: Stopping pagination after 50 pages (5000 repos) for ${org} for safety`
        );
        break;
      }
    }

    // Cache the results
    if (this.repositoriesCache) {
      await this.repositoriesCache.set(cacheKey, allRepositories);
    }

    return allRepositories;
  }

  /**
   * Common import logic for GitHub items (issues and PRs)
   * @private
   */
  private async importGitHubItem<T extends GitHubIssue | GitHubPullRequest>(
    item: T,
    repository: string | undefined,
    itemType: "issue" | "PR",
    importOperation: (item: T, repository?: string) => Promise<Task>
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      // Check if already imported by looking for existing task with this URL
      const existingTask = taskStore.findBySourceUrl(item.html_url);

      if (existingTask) {
        console.log(
          `GitHub ${itemType} #${item.number} already imported as task ${existingTask.id}`
        );
        return {
          success: true,
          taskId: existingTask.id,
        };
      }

      // Use GitHub.TaskOperations to import the item
      // This handles task creation, store updates, and event triggering
      const task = await importOperation(item, repository);

      console.log(
        `Successfully imported GitHub ${itemType} #${item.number} as task ${task.id}`
      );

      return {
        success: true,
        taskId: task.id,
      };
    } catch (error: any) {
      console.error(`Failed to import GitHub ${itemType}:`, error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  }

  /**
   * Import a GitHub issue as a task
   * Delegates to GitHub.TaskOperations which handles task creation and event triggering
   */
  async importIssueAsTask(
    issue: GitHubIssue,
    repository?: string
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    return this.importGitHubItem(issue, repository, "issue", (item, repo) =>
      this.githubOperations.tasks.importIssue(item, repo)
    );
  }

  /**
   * Import a GitHub pull request as a task
   * Delegates to GitHub.TaskOperations which handles task creation and event triggering
   */
  async importPullRequestAsTask(
    pr: GitHubPullRequest,
    repository?: string
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    return this.importGitHubItem(pr, repository, "PR", (item, repo) =>
      this.githubOperations.tasks.importPullRequest(item, repo)
    );
  }
}
