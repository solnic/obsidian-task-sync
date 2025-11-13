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
import { syncManager, type EntityDataProvider } from "../../core/SyncManager";
import { extractRepositoryFromGitHubUrl } from "./utils/GitHubUrlUtils";

/**
 * EntityDataProvider for GitHub extension
 * Handles reading/writing GitHub task data for cross-source synchronization
 */
class GitHubEntityDataProvider implements EntityDataProvider {
  extensionId = "github";

  constructor(private extension: GitHubExtension) {}

  async readEntityData(entityId: string): Promise<Partial<Task> | null> {
    // For cross-source entities (like imported GitHub tasks), we need to read from
    // the main task store to get the complete task with all source keys preserved
    console.log(
      `[GitHubEntityDataProvider] Reading GitHub data for entity ${entityId}`
    );

    // First, try to find the task in the main task store
    // This ensures we get the complete task with all source keys (github + obsidian)
    const mainStoreState = get(taskStore);
    const mainTask = mainStoreState.tasks.find((t) => t.id === entityId);

    if (mainTask) {
      console.log(
        `[GitHubEntityDataProvider] Found GitHub task in main store:`,
        {
          title: mainTask.title,
          sourceKeys: mainTask.source.keys,
        }
      );
      return mainTask;
    }

    // Fallback: Read from the extension's entity store for non-imported tasks
    const githubTasks = get(this.extension.getEntityStore()) as Task[];
    const task = githubTasks.find((t) => t.id === entityId);

    if (task) {
      console.log(
        `[GitHubEntityDataProvider] Found GitHub task in entity store:`,
        {
          title: task.title,
          description: task.description,
        }
      );
      return task;
    }

    console.log(
      `[GitHubEntityDataProvider] No GitHub task found for ${entityId}`
    );
    return null;
  }

  async writeEntityData(entityId: string, _data: Partial<Task>): Promise<void> {
    // GitHub extension doesn't write data back to GitHub
    // It's a read-only source - GitHub API is the source of truth
    console.log(
      `[GitHubEntityDataProvider] GitHub is read-only, ignoring write for entity ${entityId}`
    );
  }

  canHandle(entity: Task): boolean {
    return entity.source.extension === "github";
  }

