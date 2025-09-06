/**
 * GitHub API Service
 * Wraps Octokit to provide a focused interface for GitHub integration
 * Uses Obsidian's request function for HTTP calls
 */

import { Octokit } from '@octokit/rest';
import { requestUrl } from 'obsidian';
import { GitHubIntegrationSettings } from '../components/ui/settings/types';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  assignee: { login: string } | null;
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
}

export interface GitHubServiceSettings {
  githubIntegration: GitHubIntegrationSettings;
}

/**
 * Service for interacting with GitHub API using Octokit
 */
export class GitHubService {
  private octokit: Octokit | null = null;
  private settings: GitHubServiceSettings;

  constructor(settings: GitHubServiceSettings) {
    this.settings = settings;
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
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body,
          throw: false // Don't throw on HTTP errors, let Octokit handle them
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
            get: (name: string): string | null => headersMap.get(name.toLowerCase()) || null,
            has: (name: string): boolean => headersMap.has(name.toLowerCase()),
            entries: () => headersMap.entries(),
            keys: () => headersMap.keys(),
            values: () => headersMap.values(),
            [Symbol.iterator]: () => headersMap.entries()
          },
          json: async () => JSON.parse(response.text),
          text: async () => response.text,
          url: url
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
    if (this.settings.githubIntegration.enabled && this.settings.githubIntegration.personalAccessToken) {
      this.octokit = new Octokit({
        auth: this.settings.githubIntegration.personalAccessToken,
        userAgent: 'obsidian-task-sync',
        request: {
          fetch: this.createObsidianFetch()
        }
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
   * Fetch issues from a GitHub repository
   */
  async fetchIssues(repository: string): Promise<GitHubIssue[]> {
    if (!this.octokit) {
      throw new Error('GitHub integration is not enabled or configured');
    }

    if (!this.validateRepository(repository)) {
      throw new Error('Invalid repository format. Expected: owner/repo');
    }

    const [owner, repo] = repository.split('/');
    const filters = this.settings.githubIntegration.issueFilters;

    try {
      const response = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: filters.state,
        assignee: filters.assignee || undefined,
        labels: filters.labels.length > 0 ? filters.labels.join(',') : undefined,
        per_page: 100
      });

      return response.data as GitHubIssue[];
    } catch (error) {
      console.error('GitHub API error:', error);
      throw error;
    }
  }

  /**
   * Fetch repositories for the authenticated user
   */
  async fetchRepositories(): Promise<GitHubRepository[]> {
    if (!this.octokit) {
      throw new Error('GitHub integration is not enabled or configured');
    }

    try {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });

      return response.data as GitHubRepository[];
    } catch (error) {
      console.error('GitHub API error:', error);
      throw error;
    }
  }

  /**
   * Validate repository format (owner/repo)
   */
  validateRepository(repository: string): boolean {
    if (!repository || typeof repository !== 'string') {
      return false;
    }

    const parts = repository.split('/');
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  }

  /**
   * Update settings and reinitialize Octokit if needed
   */
  updateSettings(settings: GitHubServiceSettings): void {
    this.settings = settings;
    this.initializeOctokit();
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<any> {
    if (!this.octokit) {
      throw new Error('GitHub integration is not enabled or configured');
    }

    try {
      const response = await this.octokit.rest.rateLimit.get();
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error);
      throw error;
    }
  }
}
