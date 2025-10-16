/**
 * Test for GitHub import tags bug
 *
 * BUG: Importing from GitHub was setting tags from GitHub labels.
 * This test verifies that GitHub imports do NOT set tags from labels.
 */

import { describe, test, expect } from "vitest";
import { GitHub } from "../../../src/app/extensions/github/entities/GitHub";
import type { TaskSyncSettings } from "../../../src/app/core/settings";

describe("GitHub Import Tags Bug", () => {
  let githubOperations: GitHub.TaskOperations;

  beforeEach(() => {
    // Create a minimal settings object for testing
    const settings: TaskSyncSettings = {
      integrations: {
        github: {
          orgRepoMappings: [],
        },
      },
    } as any;

    githubOperations = new GitHub.TaskOperations(settings);
  });

  test("should NOT set tags when transforming GitHub issue", () => {
    const issue = {
      id: 123,
      number: 123,
      title: "Test Issue",
      body: "Test body",
      state: "open",
      labels: [
        { name: "bug", color: "d73a4a" },
        { name: "enhancement", color: "a2eeef" },
      ],
      assignee: null,
      assignees: [],
      html_url: "https://github.com/test/repo/issues/123",
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

    const taskData = githubOperations.transformIssueToTask(issue, "test/repo");

    // Tags should be empty, not populated from labels
    expect(taskData.tags).toEqual([]);
  });

  test("should NOT set tags when transforming GitHub PR", () => {
    const pr = {
      id: 456,
      number: 456,
      title: "Test PR",
      body: "Test PR body",
      state: "open",
      merged_at: null,
      labels: [
        { name: "documentation", color: "0075ca" },
        { name: "good first issue", color: "7057ff" },
      ],
      assignee: null,
      assignees: [],
      html_url: "https://github.com/test/repo/pull/456",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      closed_at: null,
      user: {
        login: "testuser",
        id: 5678,
        avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
        html_url: "https://github.com/testuser",
      },
      head: { ref: "feature-branch" },
      base: { ref: "main" },
    };

    const taskData = githubOperations.transformPullRequestToTask(
      pr,
      "test/repo"
    );

    // Tags should be empty, not populated from labels
    expect(taskData.tags).toEqual([]);
  });
});
