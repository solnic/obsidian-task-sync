/**
 * GitHub API Service
 * Wraps Octokit to provide a focused interface for GitHub integration
 * Uses Obsidian's request function for HTTP calls
 */

import { Octokit } from "@octokit/rest";
import { requestUrl } from "obsidian";
import {
  GitHubIntegrationSettings,
  TaskSyncSettings,
} from "../components/ui/settings/types";
import {
  ExternalTaskData,
  TaskImportConfig,
  ImportResult,
} from "../types/integrations";
import { GitHubLabelTypeMapper } from "./GitHubLabelTypeMapper";
import { LabelTypeMapper } from "../types/label-mapping";

import { AbstractService } from "./AbstractService";
import { SchemaCache } from "../cache/SchemaCache";
import {
  GitHubIssueListSchema,
  GitHubLabelListSchema,
  GitHubRepositoryListSchema,
  GitHubOrganizationListSchema,
  GitHubIssueList,
  GitHubLabelList,
  GitHubRepositoryList,
  GitHubOrganizationList,
  GitHubIssue as GitHubIssueType,
  GitHubLabel as GitHubLabelType,
  GitHubRepository as GitHubRepositoryType,
  GitHubOrganization as GitHubOrganizationType,
} from "../cache/schemas/github";

// Use schema types directly
export type GitHubIssue = GitHubIssueType;
export type GitHubLabel = GitHubLabelType;
export type GitHubRepository = GitHubRepositoryType;
export type GitHubOrganization = GitHubOrganizationType;

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  assignee: { login: string } | null;
  assignees: Array<{ login: string }>;
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  html_url: string;
  diff_url: string;
  patch_url: string;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: { login: string };
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: { login: string };
  };
  user: { login: string };
  requested_reviewers: Array<{ login: string }>;
  draft: boolean;
}

// GitHubService now uses the full TaskSyncSettings to access all plugin configuration

/**
 * Service for interacting with GitHub API using Octokit
 */
export class GitHubService extends AbstractService {
  private octokit: Octokit | null = null;
  private labelTypeMapper: LabelTypeMapper;

  // Cache instances
  private issuesCache?: SchemaCache<GitHubIssueList>;
  private labelsCache?: SchemaCache<GitHubLabelList>;
  private repositoriesCache?: SchemaCache<GitHubRepositoryList>;
  private organizationsCache?: SchemaCache<GitHubOrganizationList>;

  constructor(settings: TaskSyncSettings) {
    super(settings);

    // Only pass custom label mappings if they exist, otherwise use defaults
    const customMappings = settings.githubIntegration.labelTypeMapping;
    const hasCustomMappings =
      customMappings && Object.keys(customMappings).length > 0;

    this.labelTypeMapper = GitHubLabelTypeMapper.createWithDefaults(
      hasCustomMappings ? { labelToTypeMapping: customMappings } : undefined
    );
    this.initializeOctokit();
  }

  /**
   * Setup GitHub-specific caches
   */
  protected async setupCaches(): Promise<void> {
    this.issuesCache = this.createCache("github-issues", GitHubIssueListSchema);
    this.labelsCache = this.createCache("github-labels", GitHubLabelListSchema);
    this.repositoriesCache = this.createCache(
      "github-repositories",
      GitHubRepositoryListSchema
    );
    this.organizationsCache = this.createCache(
      "github-organizations",
      GitHubOrganizationListSchema
    );
  }

