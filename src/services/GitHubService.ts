/**
 * GitHub API Service
 * Wraps Octokit to provide a focused interface for GitHub integration
 * Uses Obsidian's request function for HTTP calls
 */

import { Octokit } from '@octokit/rest';
import { requestUrl } from 'obsidian';
import { GitHubIntegrationSettings, TaskSyncSettings } from '../components/ui/settings/types';
import { ExternalTaskData, TaskImportConfig, ImportResult, ImportedTaskMetadata } from '../types/integrations';
import { TaskImportManager } from './TaskImportManager';
import { ImportStatusService } from './ImportStatusService';
import { GitHubLabelTypeMapper } from './GitHubLabelTypeMapper';
import { LabelTypeMapper } from '../types/label-mapping';

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

// GitHubService now uses the full TaskSyncSettings to access all plugin configuration

/**
 * Service for interacting with GitHub API using Octokit
 */
export class GitHubService {
  private octokit: Octokit | null = null;
  private settings: TaskSyncSettings;
  private labelTypeMapper: LabelTypeMapper;

  // Import functionality dependencies (injected for testing)
  public taskImportManager?: TaskImportManager;
  public importStatusService?: ImportStatusService;

  constructor(settings: TaskSyncSettings) {
    this.settings = settings;

    // Only pass custom label mappings if they exist, otherwise use defaults
    const customMappings = settings.githubIntegration.labelTypeMapping;
    const hasCustomMappings = customMappings && Object.keys(customMappings).length > 0;

    this.labelTypeMapper = GitHubLabelTypeMapper.createWithDefaults(
      hasCustomMappings ? { labelToTypeMapping: customMappings } : undefined
    );
    this.initializeOctokit();
  }

