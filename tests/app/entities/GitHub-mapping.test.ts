/**
 * Tests for GitHub Task Operations with Organization/Repository Mapping
 * Verifies that GitHub issues and PRs are correctly mapped to areas and projects
 */

import { GitHub } from "../../../src/app/entities/GitHub";
import type { GitHubIssue, GitHubPullRequest } from "../../../src/app/cache/schemas/github";
import type { TaskSyncSettings, GitHubOrgRepoMapping } from "../../../src/app/types/settings";
import { DEFAULT_SETTINGS } from "../../../src/app/types/settings";

describe("GitHub Task Operations with Mapping", () => {
  let githubOperations: GitHub.TaskOperations;
  let settings: TaskSyncSettings;

  beforeEach(() => {
    // Create settings with GitHub organization/repository mappings
    settings = {
      ...DEFAULT_SETTINGS,
      integrations: {
        ...DEFAULT_SETTINGS.integrations,
        github: {
          ...DEFAULT_SETTINGS.integrations.github,
          orgRepoMappings: [
            {
              organization: "microsoft",
              targetArea: "Microsoft Projects",
              targetProject: "Microsoft",
              priority: 1,
            },
            {
              repository: "microsoft/vscode",
              targetArea: "VSCode Development",
              targetProject: "VSCode Core",
              priority: 2, // Higher priority than organization mapping
            },
            {
              organization: "google",
              targetArea: "Google Projects",
              priority: 1,
            },
          ],
        },
      },
    };

    githubOperations = new GitHub.TaskOperations(settings);
  });

  describe("transformIssueToTask with mapping", () => {
    test("should apply repository-specific mapping for microsoft/vscode", () => {
      const issue: GitHubIssue = {
        id: 123456,
        number: 456,
        title: "VSCode Issue",
        body: "Test issue for VSCode",
        labels: [],
        assignee: null,
        assignees: [],
        state: "open",
        html_url: "https://github.com/microsoft/vscode/issues/456",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        closed_at: null,
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
      };

      const taskData = githubOperations.transformIssueToTask(issue, "microsoft/vscode");

      // Should use repository-specific mapping (higher priority)
      expect(taskData.project).toBe("VSCode Core");
      expect(taskData.areas).toEqual(["VSCode Development"]);
      expect(taskData.title).toBe("VSCode Issue");
      expect(taskData.description).toBe("Test issue for VSCode");
      expect(taskData.done).toBe(false);
      expect(taskData.source?.extension).toBe("github");
      expect(taskData.source?.url).toBe("https://github.com/microsoft/vscode/issues/456");
    });

    test("should apply organization mapping for microsoft/other-repo", () => {
      const issue: GitHubIssue = {
        id: 789012,
        number: 789,
        title: "Microsoft Issue",
        body: "Test issue for Microsoft organization",
        labels: [],
        assignee: null,
        assignees: [],
        state: "open",
        html_url: "https://github.com/microsoft/other-repo/issues/789",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        closed_at: null,
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
      };

      const taskData = githubOperations.transformIssueToTask(issue, "microsoft/other-repo");

      // Should use organization mapping (no repository-specific mapping exists)
      expect(taskData.project).toBe("Microsoft");
      expect(taskData.areas).toEqual(["Microsoft Projects"]);
      expect(taskData.title).toBe("Microsoft Issue");
      expect(taskData.description).toBe("Test issue for Microsoft organization");
    });

    test("should apply partial mapping (area only) for google repos", () => {
      const issue: GitHubIssue = {
        id: 345678,
        number: 345,
        title: "Google Issue",
        body: "Test issue for Google organization",
        labels: [],
        assignee: null,
        assignees: [],
        state: "closed",
        html_url: "https://github.com/google/some-repo/issues/345",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        closed_at: "2024-01-02T00:00:00Z",
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
      };

      const taskData = githubOperations.transformIssueToTask(issue, "google/some-repo");

      // Should use organization mapping (area only, no project specified)
      expect(taskData.project).toBe("google/some-repo"); // Falls back to repository name
      expect(taskData.areas).toEqual(["Google Projects"]);
      expect(taskData.done).toBe(true); // Issue is closed
    });

    test("should not apply mapping when no repository provided", () => {
      const issue: GitHubIssue = {
        id: 111222,
        number: 111,
        title: "No Repo Issue",
        body: "Test issue without repository context",
        labels: [],
        assignee: null,
        assignees: [],
        state: "open",
        html_url: "https://github.com/microsoft/vscode/issues/111",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        closed_at: null,
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
      };

      const taskData = githubOperations.transformIssueToTask(issue);

      // Should not apply any mapping
      expect(taskData.project).toBe("");
      expect(taskData.areas).toEqual([]);
    });

    test("should not apply mapping for unknown repository", () => {
      const issue: GitHubIssue = {
        id: 333444,
        number: 333,
        title: "Unknown Repo Issue",
        body: "Test issue for unknown repository",
        labels: [],
        assignee: null,
        assignees: [],
        state: "open",
        html_url: "https://github.com/unknown/repo/issues/333",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        closed_at: null,
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
      };

      const taskData = githubOperations.transformIssueToTask(issue, "unknown/repo");

      // Should not apply any mapping
      expect(taskData.project).toBe("unknown/repo"); // Falls back to repository name
      expect(taskData.areas).toEqual([]);
    });
  });

  describe("transformPullRequestToTask with mapping", () => {
    test("should apply repository-specific mapping for microsoft/vscode PR", () => {
      const pullRequest: GitHubPullRequest = {
        id: 555666,
        number: 555,
        title: "VSCode PR",
        body: "Test pull request for VSCode",
        labels: [],
        assignee: null,
        assignees: [],
        state: "open",
        html_url: "https://github.com/microsoft/vscode/pull/555",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        closed_at: null,
        merged_at: null,
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
        head: {
          ref: "feature-branch",
          sha: "abc123",
        },
        base: {
          ref: "main",
          sha: "def456",
        },
      };

      const taskData = githubOperations.transformPullRequestToTask(pullRequest, "microsoft/vscode");

      // Should use repository-specific mapping
      expect(taskData.project).toBe("VSCode Core");
      expect(taskData.areas).toEqual(["VSCode Development"]);
      expect(taskData.title).toBe("VSCode PR");
      expect(taskData.description).toBe("Test pull request for VSCode");
      expect(taskData.done).toBe(false); // PR is open and not merged
      expect(taskData.source?.extension).toBe("github");
      expect(taskData.source?.url).toBe("https://github.com/microsoft/vscode/pull/555");
    });

    test("should mark merged PR as done", () => {
      const pullRequest: GitHubPullRequest = {
        id: 777888,
        number: 777,
        title: "Merged PR",
        body: "Test merged pull request",
        labels: [],
        assignee: null,
        assignees: [],
        state: "closed",
        html_url: "https://github.com/microsoft/vscode/pull/777",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        closed_at: "2024-01-02T00:00:00Z",
        merged_at: "2024-01-02T00:00:00Z", // PR was merged
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
        head: {
          ref: "feature-branch",
          sha: "abc123",
        },
        base: {
          ref: "main",
          sha: "def456",
        },
      };

      const taskData = githubOperations.transformPullRequestToTask(pullRequest, "microsoft/vscode");

      expect(taskData.done).toBe(true); // PR was merged
      expect(taskData.project).toBe("VSCode Core");
      expect(taskData.areas).toEqual(["VSCode Development"]);
    });
  });

  describe("updateOrgRepoMappings", () => {
    test("should update mappings and apply new configuration", () => {
      const newMappings: GitHubOrgRepoMapping[] = [
        {
          organization: "facebook",
          targetArea: "Facebook Projects",
          targetProject: "Facebook",
          priority: 1,
        },
      ];

      githubOperations.updateOrgRepoMappings(newMappings);

      const issue: GitHubIssue = {
        id: 999000,
        number: 999,
        title: "Facebook Issue",
        body: "Test issue for Facebook",
        labels: [],
        assignee: null,
        assignees: [],
        state: "open",
        html_url: "https://github.com/facebook/react/issues/999",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        closed_at: null,
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
      };

      const taskData = githubOperations.transformIssueToTask(issue, "facebook/react");

      // Should use new mapping
      expect(taskData.project).toBe("Facebook");
      expect(taskData.areas).toEqual(["Facebook Projects"]);

      // Old mappings should no longer work
      const microsoftIssue: GitHubIssue = {
        id: 888000,
        number: 888,
        title: "Microsoft Issue",
        body: "Test issue for Microsoft",
        labels: [],
        assignee: null,
        assignees: [],
        state: "open",
        html_url: "https://github.com/microsoft/vscode/issues/888",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        closed_at: null,
        user: {
          login: "testuser",
          id: 5678,
          avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
          html_url: "https://github.com/testuser",
        },
      };

      const microsoftTaskData = githubOperations.transformIssueToTask(microsoftIssue, "microsoft/vscode");

      // Should not apply old mapping
      expect(microsoftTaskData.project).toBe("microsoft/vscode");
      expect(microsoftTaskData.areas).toEqual([]);
    });
  });
});
