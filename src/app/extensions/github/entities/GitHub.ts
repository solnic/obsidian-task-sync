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
 * GitHub-specific Task Operations
 * Handles importing GitHub issues and PRs as tasks
 */
export class GitHubTaskOperations extends Tasks.Operations {
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
    const isClosed = issue.state === "closed";
    const status = this.determineStatusFromGitHubState(isClosed);

    const baseTaskData = {
      title: issue.title,
      description: issue.body || "",
      category: this.extractCategoryFromLabels(issue.labels),
      status: status,
      priority: this.extractPriorityFromLabels(issue.labels),
      done: isClosed,
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
    const isClosed = pr.state === "closed" || pr.merged_at !== null;
    const status = this.determineStatusFromGitHubState(isClosed);

    const baseTaskData = {
      title: pr.title,
      description: pr.body || "",
      category: this.extractCategoryFromLabels(pr.labels),
      status: status,
      priority: this.extractPriorityFromLabels(pr.labels),
      done: isClosed,
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

  /**
   * Determine the appropriate status based on GitHub issue/PR state
   * Uses the configured status options from settings
   */
  private determineStatusFromGitHubState(isClosed: boolean): string {
    if (isClosed) {
      // For closed issues/PRs, use the first configured status with isDone=true
      const doneStatus = this.settings.taskStatuses.find(
        (s) => s.isDone === true
      );
      if (doneStatus) {
        return doneStatus.name;
      }
      // Fallback: if no isDone status configured, return first available status
      return this.settings.taskStatuses[0]?.name || "Backlog";
    } else {
      // For open issues/PRs, use the first configured status that is NOT in progress and NOT done
      const notStartedStatus = this.settings.taskStatuses.find(
        (s) => s.isDone === false && s.isInProgress === false
      );
      if (notStartedStatus) {
        return notStartedStatus.name;
      }
      // Fallback: if no not-started status configured, return first available status
      return this.settings.taskStatuses[0]?.name || "Backlog";
    }
  }
}

/**
 * Factory class to create GitHub operations
 */
export class GitHubOperations {
  public readonly tasks: GitHubTaskOperations;

  constructor(settings: TaskSyncSettings) {
    this.tasks = new GitHubTaskOperations(settings);
  }
}

// Singleton operations removed - operations should be instantiated with settings
