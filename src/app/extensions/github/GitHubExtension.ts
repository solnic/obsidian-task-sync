/**
 * GitHub Extension for TaskSync
 * Provides GitHub issue/PR import functionality following the Extension pattern
 */

import { Octokit } from "@octokit/rest";
import { requestUrl, Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../../core/extension";
import { eventBus } from "../../core/events";
import { taskStore } from "../../stores/taskStore";
import { derived, get, writable, type Readable } from "svelte/store";
import type { Task } from "../../core/entities";
import { SchemaCache } from "../../cache/SchemaCache";
import { TaskQueryService } from "../../services/TaskQueryService";
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
} from "../../cache/schemas/github";
import { GitHub } from "./entities/GitHub";
import type { TaskSyncSettings } from "../../types/settings";
import { GitHubTaskSource } from "./sources/TaskSource";
import { taskSourceManager } from "../../core/TaskSourceManager";

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

  /**
   * Update settings and reinitialize components that depend on them
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;

    // Update GitHub operations with new settings
    this.githubOperations = new GitHub.Operations(newSettings);

    // Update organization/repository mappings
    this.githubOperations.tasks.updateOrgRepoMappings(
      newSettings.integrations.github.orgRepoMappings || []
    );

    // Reinitialize Octokit with new settings
    this.initializeOctokit();
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

      // Register GitHubTaskSource with TaskSourceManager
      console.log("Registering GitHubTaskSource with TaskSourceManager...");
      const taskSource = new GitHubTaskSource();
      taskSourceManager.registerSource(taskSource);
      console.log("GitHubTaskSource registered successfully");

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

      // Load tasks from GitHubTaskSource via TaskSourceManager
      console.log("Loading GitHub tasks via TaskSourceManager...");
      await taskSourceManager.loadSource("github");
      console.log("GitHub tasks loaded from TaskSourceManager");

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

  // Cache for fetched GitHub API data (issues/PRs) - now reactive
  private githubApiDataCache = writable<Map<string, any[]>>(new Map());

  // Cache for non-imported task objects to ensure stable IDs
  // Maps GitHub URL -> Task object
  private taskObjectCache = new Map<string, Task>();

  /**
   * Get observable tasks for this extension with optional filters
   * Returns imported GitHub tasks combined with GitHub API data
   * @param filters - Optional filters for repository and type
   */
  getTasks(filters?: {
    repository?: string;
    type?: "issues" | "pull-requests";
  }): Readable<readonly Task[]> {
    // Create derived store of GitHub tasks from taskStore
    const githubTasks = derived(taskStore, ($store) => {
      const filtered = $store.tasks.filter(
        (task) => task.source?.extension === "github"
      );
      console.log("[GitHubExtension.getTasks] GitHub tasks from store:", {
        totalTasks: $store.tasks.length,
        githubTasks: filtered.length,
        tasks: filtered.map((t) => ({
          id: t.id,
          title: t.title,
          doDate: t.doDate,
          url: t.source?.url,
        })),
      });
      return filtered;
    });

    // If no filters, return all imported GitHub tasks
    if (!filters?.repository) {
      return githubTasks;
    }

    const { repository, type = "issues" } = filters;
    const cacheKey = `${repository}:${type}`;

    console.log("[GitHubExtension.getTasks] Creating derived store for:", {
      repository,
      type,
      cacheKey,
    });

    // Fetch GitHub API data if not already fetching
    // Check the current cache state synchronously
    const currentCache = get(this.githubApiDataCache);

    if (!currentCache.has(cacheKey)) {
      this.fetchGitHubApiData(repository, type);
    }

    // Create a derived store that combines imported tasks with fetched GitHub API data
    // Now depends on BOTH githubTasks AND githubApiDataCache for reactivity
    return derived(
      [githubTasks, this.githubApiDataCache],
      ([$githubTasks, $cache]) => {
        console.log("[GitHubExtension.getTasks] Derived store updating:", {
          githubTasksCount: $githubTasks.length,
          cacheSize: $cache.size,
          cacheKey,
        });

        // Get fetched GitHub API data from reactive cache
        const githubItems = $cache.get(cacheKey) || [];

        // Filter imported tasks for this repository
        const importedForRepo = $githubTasks.filter((task) => {
          const url = task.source?.url;
          if (!url) return false;
          const match = url.match(/github\.com\/([^\/]+\/[^\/]+)\//);
          const taskRepository = match ? match[1] : null;
          return taskRepository === repository;
        });

        console.log("[GitHubExtension.getTasks] Imported for repo:", {
          repository,
          count: importedForRepo.length,
          tasks: importedForRepo.map((t) => ({
            id: t.id,
            title: t.title,
            doDate: t.doDate,
          })),
        });

        // Combine GitHub API data with imported tasks
        const tasks = githubItems.map((item: any) => {
          // Check if this item is already imported
          const existingTask = importedForRepo.find(
            (task: Task) => task.source?.url === item.html_url
          );

          if (existingTask) {
            console.log(
              "[GitHubExtension.getTasks] Found existing task for:",
              item.html_url,
              {
                id: existingTask.id,
                title: existingTask.title,
                doDate: existingTask.doDate,
              }
            );
            // Return the imported task from the store (which has the latest doDate, etc.)
            // with updated source.data from GitHub API
            return {
              ...existingTask,
              source: {
                ...existingTask.source,
                imported: true, // Explicitly mark as imported
                data: item, // Update with latest GitHub data (labels, state, etc.)
              },
            } as Task;
          } else {
            // Check if we already have a cached task object for this URL
            const cachedTask = this.taskObjectCache.get(item.html_url);
            if (cachedTask) {
              // Return cached task with updated source.data
              return {
                ...cachedTask,
                source: {
                  ...cachedTask.source,
                  data: item, // Update with latest GitHub data
                },
              } as Task;
            }

            // Create a new task representation with GitHub data in source.data
            const taskData =
              type === "issues"
                ? this.githubOperations.tasks.transformIssueToTask(
                    item,
                    repository
                  )
                : this.githubOperations.tasks.transformPullRequestToTask(
                    item,
                    repository
                  );

            // Use buildEntity to generate proper ID and timestamps
            const task = this.githubOperations.tasks.buildEntity({
              ...taskData,
              source: {
                ...taskData.source,
                imported: false, // Not yet imported
                data: item, // Store the raw GitHub data
              },
            }) as Task;

            // Cache the task object for future renders
            this.taskObjectCache.set(item.html_url, task);

            return task;
          }
        });

        return tasks;
      }
    );
  }

  /**
   * Fetch GitHub API data and cache it
   */
  private async fetchGitHubApiData(
    repository: string,
    type: "issues" | "pull-requests"
  ): Promise<void> {
    const cacheKey = `${repository}:${type}`;

    try {
      // Set empty array while fetching to prevent multiple fetches
      this.githubApiDataCache.update((cache) => {
        const newCache = new Map(cache);
        newCache.set(cacheKey, []);
        return newCache;
      });

      // Fetch GitHub data
      const githubItems =
        type === "issues"
          ? await this.fetchIssues(repository)
          : await this.fetchPullRequests(repository);

      // Store in cache - this triggers reactivity
      this.githubApiDataCache.update((cache) => {
        const newCache = new Map(cache);
        newCache.set(cacheKey, githubItems);
        return newCache;
      });
    } catch (error) {
      console.error(
        `Failed to fetch GitHub ${type} for repository ${repository}:`,
        error
      );
      // Keep empty array on error
      this.githubApiDataCache.update((cache) => {
        const newCache = new Map(cache);
        newCache.set(cacheKey, []);
        return newCache;
      });
    }
  }

  /**
   * Refresh GitHub data by clearing caches and reloading from source
   * Updated to use TaskSourceManager which handles store updates
   */
  async refresh(): Promise<void> {
    try {
      console.log("Refreshing GitHub data via TaskSourceManager...");

      // Clear all caches to force fresh data fetch
      await this.clearCache();

      // Clear GitHub API data cache - this triggers reactivity
      this.githubApiDataCache.set(new Map());

      // Clear task object cache to allow fresh IDs for non-imported tasks
      this.taskObjectCache.clear();

      // Use TaskSourceManager to refresh tasks from GitHubTaskSource
      // This will:
      // 1. Call GitHubTaskSource.refresh()
      // 2. Dispatch LOAD_SOURCE_START action
      // 3. Dispatch LOAD_SOURCE_SUCCESS with fresh tasks
      // 4. Store reducer handles replacing old tasks with fresh ones
      await taskSourceManager.refreshSource("github");

      console.log(
        "GitHub refresh completed successfully via TaskSourceManager"
      );
    } catch (err: any) {
      console.error("Failed to refresh GitHub data:", err);
      throw err;
    }
  }

  /**
   * Search tasks by query string
   * Uses TaskQueryService for consistent search behavior
   */
  searchTasks(query: string, tasks: readonly Task[]): readonly Task[] {
    return TaskQueryService.search(tasks, query);
  }

  /**
   * Sort tasks by multiple fields
   * Uses TaskQueryService for consistent sort behavior
   */
  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    // Convert to TaskQueryService format
    const queryServiceFields = sortFields.map((f) => ({
      field: f.key as keyof Task,
      direction: f.direction,
    }));
    return TaskQueryService.sort(tasks, queryServiceFields);
  }

  /**
   * Filter tasks by criteria
   * Uses TaskQueryService for standard filters, applies GitHub-specific filters separately
   */
  filterTasks(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
      // GitHub-specific filters
      state?: "open" | "closed" | "all";
      assignedToMe?: boolean;
      labels?: string[];
      currentUser?: { login: string; id: number; avatar_url: string } | null;
    }
  ): readonly Task[] {
    // Apply standard filters using TaskQueryService
    let filtered = TaskQueryService.filter(tasks, {
      project: criteria.project || undefined,
      area: criteria.area || undefined,
      source: criteria.source || undefined,
      showCompleted: criteria.showCompleted,
    });

    // Apply GitHub-specific filters
    return filtered.filter((task) => {
      const githubData = task.source?.data;

      // Filter by state
      if (criteria.state && criteria.state !== "all" && githubData) {
        if (githubData.state !== criteria.state) return false;
      }

      // Filter by assignee
      if (criteria.assignedToMe && criteria.currentUser && githubData) {
        if (githubData.assignee?.login !== criteria.currentUser.login)
          return false;
      }

      // Filter by labels
      if (criteria.labels && criteria.labels.length > 0 && githubData) {
        if (!githubData.labels) return false;
        const hasMatchingLabel = criteria.labels.some((selectedLabel: string) =>
          githubData.labels.some((label: any) => label.name === selectedLabel)
        );
        if (!hasMatchingLabel) return false;
      }

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
   * Transform GitHub issue to task format
   */
  transformIssueToTask(issue: any, repository: string): any {
    return this.githubOperations.tasks.transformIssueToTask(issue, repository);
  }

  /**
   * Transform GitHub pull request to task format
   */
  transformPullRequestToTask(pullRequest: any, repository: string): any {
    return this.githubOperations.tasks.transformPullRequestToTask(
      pullRequest,
      repository
    );
  }

  /**
   * Build a task entity with proper ID and timestamps
   */
  buildTaskEntity(
    taskData: Omit<Task, "id" | "createdAt" | "updatedAt">
  ): Task {
    return this.githubOperations.tasks.buildEntity(taskData) as Task;
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
      const storeState = get(taskStore);
      const existingTask = TaskQueryService.findBySourceUrl(
        storeState.tasks,
        item.html_url
      );

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
