/**
 * Tests for GitHubTaskSource
 * Verifies that GitHub data is properly validated and transformed
 */

import { GitHubTaskSource } from "../../../../src/services/sources/GitHubTaskSource";
import {
  ExternalTaskSourceError,
  ExternalTaskValidationError,
} from "../../../../src/types/ExternalTaskSource";

describe("GitHubTaskSource", () => {
  let taskSource: GitHubTaskSource;

  beforeEach(() => {
    taskSource = new GitHubTaskSource();
  });

  describe("transformToExternalTaskData", () => {
    it("should transform valid GitHub issue to external task data", () => {
      const validIssue = {
        id: 123,
        number: 456,
        title: "Test Issue",
        body: "Test description",
        state: "open",
        assignee: { login: "testuser" },
        labels: [{ name: "bug" }],
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T15:30:00Z",
        html_url: "https://github.com/test/repo/issues/456",
      };

      const result = taskSource.transformToExternalTaskData(validIssue);

      expect(result.id).toBe("github-123");
      expect(result.title).toBe("Test Issue");
      expect(result.description).toBe("Test description");
      expect(result.status).toBe("open");
      expect(result.assignee).toBe("testuser");
      expect(result.labels).toEqual(["bug"]);
      expect(result.createdAt).toEqual(new Date("2024-01-01T10:00:00Z"));
      expect(result.updatedAt).toEqual(new Date("2024-01-02T15:30:00Z"));
      expect(result.externalUrl).toBe("https://github.com/test/repo/issues/456");
      expect(result.sourceType).toBe("github");
    });

    it("should transform valid GitHub pull request to external task data", () => {
      const validPR = {
        id: 789,
        number: 101,
        title: "Test PR",
        body: "Test PR description",
        state: "open",
        assignee: null,
        assignees: [],
        labels: [{ name: "enhancement" }],
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T15:30:00Z",
        closed_at: null,
        merged_at: null,
        html_url: "https://github.com/test/repo/pull/101",
        diff_url: "https://github.com/test/repo/pull/101.diff",
        patch_url: "https://github.com/test/repo/pull/101.patch",
        head: {
          label: "user:feature-branch",
          ref: "feature-branch",
          sha: "abc123",
          user: { login: "testuser" },
        },
        base: {
          label: "user:main",
          ref: "main",
          sha: "def456",
          user: { login: "testuser" },
        },
        user: { login: "testuser" },
        requested_reviewers: [],
        draft: false,
      };

      const result = taskSource.transformToExternalTaskData(validPR);

      expect(result.id).toBe("github-pr-789");
      expect(result.title).toBe("Test PR");
      expect(result.status).toBe("open");
      expect(result.sourceType).toBe("github");
    });

    it("should throw ExternalTaskSourceError for invalid timestamps", () => {
      const invalidIssue = {
        id: 123,
        number: 456,
        title: "Test Issue",
        body: "Test description",
        state: "open",
        assignee: null,
        labels: [],
        created_at: "invalid-date",
        updated_at: "2024-01-02T15:30:00Z",
        html_url: "https://github.com/test/repo/issues/456",
      };

      expect(() => {
        taskSource.transformToExternalTaskData(invalidIssue);
      }).toThrow(ExternalTaskSourceError);
    });

    it("should throw ExternalTaskValidationError for invalid GitHub data structure", () => {
      const invalidData = {
        // Missing required fields
        title: "Test Issue",
      };

      expect(() => {
        taskSource.transformToExternalTaskData(invalidData);
      }).toThrow(ExternalTaskValidationError);
    });
  });

  describe("extractTimestamps", () => {
    it("should extract valid timestamps from GitHub issue", () => {
      const validIssue = {
        id: 123,
        number: 456,
        title: "Test Issue",
        body: "Test description",
        state: "open",
        assignee: null,
        labels: [],
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T15:30:00Z",
        html_url: "https://github.com/test/repo/issues/456",
      };

      const timestamps = taskSource.extractTimestamps(validIssue);

      expect(timestamps.createdAt).toEqual(new Date("2024-01-01T10:00:00Z"));
      expect(timestamps.updatedAt).toEqual(new Date("2024-01-02T15:30:00Z"));
    });

    it("should return null timestamps for invalid dates", () => {
      const invalidIssue = {
        id: 123,
        number: 456,
        title: "Test Issue",
        body: "Test description",
        state: "open",
        assignee: null,
        labels: [],
        created_at: "invalid-date",
        updated_at: "also-invalid",
        html_url: "https://github.com/test/repo/issues/456",
      };

      const timestamps = taskSource.extractTimestamps(invalidIssue);

      expect(timestamps.createdAt).toBeNull();
      expect(timestamps.updatedAt).toBeNull();
    });

    it("should return null timestamps for completely invalid data", () => {
      const invalidData = { not: "github data" };

      const timestamps = taskSource.extractTimestamps(invalidData);

      expect(timestamps.createdAt).toBeNull();
      expect(timestamps.updatedAt).toBeNull();
    });
  });

  describe("validateRawData", () => {
    it("should validate correct GitHub issue data", () => {
      const validIssue = {
        id: 123,
        number: 456,
        title: "Test Issue",
        body: "Test description",
        state: "open",
        assignee: null,
        labels: [],
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T15:30:00Z",
        html_url: "https://github.com/test/repo/issues/456",
      };

      expect(() => {
        taskSource.validateRawData(validIssue);
      }).not.toThrow();
    });

    it("should throw ExternalTaskValidationError for invalid data", () => {
      const invalidData = {
        id: "not-a-number",
        title: 123, // Should be string
      };

      expect(() => {
        taskSource.validateRawData(invalidData);
      }).toThrow(ExternalTaskValidationError);
    });
  });

  describe("priority extraction", () => {
    it("should extract priority from GitHub labels", () => {
      const issueWithPriority = {
        id: 123,
        number: 456,
        title: "Test Issue",
        body: "Test description",
        state: "open",
        assignee: null,
        labels: [{ name: "priority:high" }, { name: "bug" }],
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T15:30:00Z",
        html_url: "https://github.com/test/repo/issues/456",
      };

      const result = taskSource.transformToExternalTaskData(issueWithPriority);

      expect(result.priority).toBe("High");
    });

    it("should handle no priority labels", () => {
      const issueWithoutPriority = {
        id: 123,
        number: 456,
        title: "Test Issue",
        body: "Test description",
        state: "open",
        assignee: null,
        labels: [{ name: "bug" }],
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T15:30:00Z",
        html_url: "https://github.com/test/repo/issues/456",
      };

      const result = taskSource.transformToExternalTaskData(issueWithoutPriority);

      expect(result.priority).toBeUndefined();
    });
  });
});