  /**
   * Preload GitHub caches from persistent storage
   */
  protected async preloadCaches(): Promise<void> {
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
   * Set label-to-type mapping configuration
   */
  setLabelTypeMapping(mapping: Record<string, string>): void {
    this.labelTypeMapper.setLabelMapping(mapping);
  }

  /**
   * Get current label-to-type mapping configuration
   */
  getLabelTypeMapping(): Record<string, string> {
    return this.labelTypeMapper.getLabelMapping();
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
   * Update settings and reinitialize components (legacy method)
   * This will be replaced by the event system
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.updateSettingsInternal(newSettings.githubIntegration);
  }

  /**
   * Internal method to update GitHub settings without cache clearing
   * Used by the event system
   */
  updateSettingsInternal(newGitHubSettings: any): void {
    // Update the full settings object
    this.settings = { ...this.settings, githubIntegration: newGitHubSettings };

    // Update label type mapper with new settings
    // Only override mappings if custom mappings are provided, otherwise keep defaults
    const customMappings = newGitHubSettings.labelTypeMapping;
    if (customMappings && Object.keys(customMappings).length > 0) {
      // Merge custom mappings with defaults
      const defaultMappings = GitHubLabelTypeMapper.getDefaultMappings();
      const mergedMappings = { ...defaultMappings, ...customMappings };
      this.labelTypeMapper.setLabelMapping(mergedMappings);
    }
    // If no custom mappings, keep the existing mappings (which should be defaults)

    // Reinitialize Octokit with new settings
    this.initializeOctokit();
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
      } catch (error: any) {
        // Convert Obsidian request errors to fetch-like errors
        throw new Error(`Network request failed: ${error.message}`);
      }
    };
  }

  /**
   * Initialize Octokit client if integration is enabled and token is provided
   */
  private initializeOctokit(): void {
    if (
      this.settings.githubIntegration.enabled &&
      this.settings.githubIntegration.personalAccessToken
    ) {
      this.octokit = new Octokit({
        auth: this.settings.githubIntegration.personalAccessToken,
        userAgent: "obsidian-task-sync",
        request: {
          fetch: this.createObsidianFetch(),
        },
      });
    }
  }

  /**
   * Check if GitHub integration is enabled and properly configured
   */
  isEnabled(): boolean {
    return this.settings.githubIntegration.enabled && !!this.octokit;
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

    const filters = this.settings.githubIntegration.issueFilters;
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

    try {
      const response = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: filters.state,
        assignee: filters.assignee || undefined,
        labels:
          filters.labels.length > 0 ? filters.labels.join(",") : undefined,
        per_page: 100,
      });

      const issues = response.data as GitHubIssue[];

      // Cache the results
      if (this.issuesCache) {
        await this.issuesCache.set(cacheKey, issues);
      }

      return issues;
    } catch (error) {
      throw error;
    }
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
    const filters = this.settings.githubIntegration.issueFilters;

    try {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: filters.state,
        per_page: 100,
      });

      return response.data as GitHubPullRequest[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch repositories for the authenticated user with caching
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

    try {
      const allRepositories: GitHubRepository[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.octokit.rest.repos.listForAuthenticatedUser(
          {
            sort: "updated",
            per_page: 100,
            page: page,
          }
        );

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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch organizations for the authenticated user with caching
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

    try {
      const response = await this.octokit.rest.orgs.listForAuthenticatedUser({
        per_page: 100,
      });

      const organizations = response.data as GitHubOrganization[];

      // Cache the results
      if (this.organizationsCache) {
        await this.organizationsCache.set(cacheKey, organizations);
      }

      return organizations;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch repositories for a specific organization with caching
   */
  async fetchRepositoriesForOrganization(
    org: string
  ): Promise<GitHubRepository[]> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    const cacheKey = this.generateCacheKey("repositories", `${org}/`);

    // Check cache first
    if (this.repositoriesCache) {
      const cachedRepos = await this.repositoriesCache.get(cacheKey);
      if (cachedRepos) {
        return cachedRepos;
      }
    }

    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch labels for a GitHub repository with persistent caching
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

    try {
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
    } catch (error) {
      throw error;
    }
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
   * Clear label cache for a specific repository or all repositories
   */
  async clearLabelCache(repository?: string): Promise<void> {
    if (this.labelsCache) {
      if (repository) {
        const cacheKey = this.generateCacheKey("labels", repository);
        await this.labelsCache.delete(cacheKey);
      } else {
        // Clear all label caches
        await this.labelsCache.clear();
      }
    }
  }

  /**
   * Validate repository format (owner/repo)
   */
  validateRepository(repository: string): boolean {
    if (!repository || typeof repository !== "string") {
      return false;
    }

    const parts = repository.split("/");
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<any> {
    if (!this.octokit) {
      throw new Error("GitHub integration is not enabled or configured");
    }

    try {
      const response = await this.octokit.rest.rateLimit.get();
      return response.data;
    } catch (error) {
      throw error;
    }
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

    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      return {
        login: response.data.login,
        id: response.data.id,
        avatar_url: response.data.avatar_url,
      };
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      return null;
    }
  }

  /**
   * Import GitHub issue as Obsidian task
   */
  async importIssueAsTask(
    issue: GitHubIssue,
    config: TaskImportConfig
  ): Promise<ImportResult> {
    return this.importExternalItem(
      issue,
      config,
      this.transformIssueToTaskData.bind(this),
      this.enhanceConfigWithLabelMapping.bind(this)
    );
  }

  /**
   * Import GitHub pull request as Obsidian task
   */
  async importPullRequestAsTask(
    pullRequest: GitHubPullRequest,
    config: TaskImportConfig
  ): Promise<ImportResult> {
    return this.importExternalItem(
      pullRequest,
      config,
      this.transformPullRequestToTaskData.bind(this),
      this.enhanceConfigWithLabelMapping.bind(this)
    );
  }

  /**
   * Transform GitHub issue to standardized external task data
   */
  transformIssueToTaskData(issue: GitHubIssue): ExternalTaskData {
    return {
      id: `github-${issue.id}`,
      title: issue.title,
      description: issue.body || undefined,
      status: issue.state,
      priority: this.extractPriorityFromLabels(issue.labels),
      assignee: issue.assignee?.login,
      labels: issue.labels.map((label) => label.name),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      externalUrl: issue.html_url,
      sourceType: "github",
      sourceData: {
        number: issue.number,
        state: issue.state,
        id: issue.id,
      },
    };
  }

  /**
   * Transform GitHub pull request to standardized external task data
   */
  transformPullRequestToTaskData(
    pullRequest: GitHubPullRequest
  ): ExternalTaskData {
    // Determine status based on PR state
    let status: string = pullRequest.state;
    if (pullRequest.merged_at) {
      status = "merged";
    } else if (pullRequest.draft) {
      status = "draft";
    }

    return {
      id: `github-pr-${pullRequest.id}`,
      title: pullRequest.title,
      description: pullRequest.body || undefined,
      status: status,
      priority: this.extractPriorityFromLabels(pullRequest.labels),
      assignee: pullRequest.assignee?.login,
      labels: pullRequest.labels.map((label) => label.name),
      createdAt: new Date(pullRequest.created_at),
      updatedAt: new Date(pullRequest.updated_at),
      externalUrl: pullRequest.html_url,
      sourceType: "github",
      sourceData: {
        number: pullRequest.number,
        state: pullRequest.state,
        id: pullRequest.id,
        merged_at: pullRequest.merged_at,
        draft: pullRequest.draft,
        head: pullRequest.head,
        base: pullRequest.base,
        user: pullRequest.user,
        requested_reviewers: pullRequest.requested_reviewers,
      },
    };
  }

  /**
   * Enhance import configuration with label-based task type mapping
   */
  private enhanceConfigWithLabelMapping(
    issue: GitHubIssue,
    config: TaskImportConfig
  ): TaskImportConfig {
    const enhancedConfig = { ...config };

    try {
      // Always try to map task type from labels (even if one is already set)
      if (!issue.labels) {
        issue.labels = [];
      }

      const labels = issue.labels.map((label) => label.name);
      const availableTypes = this.getAvailableTaskTypes();

      const mappedType = this.labelTypeMapper.mapLabelsToType(
        labels,
        availableTypes
      );

      if (mappedType) {
        enhancedConfig.taskType = mappedType;
      } else if (!enhancedConfig.taskType) {
        // Fallback to first available task type if no mapping found and no type set
        const fallbackType = availableTypes[0] || "Task";
        enhancedConfig.taskType = fallbackType;
      }

      return enhancedConfig;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get available task types from settings
   */
  private getAvailableTaskTypes(): string[] {
    if (!this.settings.taskTypes || !Array.isArray(this.settings.taskTypes)) {
      // Return default task types as fallback
      return ["Task", "Bug", "Feature", "Improvement", "Chore"];
    }

    const types = this.settings.taskTypes.map((type) => type.name);
    return types;
  }

  /**
   * Extract priority from GitHub issue labels
   */
  extractPriorityFromLabels(
    labels: Array<{ name: string }>
  ): string | undefined {
    for (const label of labels) {
      const labelName = label.name.toLowerCase();

      // Check for priority: prefix
      if (labelName.startsWith("priority:")) {
        const priority = labelName.split(":")[1]?.trim();
        if (priority) {
          return this.normalizePriority(priority);
        }
      }

      // Check for common priority keywords
      if (labelName.includes("urgent") || labelName.includes("critical")) {
        return "Urgent";
      }
      if (labelName.includes("high")) {
        return "High";
      }
      if (labelName.includes("medium") || labelName.includes("normal")) {
        return "Medium";
      }
      if (labelName.includes("low")) {
        return "Low";
      }
    }

    return undefined;
  }

  /**
   * Normalize priority values to standard format
   */
  private normalizePriority(priority: string): string {
    const normalized = priority.toLowerCase();

    if (normalized.includes("urgent") || normalized.includes("critical")) {
      return "Urgent";
    }
    if (normalized.includes("high")) {
      return "High";
    }
    if (normalized.includes("medium") || normalized.includes("normal")) {
      return "Medium";
    }
    if (normalized.includes("low")) {
      return "Low";
    }

    // Capitalize first letter for unknown priorities
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  }
}
