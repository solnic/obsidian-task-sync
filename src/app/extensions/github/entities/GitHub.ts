/**
 * GitHub-specific Entity Operations
 * Extends base entity operations to add GitHub-specific behavior for importing issues/PRs
 */

import { Task } from "../../../core/entities";
import { Tasks } from "../../../entities/Tasks";
import type {
  GitHubIssue,
  GitHubPullRequest,
} from "../../../cache/schemas/github";
import type {
  TaskSyncSettings,
  GitHubOrgRepoMapping,
} from "../../../types/settings";
import { GitHubOrgRepoMapper } from "../services/GitHubOrgRepoMapper";

/**
 * GitHub namespace containing extension-specific operations
 */
export namespace GitHub {
  /**
   * GitHub-specific Task Operations
   * Handles importing GitHub issues and PRs as tasks
   */
  export class TaskOperations extends Tasks.Operations {
    private orgRepoMapper: GitHubOrgRepoMapper;

    constructor(settings: TaskSyncSettings) {
      super(settings);

      // Initialize organization/repository mapper
      this.orgRepoMapper = new GitHubOrgRepoMapper(
        settings.integrations.github.orgRepoMappings || []
      );
    }

    /**
     * Update the organization/repository mappings
     */
    updateOrgRepoMappings(mappings: GitHubOrgRepoMapping[]): void {
      this.orgRepoMapper.setMappings(mappings);
    }

    /**
     * Transform a GitHub issue to a Task object (without persisting)
     * Used for displaying GitHub issues as tasks in the UI
     */
    transformIssueToTask(
      issue: GitHubIssue,
      repository?: string
    ): Omit<Task, "id" | "createdAt" | "updatedAt"> {
      const baseTaskData = {
        title: issue.title,
        description: issue.body || "",
        category: this.extractCategoryFromLabels(issue.labels),
        status: undefined as any, // Let schema apply default "Backlog" status
        priority: this.extractPriorityFromLabels(issue.labels),
        done: issue.state === "closed",
        project: repository || "",
        areas: [] as string[],
        parentTask: "",
        doDate: undefined as Date | undefined,
        dueDate: undefined as Date | undefined,
        tags: [] as string[], // Do not set tags from GitHub labels
        source: {
          extension: "github",
          keys: {
            github: issue.html_url,
          },
          data: issue, // Store original GitHub issue data
        },
      };

      // Apply organization/repository mappings if repository is provided
      if (repository) {
        const enhancedData = this.orgRepoMapper.enhanceTaskData(repository, {
          project: baseTaskData.project,
          areas: baseTaskData.areas,
        });

        baseTaskData.project = enhancedData.project || baseTaskData.project;
        baseTaskData.areas = enhancedData.areas || baseTaskData.areas;
      }

      return baseTaskData;
    }

    /**
     * Import a GitHub issue as a task
     * Transforms GitHub issue data to Task entity with GitHub source metadata
     */
    async importIssue(issue: GitHubIssue, repository?: string): Promise<Task> {
      const taskData = this.transformIssueToTask(issue, repository);

      // Use base create method which handles ID generation and event triggering
      return await this.create(taskData);
    }

    /**
     * Transform a GitHub pull request to a Task object (without persisting)
     * Used for displaying GitHub PRs as tasks in the UI
     */
    transformPullRequestToTask(
      pr: GitHubPullRequest,
      repository?: string
    ): Omit<Task, "id" | "createdAt" | "updatedAt"> {
      const baseTaskData = {
        title: pr.title,
        description: pr.body || "",
        category: this.extractCategoryFromLabels(pr.labels),
        status: undefined as any, // Let schema apply default "Backlog" status
        priority: this.extractPriorityFromLabels(pr.labels),
        done: pr.state === "closed" || pr.merged_at !== null,
        project: repository || "",
        areas: [] as string[],
        parentTask: "",
        doDate: undefined as Date | undefined,
        dueDate: undefined as Date | undefined,
        tags: [] as string[], // Do not set tags from GitHub labels
        source: {
          extension: "github",
          keys: {
            github: pr.html_url,
          },
          data: pr, // Store original GitHub PR data
        },
      };

      // Apply organization/repository mappings if repository is provided
      if (repository) {
        const enhancedData = this.orgRepoMapper.enhanceTaskData(repository, {
          project: baseTaskData.project,
          areas: baseTaskData.areas,
        });

        baseTaskData.project = enhancedData.project || baseTaskData.project;
        baseTaskData.areas = enhancedData.areas || baseTaskData.areas;
      }

      return baseTaskData;
    }

    /**
     * Import a GitHub pull request as a task
     * Transforms GitHub PR data to Task entity with GitHub source metadata
     */
    async importPullRequest(
      pr: GitHubPullRequest,
      repository?: string
    ): Promise<Task> {
      const taskData = this.transformPullRequestToTask(pr, repository);

      // Use base create method which handles ID generation and event triggering
      return await this.create(taskData);
    }

    /**
     * Extract category from GitHub labels
     * Maps GitHub labels to available task categories case-insensitively
     */
    private extractCategoryFromLabels(
      labels: Array<{ name: string; color?: string }>
    ): string {
      // Get available categories from user's configured task types
      const availableCategories = this.settings.taskCategories.map(
        (taskCategory) => taskCategory.name
      );

      for (const label of labels) {
        const labelName = label.name.trim().toLowerCase();

        // Find matching category (case-insensitive)
        const matchedCategory = availableCategories.find(
          (category) => category.toLowerCase() === labelName
        );

        if (matchedCategory) {
          return matchedCategory; // Return with proper casing
        }
      }

      return "Task"; // Default category
    }

    /**
     * Extract priority from GitHub labels
     * Looks for labels that indicate priority
     */
    private extractPriorityFromLabels(
      labels: Array<{ name: string; color?: string }>
    ): string {
      const priorityMap: Record<string, string> = {
        "priority: high": "High",
        "priority: critical": "Critical",
        "priority: low": "Low",
        "priority: medium": "Medium",
        high: "High",
        critical: "Critical",
        low: "Low",
        medium: "Medium",
      };

      for (const label of labels) {
        const labelName = label.name.toLowerCase();
        if (priorityMap[labelName]) {
          return priorityMap[labelName];
        }
      }

      return ""; // No priority
    }
  }

  /**
   * Factory class to create GitHub operations
   */
  export class Operations {
    public readonly tasks: TaskOperations;

    constructor(settings: TaskSyncSettings) {
      this.tasks = new TaskOperations(settings);
    }
  }
}

// Singleton operations removed - operations should be instantiated with settings
