/**
 * End-to-End Tests for GitHub Mapping Precedence
 * Tests that GitHub org/repo mappings take precedence over current context when importing tasks
 */

import { test, expect, describe, beforeEach } from "vitest";
import {
  verifyTaskProperties,
  openFile,
  enableIntegration,
  openView,
  switchToTaskService,
  toggleSidebar,
} from "../../helpers/global";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import { createProject } from "../../helpers/entity-helpers";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";
import { restoreGitHubAPIs } from "../../helpers/api-stubbing";

describe("GitHub Mapping Precedence", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
    // Reset GitHub API stubs to ensure clean state between tests
    await restoreGitHubAPIs(context.page);
  });

  test("should apply GitHub org mapping over current context", async () => {
    const currentProject = await createProject(context.page, {
      name: "Current Project",
      description: "This is the current project context.",
    });

    // Open the project file to set context
    await openFile(context.page, currentProject.filePath);

    // Configure GitHub integration with organization mapping
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "microsoft/vscode",
      orgRepoMappings: [
        {
          organization: "microsoft",
          repository: "",
          targetArea: "Microsoft Projects",
          targetProject: "",
          priority: 1,
        },
      ],
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "microsoft-issue",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    await clickIssueImportButton(context.page, 123);
    await waitForIssueImportComplete(context.page, 123);

    // Verify that the GitHub mapping was applied (should override current context)
    await verifyTaskProperties(context.page, "Tasks/Microsoft Issue.md", {
      Title: "Microsoft Issue",
      Type: "Task",
      Areas: ["[[Microsoft Projects]]"], // Should come from GitHub mapping, not current context
    });
  });

  test("should apply repository-specific mapping over organization mapping", async () => {
    // Create a project to set current context
    const currentProject = await createProject(context.page, {
      name: "VSCode Test Project",
      description: "This is the current project context for VSCode test.",
    });

    // Open the project file to set context
    await openFile(context.page, currentProject.filePath);

    // Configure GitHub integration with both org and repo mappings
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "microsoft/vscode",
      orgRepoMappings: [
        {
          organization: "microsoft",
          repository: "",
          targetArea: "Microsoft Projects",
          targetProject: "",
          priority: 1,
        },
        {
          organization: "microsoft",
          repository: "microsoft/vscode", // Full repository format
          targetArea: "VSCode Development",
          targetProject: "VSCode Core",
          priority: 2, // Higher priority
        },
      ],
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "vscode-issue",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    // Click refresh to force GitHub service to reload with new fixture data
    await context.page.click('[data-testid="search-input-refresh"]');

    await clickIssueImportButton(context.page, 456);
    await waitForIssueImportComplete(context.page, 456);

    // Verify that the repository-specific mapping was applied (higher priority)
    await verifyTaskProperties(context.page, "Tasks/VSCode Issue.md", {
      Title: "VSCode Issue",
      Type: "Task",
      Areas: ["[[VSCode Development]]"], // Should come from repo-specific mapping
      Project: "[[VSCode Core]]", // Should come from repo-specific mapping
    });
  });

  test("should use current context when no GitHub mapping exists", async () => {
    // Create a project to set current context
    const currentProject = await createProject(context.page, {
      name: "Generic Test Project",
      description: "This is the current project context for generic test.",
    });

    // Open the project file to set context
    await openFile(context.page, currentProject.filePath);

    // Configure GitHub integration without any mappings
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "someorg/somerepo",
      orgRepoMappings: [], // No mappings configured
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "generic-issue",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    // Click refresh to force GitHub service to reload with new fixture data
    await context.page.click('[data-testid="search-input-refresh"]');

    await clickIssueImportButton(context.page, 789);
    await waitForIssueImportComplete(context.page, 789);

    // Verify that current context was used (no GitHub mapping)
    await verifyTaskProperties(context.page, "Tasks/Generic Issue.md", {
      Title: "Generic Issue",
      Type: "Task",
      Project: "[[Generic Test Project]]", // Should come from current context
    });
  });

  test("should apply GitHub mapping even when config already has values", async () => {
    // Create a project to set current context
    const currentProject = await createProject(context.page, {
      name: "GitHub Test Project",
      description: "This is the current project context for GitHub test.",
    });

    // Open the project file to set context
    await openFile(context.page, currentProject.filePath);

    // Configure GitHub integration with organization mapping
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "github/github",
      orgRepoMappings: [
        {
          organization: "github",
          repository: "",
          targetArea: "GitHub Projects",
          targetProject: "GitHub Core",
          priority: 1,
        },
      ],
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "github-issue",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    // Click refresh to force GitHub service to reload with new fixture data
    await context.page.click('[data-testid="search-input-refresh"]');

    await clickIssueImportButton(context.page, 999);
    await waitForIssueImportComplete(context.page, 999);

    // Verify that GitHub mapping overrode current context
    await verifyTaskProperties(context.page, "Tasks/GitHub Issue.md", {
      Title: "GitHub Issue",
      Type: "Task",
      Areas: ["[[GitHub Projects]]"], // Should come from GitHub mapping
      Project: "[[GitHub Core]]", // Should come from GitHub mapping
    });
  });
});