  /**
   * GitHub only syncs specific properties that have direct mapping to GitHub issues
   * All other properties are Obsidian-specific and should not be overridden
   */
  getSyncableProperties(): Array<keyof Task> {
    return [
      "title",        // GitHub issue title
      "status",       // Mapped from GitHub issue state
      "done",         // Derived from GitHub issue state
      "description",  // GitHub issue body (note content)
    ];
  }
}

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

  // SyncManager provider
  private entityDataProvider?: GitHubEntityDataProvider;

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
      const taskSource = new GitHubTaskSource(this);
      taskSourceManager.registerSource(taskSource);
      console.log("GitHubTaskSource registered successfully");

      // Register EntityDataProvider with SyncManager
      console.log("Registering GitHubEntityDataProvider with SyncManager...");
      this.entityDataProvider = new GitHubEntityDataProvider(this);
      syncManager.registerProvider(this.entityDataProvider);
      console.log("GitHubEntityDataProvider registered successfully");

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

      // Set up reactive cleanup of entity store
      this.setupReactiveCleanup();

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

  // Event handler methods required by Extension interface
  // GitHub extension uses reactive stores instead of event handlers
  async onEntityCreated(_event: any): Promise<void> {
    // No-op: GitHub entity store is managed reactively
  }

  async onEntityUpdated(_event: any): Promise<void> {
    // No-op: GitHub entity store is managed reactively
  }

  async onEntityDeleted(_event: any): Promise<void> {
    // No-op: GitHub entity store is managed reactively
  }

  // ============================================================================
  // REACTIVE STATE - Extension-level state that components can observe
  // ============================================================================

  // Raw entity store - contains GitHub tasks fetched from API
  private rawEntityStore = writable<Task[]>([]);

  // Track GitHub URLs that exist in main store (for reactive cleanup)
  private mainStoreGitHubUrls = new Set<string>();

  /**
   * Get the extension's entity store (read-only)
   * Returns the raw entity store directly.
   *
   * Reactive cleanup is handled by subscribing to taskStore changes in activate().
   */
  getEntityStore(): Readable<Task[]> {
    return this.rawEntityStore;
  }

  /**
   * Set up reactive cleanup of entity store based on main task store changes.
   * This removes tasks from the GitHub entity store when they're deleted from main store.
   */
  private setupReactiveCleanup(): void {
    // Subscribe to main task store changes
    taskStore.subscribe(($mainStore) => {
      // Build set of GitHub URLs currently in main store
      const currentGitHubUrls = new Set<string>();
      for (const task of $mainStore.tasks) {
        if (task.source.keys.github) {
          currentGitHubUrls.add(task.source.keys.github);
        }
      }

      // Find URLs that were in main store but are no longer there (deleted)
      const deletedUrls = new Set<string>();
      for (const url of this.mainStoreGitHubUrls) {
        if (!currentGitHubUrls.has(url)) {
          deletedUrls.add(url);
        }
      }

      // If any tasks were deleted, remove them from raw entity store
      if (deletedUrls.size > 0) {
        this.rawEntityStore.update((tasks) => {
          return tasks.filter((task) => {
            const url = task.source.keys.github;
            return !url || !deletedUrls.has(url);
          });
        });
      }

      // Update tracking
      this.mainStoreGitHubUrls = currentGitHubUrls;
    });
  }

  /**
   * Update the extension's entity store by merging new tasks
   *
   * This accumulates tasks in the store, replacing tasks with the same GitHub URL
   * while preserving all other tasks. This allows the extension to build up a cache
   * of GitHub data across multiple fetches.
   *
   * @param tasks - Tasks to add/update in the store
   */
  updateEntityStore(tasks: Task[]): void {
    this.rawEntityStore.update((currentTasks) => {
      console.log(
        `[GitHubExtension] updateEntityStore called with ${tasks.length} tasks, current store has ${currentTasks.length} tasks`
      );

      // Create a map of existing tasks by GitHub URL for efficient lookup
      const taskMap = new Map<string, Task>();

      // Add all current tasks to the map
      for (const task of currentTasks) {
        const url = task.source.keys.github;
        if (url) {
          taskMap.set(url, task);
        }
      }

      console.log(
        `[GitHubExtension] Added ${taskMap.size} existing tasks to map`
      );

      // Update/add new tasks
      for (const task of tasks) {
        const url = task.source.keys.github;
        if (url) {
          taskMap.set(url, task);
        }
      }

      console.log(
        `[GitHubExtension] After adding new tasks, map has ${taskMap.size} tasks`
      );

      // Return all tasks from the map
      return Array.from(taskMap.values());
    });
  }

  // Current active filters - components should read/write these
  private currentFilters = writable<{
    repository: string | null;
    type: "issues" | "pull-requests";
  }>({
    repository: null,
    type: "issues",
  });

  /**
   * Get the current filter state (for components to read)
   */
  getFilters(): Readable<{
    repository: string | null;
    type: "issues" | "pull-requests";
  }> {
    return this.currentFilters;
  }

  /**
   * Set the current filter state (for components to update)
   */
  setFilters(filters: {
    repository?: string | null;
    type?: "issues" | "pull-requests";
  }): void {
    console.log("[GitHubExtension] setFilters called with:", filters);

    this.currentFilters.update((current) => ({
      repository:
        filters.repository !== undefined
          ? filters.repository
          : current.repository,
      type: filters.type !== undefined ? filters.type : current.type,
    }));

    // Trigger data fetch if repository is set and we don't have data for it
    const { repository, type } = get(this.currentFilters);
    console.log(
      `[GitHubExtension] Current filters after update: repository=${repository}, type=${type}`
    );

    if (repository) {
      // Check if we have data in the entity store for this repository/type
      const entityTasks = get(this.getEntityStore()) as Task[];
      console.log(
        `[GitHubExtension] Checking if we have data for ${repository}/${type}, entity store has ${entityTasks.length} tasks`
      );

      const hasDataForRepo = entityTasks.some((task) => {
        const url = task.source.keys.github;
        if (!url) return false;
        const taskRepository = extractRepositoryFromGitHubUrl(url);
        const typeMatches =
          (type === "issues" && url.includes("/issues/")) ||
          (type === "pull-requests" && url.includes("/pull/"));
        return taskRepository === repository && typeMatches;
      });

      console.log(
        `[GitHubExtension] hasDataForRepo=${hasDataForRepo}, will ${
          hasDataForRepo ? "NOT" : ""
        } trigger refresh`
      );

      if (!hasDataForRepo) {
        // Trigger refresh to fetch data for this repository
        // The refresh will accumulate data in entity store and return ALL imported tasks
        taskSourceManager.refreshSource("github");
      }
    }
  }

  /**
   * Get the current filter state (for TaskSource to use)
   */
  getCurrentFilters(): {
    repository: string | null;
    type: "issues" | "pull-requests";
  } {
    return get(this.currentFilters);
  }

  /**
   * Get observable tasks for this extension
   * Returns a single derived store that combines:
   * - Imported GitHub tasks from taskStore
   * - Fetched GitHub API data based on current filters
   *
   * This is the main interface for components to get tasks.
   * Components should NOT pass filters - they should use setFilters() instead.
   */
  getTasks(): Readable<readonly Task[]> {
    // Create derived store of imported GitHub tasks from taskStore
    const importedGitHubTasks = derived(taskStore, ($store) => {
      return $store.tasks.filter((task) => task.source?.extension === "github");
    });

    // Create a derived store that combines:
    // 1. Imported GitHub tasks (from main taskStore)
    // 2. GitHub tasks from extension's entity store (authoritative GitHub data)
    // 3. Current filter state
    return derived(
      [importedGitHubTasks, this.getEntityStore(), this.currentFilters],
      ([$importedTasks, $githubTasks, $filters]) => {
        // If no repository filter, return all imported tasks
        if (!$filters.repository) {
          return $importedTasks;
        }

        const { repository, type } = $filters;

        // Filter GitHub tasks from entity store for this repository and type
        const githubTasksForRepo = $githubTasks.filter((task) => {
          const url = task.source.keys.github;
          if (!url) return false;
          const taskRepository = extractRepositoryFromGitHubUrl(url);

          // Check repository match and type match
          const repoMatches = taskRepository === repository;
          const typeMatches =
            (type === "issues" && url.includes("/issues/")) ||
            (type === "pull-requests" && url.includes("/pull/"));

          return repoMatches && typeMatches;
        });

        // Filter imported tasks for this repository
        const importedForRepo = $importedTasks.filter((task) => {
          const url = task.source.keys.github;
          if (!url) return false;
          const taskRepository = extractRepositoryFromGitHubUrl(url);
          return taskRepository === repository;
        });

        // Combine tasks: use imported tasks (with user modifications) when available,
        // otherwise use GitHub tasks (fresh API data)
        const tasks = githubTasksForRepo.map((githubTask) => {
          // Check if this GitHub task is imported (exists in main taskStore)
          const importedTask = importedForRepo.find(
            (task) => task.source.keys.github === githubTask.source.keys.github
          );

          if (importedTask) {
            // Use the imported task from main store (has user modifications like doDate)
            // but ensure source.data is fresh from GitHub API
            return {
              ...importedTask,
              source: {
                ...importedTask.source,
                data: githubTask.source.data, // Fresh GitHub API data
              },
              imported: true,
            } as Task & { imported: boolean };
          } else {
            // Use the GitHub task from entity store (fresh API data)
            return {
              ...githubTask,
              imported: false,
            } as Task & { imported: boolean };
          }
        });

        return tasks;
      }
    );
  }

  /**
   * Refresh GitHub data by reloading from source
   * Updated to use TaskSourceManager which handles store updates and API fetching
   */
  async refresh(): Promise<void> {
    try {
      console.log(
        "[GitHubExtension] refresh() called - starting GitHub refresh..."
      );
      console.log("Refreshing GitHub data via TaskSourceManager...");

      // Clear all caches to force fresh data fetch
      console.log("[GitHubExtension] Clearing cache...");
      await this.clearCache();
      console.log("[GitHubExtension] Cache cleared");

      // Use TaskSourceManager to refresh tasks from GitHubTaskSource
      // The GitHubTaskSource will now:
      // 1. Get current filters from this extension
      // 2. Fetch fresh data from GitHub API based on filters
      // 3. Update this extension's reactive cache for UI reactivity
      // 4. Transform GitHub items into tasks
      // 5. Return all tasks (both imported and non-imported)
      // 6. TaskSourceManager dispatches LOAD_SOURCE_SUCCESS with fresh tasks
      // 7. Store reducer handles replacing old tasks with fresh ones
      console.log(
        "[GitHubExtension] Calling taskSourceManager.refreshSource('github')..."
      );
      await taskSourceManager.refreshSource("github");
      console.log(
        "[GitHubExtension] taskSourceManager.refreshSource completed"
      );

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
   * For GitHub tasks, uses canonical GitHub data (updated_at, created_at) instead of Task entity timestamps
   */
  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    return [...tasks].sort((a, b) => {
      for (const { key, direction } of sortFields) {
        let aVal: any;
        let bVal: any;

        // Map common sort keys to GitHub canonical data fields
        if (key === "updatedAt") {
          // Use GitHub's updated_at from source.data
          aVal = a.source?.data?.updated_at
            ? new Date(a.source.data.updated_at)
            : null;
          bVal = b.source?.data?.updated_at
            ? new Date(b.source.data.updated_at)
            : null;
        } else if (key === "createdAt") {
          // Use GitHub's created_at from source.data
          aVal = a.source?.data?.created_at
            ? new Date(a.source.data.created_at)
            : null;
          bVal = b.source?.data?.created_at
            ? new Date(b.source.data.created_at)
            : null;
        } else {
          // For other fields, use Task entity properties
          aVal = a[key as keyof Task];
          bVal = b[key as keyof Task];
        }

        let comparison = 0;

        // Handle null/undefined values
        if (aVal == null && bVal == null) {
          comparison = 0;
        } else if (aVal == null) {
          comparison = 1; // null sorts to end
        } else if (bVal == null) {
          comparison = -1; // null sorts to end
        } else if (aVal < bVal) {
          comparison = -1;
        } else if (aVal > bVal) {
          comparison = 1;
        }

        if (comparison !== 0) {
          return direction === "desc" ? -comparison : comparison;
        }
      }
      return 0;
    });
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
    console.log("[GitHubExtension] clearCache() starting...");
    // Clear all cache instances
    if (this.issuesCache) {
      console.log("[GitHubExtension] Clearing issues cache...");
      await this.issuesCache.clear();
      console.log("[GitHubExtension] Issues cache cleared");
    }

    if (this.labelsCache) {
      console.log("[GitHubExtension] Clearing labels cache...");
      await this.labelsCache.clear();
      console.log("[GitHubExtension] Labels cache cleared");
    }

    if (this.repositoriesCache) {
      console.log("[GitHubExtension] Clearing repositories cache...");
      await this.repositoriesCache.clear();
      console.log("[GitHubExtension] Repositories cache cleared");
    }

    if (this.organizationsCache) {
      try {
        console.log("[GitHubExtension] Clearing organizations cache...");
        await this.organizationsCache.clear();
        console.log("[GitHubExtension] Organizations cache cleared");
      } catch (error) {
        console.error(
          "[GitHubExtension] Failed to clear organizations cache:",
          error
        );
      }
    }
    console.log("[GitHubExtension] clearCache() completed");
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