  /**
   * Set import dependencies (for dependency injection)
   */
  setImportDependencies(taskImportManager: TaskImportManager, importStatusService: ImportStatusService): void {
    this.taskImportManager = taskImportManager;
    this.importStatusService = importStatusService;
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
   * Update settings and reinitialize components
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;

    // Update label type mapper with new settings
    // Only override mappings if custom mappings are provided, otherwise keep defaults
    const customMappings = newSettings.githubIntegration.labelTypeMapping;
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

  /**
   * Import GitHub issue as Obsidian task
   */
  async importIssueAsTask(
    issue: GitHubIssue,
    config: TaskImportConfig
  ): Promise<ImportResult> {
    console.log('🔧 GitHubService.importIssueAsTask called with:', {
      issueId: issue.id,
      issueTitle: issue.title,
      config
    });

    if (!this.taskImportManager || !this.importStatusService) {
      const error = 'Import dependencies not initialized. Call setImportDependencies() first.';
      console.error('❌ GitHubService import error:', error);
      throw new Error(error);
    }

    try {
      console.log('🔧 Transforming issue to task data...');
      const taskData = this.transformIssueToTaskData(issue);
      console.log('✅ Task data transformed:', taskData);

      // Check if task is already imported
      console.log('🔧 Checking if task is already imported...');
      if (this.importStatusService.isTaskImported(taskData.id, taskData.sourceType)) {
        console.log('⚠️ Task already imported, skipping');
        return {
          success: true,
          skipped: true,
          reason: 'Task already imported'
        };
      }

      // Enhance config with label-based task type mapping
      console.log('🔧 Enhancing config with label mapping...');
      console.log('🔧 Issue labels:', issue.labels);
      console.log('🔧 Settings taskTypes:', this.settings.taskTypes);

      const enhancedConfig = this.enhanceConfigWithLabelMapping(issue, config);
      console.log('✅ Enhanced config:', enhancedConfig);

      // Create the task
      console.log('🔧 Creating task from data...');
      const taskPath = await this.taskImportManager.createTaskFromData(taskData, enhancedConfig);
      console.log('✅ Task created at path:', taskPath);

      // Record the import
      console.log('🔧 Recording import metadata...');
      const importMetadata: ImportedTaskMetadata = {
        externalId: taskData.id,
        externalSource: taskData.sourceType,
        taskPath,
        importedAt: new Date(),
        lastSyncedAt: new Date(),
        externalUrl: taskData.externalUrl,
        importConfig: config
      };

      this.importStatusService.recordImport(importMetadata);
      console.log('✅ Import recorded successfully');

      return {
        success: true,
        taskPath
      };
    } catch (error: any) {
      console.error('❌ GitHubService import error:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        cause: error.cause
      });

      return {
        success: false,
        error: error.message
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
      labels: issue.labels.map(label => label.name),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      externalUrl: issue.html_url,
      sourceType: 'github',
      sourceData: {
        number: issue.number,
        state: issue.state,
        id: issue.id
      }
    };
  }

  /**
   * Enhance import configuration with label-based task type mapping
   */
  private enhanceConfigWithLabelMapping(issue: GitHubIssue, config: TaskImportConfig): TaskImportConfig {
    console.log('🔧 enhanceConfigWithLabelMapping called with:', {
      issueLabels: issue.labels,
      config
    });

    const enhancedConfig = { ...config };

    try {
      // Always try to map task type from labels (even if one is already set)
      if (!issue.labels) {
        console.warn('⚠️ Issue has no labels property, using empty array');
        issue.labels = [];
      }

      const labels = issue.labels.map(label => label.name);
      console.log('🔧 Extracted label names:', labels);

      const availableTypes = this.getAvailableTaskTypes();
      console.log('🔧 Available task types:', availableTypes);

      const mappedType = this.labelTypeMapper.mapLabelsToType(labels, availableTypes);
      console.log('🔧 Mapped type from labels:', mappedType);

      if (mappedType) {
        enhancedConfig.taskType = mappedType;
        console.log('✅ Set task type from mapping:', mappedType);
      } else if (!enhancedConfig.taskType) {
        // Fallback to first available task type if no mapping found and no type set
        const fallbackType = availableTypes[0] || 'Task';
        enhancedConfig.taskType = fallbackType;
        console.log('✅ Set fallback task type:', fallbackType);
      }

      console.log('✅ Final enhanced config:', enhancedConfig);
      return enhancedConfig;
    } catch (error: any) {
      console.error('❌ Error in enhanceConfigWithLabelMapping:', error);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Get available task types from settings
   */
  private getAvailableTaskTypes(): string[] {
    console.log('🔧 getAvailableTaskTypes called');
    console.log('🔧 this.settings:', this.settings);
    console.log('🔧 this.settings.taskTypes:', this.settings.taskTypes);

    if (!this.settings.taskTypes || !Array.isArray(this.settings.taskTypes)) {
      console.error('❌ this.settings.taskTypes is undefined or not an array!');
      console.log('🔧 Using fallback task types');
      // Return default task types as fallback
      return ['Task', 'Bug', 'Feature', 'Improvement', 'Chore'];
    }

    const types = this.settings.taskTypes.map(type => type.name);
    console.log('✅ Available task types:', types);
    return types;
  }

  /**
   * Extract priority from GitHub issue labels
   */
  extractPriorityFromLabels(labels: Array<{ name: string }>): string | undefined {
    for (const label of labels) {
      const labelName = label.name.toLowerCase();

      // Check for priority: prefix
      if (labelName.startsWith('priority:')) {
        const priority = labelName.split(':')[1]?.trim();
        if (priority) {
          return this.normalizePriority(priority);
        }
      }

      // Check for common priority keywords
      if (labelName.includes('urgent') || labelName.includes('critical')) {
        return 'Urgent';
      }
      if (labelName.includes('high')) {
        return 'High';
      }
      if (labelName.includes('medium') || labelName.includes('normal')) {
        return 'Medium';
      }
      if (labelName.includes('low')) {
        return 'Low';
      }
    }

    return undefined;
  }

  /**
   * Normalize priority values to standard format
   */
  private normalizePriority(priority: string): string {
    const normalized = priority.toLowerCase();

    if (normalized.includes('urgent') || normalized.includes('critical')) {
      return 'Urgent';
    }
    if (normalized.includes('high')) {
      return 'High';
    }
    if (normalized.includes('medium') || normalized.includes('normal')) {
      return 'Medium';
    }
    if (normalized.includes('low')) {
      return 'Low';
    }

    // Capitalize first letter for unknown priorities
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  }
}
