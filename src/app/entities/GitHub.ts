/**
 * GitHub-specific Entity Operations
 * Extends base entity operations to add GitHub-specific behavior for importing issues/PRs
 */

import { Task } from "../core/entities";
import { Tasks } from "./Tasks";
import type { GitHubIssue } from "../cache/schemas/github";
import type { GitHubPullRequest } from "../extensions/GitHubExtension";

/**
 * GitHub namespace containing extension-specific operations
 */
export namespace GitHub {
  /**
   * GitHub-specific Task Operations
   * Handles importing GitHub issues and PRs as tasks
   */
  export class TaskOperations extends Tasks.Operations {
    constructor() {
      super();
    }

    /**
     * Import a GitHub issue as a task
     * Transforms GitHub issue data to Task entity with GitHub source metadata
     */
    async importIssue(
      issue: GitHubIssue,
      _repository?: string
    ): Promise<Task> {
      const taskData: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
        title: issue.title,
        description: issue.body || "",
        category: this.extractCategoryFromLabels(issue.labels),
        status: issue.state === "open" ? "Backlog" : "Done",
        priority: this.extractPriorityFromLabels(issue.labels),
        done: issue.state === "closed",
        project: "",
        areas: [],
        parentTask: "",
        doDate: undefined,
        dueDate: undefined,
        tags: issue.labels.map((label) => label.name),
        source: {
          extension: "github",
          url: issue.html_url,
        },
      };

      // Use base create method which handles ID generation and event triggering
      return await this.create(taskData);
    }

    /**
     * Import a GitHub pull request as a task
     * Transforms GitHub PR data to Task entity with GitHub source metadata
     */
    async importPullRequest(
      pr: GitHubPullRequest,
      _repository?: string
    ): Promise<Task> {
      const taskData: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
        title: pr.title,
        description: pr.body || "",
        category: this.extractCategoryFromLabels(pr.labels),
        status: pr.state === "open" ? "In Progress" : "Done",
        priority: this.extractPriorityFromLabels(pr.labels),
        done: pr.state === "closed" || pr.merged_at !== null,
        project: "",
        areas: [],
        parentTask: "",
        doDate: undefined,
        dueDate: undefined,
        tags: pr.labels.map((label) => label.name),
        source: {
          extension: "github",
          url: pr.html_url,
        },
      };

      // Use base create method which handles ID generation and event triggering
      return await this.create(taskData);
    }

    /**
     * Extract category from GitHub labels
     * Looks for labels that match common category patterns
     */
    private extractCategoryFromLabels(
      labels: Array<{ name: string; color?: string }>
    ): string {
      const categoryLabels = [
        "bug",
        "feature",
        "enhancement",
        "documentation",
      ];

      for (const label of labels) {
        const labelName = label.name.toLowerCase();
        if (categoryLabels.includes(labelName)) {
          // Capitalize first letter
          return labelName.charAt(0).toUpperCase() + labelName.slice(1);
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

    constructor() {
      this.tasks = new TaskOperations();
    }
  }
}

// Export default singleton instance
export const githubOperations = new GitHub.Operations();

