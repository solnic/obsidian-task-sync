/**
 * E2E tests for GitHub Organization/Repository Mapping
 * Tests the automatic assignment of areas and projects based on GitHub org/repo mappings
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
  selectFromDropdown,
} from "../../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";
import { configureGitHubOrgRepoMappings } from "../../helpers/github";
import {
  createArea,
  createProject,
  getTaskByTitle,
} from "../../helpers/entity-helpers";

test.describe("GitHub Organization/Repository Mapping", () => {
  test.beforeEach(async ({ page }) => {
    await enableIntegration(page, "github");
  });

  test("should apply repository-specific mapping over organization mapping", async ({
    page,
  }) => {
    // Create areas and projects that will be used in mappings
    await createArea(page, {
      name: "ACME Projects",
      description: "General ACME organization projects",
    });

    await createArea(page, {
      name: "Alpha Development",
      description: "Project Alpha specific development area",
    });

    await createProject(page, {
      name: "Project Alpha",
      description: "ACME Project Alpha development",
    });

    await createProject(page, {
      name: "ACME General",
      description: "General ACME work",
    });

    // Open Tasks view and enable GitHub integration
    await openView(page, "task-sync-main");

    // Configure GitHub organization/repository mappings programmatically
    await configureGitHubOrgRepoMappings(page, [
      {
        organization: "acme-corp",
        targetArea: "ACME Projects",
        targetProject: "ACME General",
        priority: 1,
      },
      {
        repository: "acme-corp/project-alpha",
        targetArea: "Alpha Development",
        targetProject: "Project Alpha",
        priority: 2,
      },
    ]);

    // Stub GitHub API responses
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "acme-alpha-issue",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "acme-corp");
    await selectFromDropdown(page, "repository-filter", "project-alpha");

    // Import an issue from project-alpha repository
    await clickIssueImportButton(page, 123);
    await waitForIssueImportComplete(page, 123);

    // Verify the task was created with repository-specific mapping (not organization mapping)
    await switchToTaskService(page, "local");

    // Verify the task was imported successfully
    const taskItem = page.locator(
      "[data-testid=\"service-content-local\"]:not(.tab-hidden) .task-sync-item-title:has-text('Alpha Issue')"
    );
    await expect(taskItem).toBeVisible();

    // Test that the mapping functionality works correctly
    const mappingResult = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const githubExtension = plugin.host.getExtensionById("github");

      // Test the mapping directly using the GitHub operations
      const testIssue = {
        id: 123456,
        number: 123,
        title: "Alpha Issue",
        body: "Test issue",
        labels: [],
        assignee: null,
        assignees: [],
        state: "open",
        html_url: "https://github.com/acme-corp/project-alpha/issues/123",
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

      // Transform the issue to task with repository info
      const taskData =
        githubExtension.githubOperations.tasks.transformIssueToTask(
          testIssue,
          "acme-corp/project-alpha"
        );

      return taskData;
    });

    // The task should be in Alpha Development area and Project Alpha project
    // (repository mapping takes precedence over organization mapping)
    expect(mappingResult.areas).toContain("Alpha Development");
    expect(mappingResult.project).toBe("Project Alpha");
  });

  test("should apply organization mapping when no repository mapping exists", async ({
    page,
  }) => {
    // Create areas and projects
    await createArea(page, {
      name: "Microsoft Projects",
      description: "General Microsoft organization projects",
    });

    await createProject(page, {
      name: "Microsoft",
      description: "General Microsoft work",
    });

    // Configure only organization mapping (no repository-specific mapping)
    await configureGitHubOrgRepoMappings(page, [
      {
        organization: "microsoft",
        targetArea: "Microsoft Projects",
        targetProject: "Microsoft",
        priority: 1,
      },
    ]);

    // Open Tasks view and enable GitHub integration
    await openView(page, "task-sync-main");

    // Stub GitHub API responses
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "microsoft-issue",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "microsoft");
    await selectFromDropdown(page, "repository-filter", "vscode");

    // Import an issue from vscode repository (should use organization mapping)
    await clickIssueImportButton(page, 789);
    await waitForIssueImportComplete(page, 789);

    // Verify the task was created with organization mapping
    await switchToTaskService(page, "local");

    const taskItem = page.locator(
      "[data-testid=\"service-content-local\"]:not(.tab-hidden) .task-sync-item-title:has-text('Microsoft Issue')"
    );
    await expect(taskItem).toBeVisible();

    // Check the actual task data to see if mappings were applied
    const task = await getTaskByTitle(page, "Microsoft Issue");

    // The task should be in Microsoft Projects area and Microsoft project
    expect(task.areas).toContain("Microsoft Projects");
    expect(task.project).toBe("Microsoft");
  });

  test("should not apply any mapping for unknown repositories", async ({
    page,
  }) => {
    // Configure mappings for known organizations only
    await configureGitHubOrgRepoMappings(page, [
      {
        organization: "microsoft",
        targetArea: "Microsoft Projects",
        targetProject: "Microsoft",
        priority: 1,
      },
    ]);

    // Open Tasks view and enable GitHub integration
    await openView(page, "task-sync-main");

    // Stub GitHub API responses with unknown repository
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "unknown-issue",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "unknown");
    await selectFromDropdown(page, "repository-filter", "repo");

    // Import an issue from unknown repository
    await clickIssueImportButton(page, 999);
    await waitForIssueImportComplete(page, 999);

    // Verify the task was created without any area/project mapping
    await switchToTaskService(page, "local");

    const taskItem = page.locator(
      "[data-testid=\"service-content-local\"]:not(.tab-hidden) .task-sync-item-title:has-text('Unknown Issue')"
    );
    await expect(taskItem).toBeVisible();

    // The task should not have any specific area or project assigned
    const taskContent = await taskItem.locator("..").textContent();
    expect(taskContent).not.toContain("Microsoft Projects");
    expect(taskContent).not.toContain("Microsoft");
  });
});
