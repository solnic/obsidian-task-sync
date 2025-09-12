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
import { taskStore } from "../stores/taskStore";
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
    console.log("🐙 SERVICE: fetchOrganizations called");

    if (!this.octokit) {
      console.error(
        "🐙 SERVICE: GitHub integration is not enabled or configured"
      );
      throw new Error("GitHub integration is not enabled or configured");
    }

    const cacheKey = this.generateCacheKey("organizations");
    console.log(`🐙 SERVICE: Using cache key: ${cacheKey}`);

    // Check cache first
    if (this.organizationsCache) {
      const cachedOrgs = await this.organizationsCache.get(cacheKey);
      if (cachedOrgs) {
        console.log(
          `🐙 SERVICE: Found ${cachedOrgs.length} organizations in cache`
        );
        return cachedOrgs;
      } else {
        console.log("🐙 SERVICE: No organizations found in cache");
      }
    } else {
      console.log("🐙 SERVICE: Organizations cache not initialized");
    }

    try {
      console.log("🐙 SERVICE: Making API call to fetch organizations...");
      console.log(
        "🐙 SERVICE: Token configured:",
        !!this.settings.githubIntegration.personalAccessToken
      );
      console.log(
        "🐙 SERVICE: Token length:",
        this.settings.githubIntegration.personalAccessToken?.length || 0
      );

      // Check token scopes by making a request and examining headers
      try {
        console.log("🐙 SERVICE: Checking token scopes...");
        const scopeCheckResponse = await this.octokit.request("GET /user");
        const scopes = scopeCheckResponse.headers["x-oauth-scopes"];
        const acceptedScopes =
          scopeCheckResponse.headers["x-accepted-oauth-scopes"];
        console.log("🐙 SERVICE: Current token scopes:", scopes);
        console.log(
          "🐙 SERVICE: Token scopes (split):",
          scopes?.split(", ") || []
        );
        console.log(
          "🐙 SERVICE: Accepted scopes for /user endpoint:",
          acceptedScopes
        );

        // Check if we have read:org scope
        const hasReadOrg =
          scopes?.includes("read:org") || scopes?.includes("admin:org");
        console.log("🐙 SERVICE: Has read:org or admin:org scope:", hasReadOrg);

        // Now check what scopes are needed for /user/orgs
        console.log(
          "🐙 SERVICE: Testing /user/orgs endpoint with current token..."
        );
        const orgsTestResponse = await this.octokit.request("GET /user/orgs", {
          per_page: 1,
        });
        const orgsAcceptedScopes =
          orgsTestResponse.headers["x-accepted-oauth-scopes"];
        console.log(
          "🐙 SERVICE: Accepted scopes for /user/orgs endpoint:",
          orgsAcceptedScopes
        );
        console.log(
          "🐙 SERVICE: /user/orgs test response status:",
          orgsTestResponse.status
        );
        console.log(
          "🐙 SERVICE: /user/orgs test response data length:",
          orgsTestResponse.data.length
        );
        console.log(
          "🐙 SERVICE: /user/orgs test response data:",
          orgsTestResponse.data
        );

        // Also try the /user/memberships/orgs endpoint
        console.log("🐙 SERVICE: Testing /user/memberships/orgs endpoint...");
        try {
          const membershipsResponse = await this.octokit.request(
            "GET /user/memberships/orgs"
          );
          console.log(
            "🐙 SERVICE: Memberships response status:",
            membershipsResponse.status
          );
          console.log(
            "🐙 SERVICE: Memberships response data length:",
            membershipsResponse.data.length
          );
          console.log(
            "🐙 SERVICE: Memberships response data:",
            membershipsResponse.data
          );

          // If memberships returns data but /user/orgs doesn't, it's a visibility issue
          if (membershipsResponse.data.length > 0) {
            console.warn(
              "🐙 SERVICE: ⚠️ Found organizations via memberships but not via /user/orgs!"
            );
            console.warn(
              "🐙 SERVICE: This suggests organization membership visibility is set to private."
            );
            console.warn(
              "🐙 SERVICE: You may need to make your membership public for organizations to appear."
            );
          }
        } catch (membershipsError) {
          console.error(
            "🐙 SERVICE: Error with memberships endpoint:",
            membershipsError
          );
          console.error("🐙 SERVICE: Memberships error details:", {
            status: membershipsError.status,
            message: membershipsError.message,
            response: membershipsError.response?.data,
          });
        }

        // Let's also try to get ALL repositories with pagination to see if we can derive organizations from them
        console.log(
          "🐙 SERVICE: Testing repository access to derive organizations (with pagination)..."
        );
        try {
          const allRepos: any[] = [];
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            console.log(`🐙 SERVICE: Fetching repositories page ${page}...`);
            const reposResponse = await this.octokit.request(
              "GET /user/repos",
              {
                per_page: 100,
                page: page,
                type: "all",
                sort: "updated",
              }
            );

            console.log(
              `🐙 SERVICE: Page ${page} repos response status:`,
              reposResponse.status
            );
            console.log(
              `🐙 SERVICE: Page ${page} repos count:`,
              reposResponse.data.length
            );

            allRepos.push(...reposResponse.data);

            // Check if we have more pages
            hasMore = reposResponse.data.length === 100;
            page++;

            // Safety check to prevent infinite loops
            if (page > 50) {
              console.warn(
                "🐙 SERVICE: Stopping pagination after 50 pages (5000 repos) for safety"
              );
              break;
            }
          }

          console.log(
            "🐙 SERVICE: Total repositories fetched across all pages:",
            allRepos.length
          );

          // Extract unique organizations from repository full names
          const orgsFromRepos = new Set<string>();
          const userLogin = (await this.octokit.rest.users.getAuthenticated())
            .data.login;

          allRepos.forEach((repo: any) => {
            const [owner] = repo.full_name.split("/");
            // Only add if it's not the user's own repos and the owner type is Organization
            if (owner !== userLogin && repo.owner.type === "Organization") {
              orgsFromRepos.add(owner);
              console.log(
                `🐙 SERVICE: Found org repo: ${repo.full_name} (owner type: ${repo.owner.type})`
              );
            }
          });

          console.log(
            "🐙 SERVICE: Organizations derived from repositories:",
            Array.from(orgsFromRepos)
          );

          if (orgsFromRepos.size > 0) {
            console.warn(
              "🐙 SERVICE: ⚠️ Found organizations via repositories but not via /user/orgs!"
            );
            console.warn(
              "🐙 SERVICE: This confirms the issue is with organization membership visibility or token scopes."
            );
            console.warn(
              "🐙 SERVICE: Organizations found in repos:",
              Array.from(orgsFromRepos)
            );
          } else {
            console.log(
              "🐙 SERVICE: No organization repositories found - user may not be a member of any organizations."
            );
          }
        } catch (reposError) {
          console.error("🐙 SERVICE: Error fetching repositories:", reposError);
        }
      } catch (scopeError) {
        console.error("🐙 SERVICE: Error checking scopes:", scopeError);
        console.error(
          "🐙 SERVICE: This might indicate insufficient token permissions"
        );
      }

      const response = await this.octokit.rest.orgs.listForAuthenticatedUser({
        per_page: 100,
      });

      console.log("🐙 SERVICE: Raw API response status:", response.status);
      console.log("🐙 SERVICE: Raw API response headers:", response.headers);
      console.log("🐙 SERVICE: Raw API response data:", response.data);

      const organizations = response.data as GitHubOrganization[];
      console.log(
        `🐙 SERVICE: API returned ${organizations.length} organizations:`,
        organizations.map((org) => org.login)
      );

      // If no organizations are returned, provide helpful guidance
      if (organizations.length === 0) {
        console.warn(
          "🐙 SERVICE: ⚠️  No organizations returned from GitHub API!"
        );
        console.warn("🐙 SERVICE: This could be due to:");
        console.warn(
          "🐙 SERVICE: 1. Token missing 'read:org' scope (most likely cause)"
        );
        console.warn(
          "🐙 SERVICE: 2. User is not a member of any organizations"
        );
        console.warn(
          "🐙 SERVICE: 3. All organizations have private membership"
        );
        console.warn("🐙 SERVICE: ");
        console.warn(
          "🐙 SERVICE: To fix this, ensure your Personal Access Token has the 'read:org' scope:"
        );
        console.warn(
          "🐙 SERVICE: 1. Go to GitHub Settings > Developer settings > Personal access tokens"
        );
        console.warn(
          "🐙 SERVICE: 2. Edit your token and check the 'read:org' scope"
        );
        console.warn("🐙 SERVICE: 3. Update the token in the plugin settings");
      }

      // Let's also try to get the current user to verify authentication
      try {
        const userResponse = await this.octokit.rest.users.getAuthenticated();
        console.log("🐙 SERVICE: Authenticated user:", userResponse.data.login);
        console.log("🐙 SERVICE: User type:", userResponse.data.type);
        console.log(
          "🐙 SERVICE: User public repos:",
          userResponse.data.public_repos
        );
      } catch (userError) {
        console.error(
          "🐙 SERVICE: Failed to get authenticated user:",
          userError
        );
      }

      // Cache the results
      if (this.organizationsCache) {
        await this.organizationsCache.set(cacheKey, organizations);
        console.log("🐙 SERVICE: Organizations cached successfully");
      } else {
        console.log(
          "🐙 SERVICE: Could not cache organizations - cache not initialized"
        );
      }

      return organizations;
    } catch (error) {
      console.error("🐙 SERVICE: Error fetching organizations:", error);
      console.error("🐙 SERVICE: Error details:", {
        message: error.message,
        status: error.status,
        response: error.response?.data,
      });
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
    console.log("🐙 SERVICE: Clearing all GitHub caches...");

    // Clear all cache instances
    if (this.issuesCache) {
      await this.issuesCache.clear();
      console.log("🐙 SERVICE: Issues cache cleared");
    } else {
      console.log("🐙 SERVICE: Issues cache not initialized");
    }

    if (this.labelsCache) {
      await this.labelsCache.clear();
      console.log("🐙 SERVICE: Labels cache cleared");
    } else {
      console.log("🐙 SERVICE: Labels cache not initialized");
    }

    if (this.repositoriesCache) {
      await this.repositoriesCache.clear();
      console.log("🐙 SERVICE: Repositories cache cleared");
    } else {
      console.log("🐙 SERVICE: Repositories cache not initialized");
    }

    if (this.organizationsCache) {
      await this.organizationsCache.clear();
      console.log("🐙 SERVICE: Organizations cache cleared");
    } else {
      console.log("🐙 SERVICE: Organizations cache not initialized");
    }

    console.log("🐙 SERVICE: All GitHub cache clearing completed");
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
    if (!this.taskImportManager) {
      const error =
        "Import dependencies not initialized. Call setImportDependencies() first.";
      throw new Error(error);
    }

    try {
      const taskData = this.transformIssueToTaskData(issue);

      // Check if task is already imported using task store
      if (taskStore.isTaskImported(taskData.sourceType, taskData.id)) {
        return {
          success: true,
          skipped: true,
          reason: "Task already imported",
        };
      }

      // Enhance config with label-based task type mapping
      const enhancedConfig = this.enhanceConfigWithLabelMapping(issue, config);

      // Create the task
      const taskPath = await this.taskImportManager.createTaskFromData(
        taskData,
        enhancedConfig
      );

      // Task store will automatically pick up the new task via file watchers
      return {
        success: true,
        taskPath,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Import GitHub pull request as Obsidian task
   */
  async importPullRequestAsTask(
    pullRequest: GitHubPullRequest,
    config: TaskImportConfig
  ): Promise<ImportResult> {
    if (!this.taskImportManager) {
      const error =
        "Import dependencies not initialized. Call setImportDependencies() first.";
      throw new Error(error);
    }

    try {
      const taskData = this.transformPullRequestToTaskData(pullRequest);

      // Check if task is already imported using task store
      if (taskStore.isTaskImported(taskData.sourceType, taskData.id)) {
        return {
          success: true,
          skipped: true,
          reason: "Task already imported",
        };
      }

      // Enhance config with label-based task type mapping
      const enhancedConfig = this.enhanceConfigWithLabelMapping(
        pullRequest,
        config
      );

      // Create the task
      const taskPath = await this.taskImportManager.createTaskFromData(
        taskData,
        enhancedConfig
      );

      // Task store will automatically pick up the new task via file watchers
      return {
        success: true,
        taskPath,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
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
