/**
 * GitHub implementation of ExternalTaskSource interface
 * Provides type-safe GitHub issue/PR to task transformation
 */

import { z } from "zod";
import {
  ExternalTaskSource,
  ValidatedExternalTaskData,
  ExternalTimestamps,
  ExternalTaskDataUtils,
  ExternalTaskSourceError,
  ExternalTaskValidationError,
} from "../../types/ExternalTaskSource";
import {
  GitHubIssueSchema,
  GitHubPullRequestSchema,
  type GitHubIssue,
  type GitHubPullRequest,
} from "../../cache/schemas/github";

/**
 * GitHub-specific task source implementation
 * Handles both issues and pull requests with proper validation
 */
export class GitHubTaskSource implements ExternalTaskSource {
  readonly sourceType = "github" as const;

  /**
   * Transform GitHub issue or PR to validated external task data
   */
  transformToExternalTaskData(rawData: unknown): ValidatedExternalTaskData {
    try {
      // First validate the raw GitHub data
      this.validateRawData(rawData);

      // Determine if it's an issue or PR and transform accordingly
      if (this.isPullRequest(rawData)) {
        return this.transformPullRequestToTaskData(
          rawData as GitHubPullRequest
        );
      } else {
        return this.transformIssueToTaskData(rawData as GitHubIssue);
      }
    } catch (error) {
      if (error instanceof ExternalTaskSourceError) {
        throw error;
      }
      throw new ExternalTaskSourceError(
        `Failed to transform GitHub data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        this.sourceType,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract timestamps from GitHub data with validation
   */
  extractTimestamps(rawData: unknown): ExternalTimestamps {
    try {
      this.validateRawData(rawData);

      const data = rawData as GitHubIssue | GitHubPullRequest;

      return {
        createdAt: ExternalTaskDataUtils.createValidDate(data.created_at),
        updatedAt: ExternalTaskDataUtils.createValidDate(data.updated_at),
      };
    } catch (error) {
      // If validation fails, return null timestamps rather than crashing
      return {
        createdAt: null,
        updatedAt: null,
      };
    }
  }

  /**
   * Validate raw GitHub data against schema
   */
  validateRawData(rawData: unknown): void {
    try {
      if (this.isPullRequest(rawData)) {
        GitHubPullRequestSchema.parse(rawData);
      } else {
        GitHubIssueSchema.parse(rawData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        );
        throw new ExternalTaskValidationError(
          "GitHub data validation failed",
          this.sourceType,
          validationErrors,
          error
        );
      }
      throw new ExternalTaskSourceError(
        "GitHub data validation failed",
        this.sourceType,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Transform GitHub issue to external task data
   */
  private transformIssueToTaskData(
    issue: GitHubIssue
  ): ValidatedExternalTaskData {
    const createdAt = ExternalTaskDataUtils.createValidDate(issue.created_at);
    const updatedAt = ExternalTaskDataUtils.createValidDate(issue.updated_at);

    if (!createdAt || !updatedAt) {
      throw new ExternalTaskSourceError(
        `Invalid timestamps in GitHub issue ${issue.number}: created_at=${issue.created_at}, updated_at=${issue.updated_at}`,
        this.sourceType
      );
    }

    const taskData = {
      id: `github-${issue.id}`,
      title: issue.title,
      description: issue.body || undefined,
      status: issue.state,
      priority: this.extractPriorityFromLabels(issue.labels),
      assignee: issue.assignee?.login,
      labels: issue.labels.map((label) => label.name),
      createdAt,
      updatedAt,
      externalUrl: issue.html_url,
      sourceType: this.sourceType,
    };

    return ExternalTaskDataUtils.validate(taskData);
  }

  /**
   * Transform GitHub pull request to external task data
   */
  private transformPullRequestToTaskData(
    pullRequest: GitHubPullRequest
  ): ValidatedExternalTaskData {
    const createdAt = ExternalTaskDataUtils.createValidDate(
      pullRequest.created_at
    );
    const updatedAt = ExternalTaskDataUtils.createValidDate(
      pullRequest.updated_at
    );

    if (!createdAt || !updatedAt) {
      throw new ExternalTaskSourceError(
        `Invalid timestamps in GitHub PR ${pullRequest.number}: created_at=${pullRequest.created_at}, updated_at=${pullRequest.updated_at}`,
        this.sourceType
      );
    }

    // Determine status based on PR state
    let status: string = pullRequest.state;
    if (pullRequest.merged_at) {
      status = "merged";
    } else if (pullRequest.draft) {
      status = "draft";
    }

    const taskData = {
      id: `github-pr-${pullRequest.id}`,
      title: pullRequest.title,
      description: pullRequest.body || undefined,
      status: status,
      priority: this.extractPriorityFromLabels(pullRequest.labels),
      assignee: pullRequest.assignee?.login,
      labels: pullRequest.labels.map((label) => label.name),
      createdAt,
      updatedAt,
      externalUrl: pullRequest.html_url,
      sourceType: this.sourceType,
    };

    return ExternalTaskDataUtils.validate(taskData);
  }

  /**
   * Check if the data represents a pull request
   */
  private isPullRequest(data: unknown): boolean {
    return typeof data === "object" && data !== null && "merged_at" in data;
  }

  /**
   * Extract priority from GitHub labels
   */
  private extractPriorityFromLabels(
    labels: Array<{ name: string }>
  ): string | undefined {
    const priorityLabels = [
      "priority:high",
      "priority:medium",
      "priority:low",
      "high",
      "medium",
      "low",
    ];

    for (const label of labels) {
      const labelName = label.name.toLowerCase();
      if (priorityLabels.includes(labelName)) {
        // Normalize priority values
        if (labelName.includes("high") || labelName === "high") return "High";
        if (labelName.includes("medium") || labelName === "medium")
          return "Medium";
        if (labelName.includes("low") || labelName === "low") return "Low";
      }
    }

    return undefined;
  }
}
