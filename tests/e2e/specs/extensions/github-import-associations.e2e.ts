/**
 * E2E tests for GitHub Import Association Handling
 * Tests that project and area associations are properly handled when importing GitHub issues
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
  selectFromDropdown,
  getFrontMatter,
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

test.describe("GitHub Import Association Handling", { tag: '@github' }, () => {
  test.beforeEach(async ({ page }) => {
    await enableIntegration(page, "github");
  });

  test("should convert project association to wiki link when project entity exists", async ({
    page,
  }) => {
    // Create the project and area entities FIRST
    await createProject(page, {
      name: "Test Project",
      description: "Project for testing associations",
    });

    await createArea(page, {
      name: "Test Area",
      description: "Area for testing associations",
    });

    // Configure mapping to use the created entities
    await configureGitHubOrgRepoMappings(page, [
      {
        repository: "test-org/test-repo",
        targetArea: "Test Area",
        targetProject: "Test Project",
        priority: 1,
      },
    ]);

    // Open Tasks view
    await openView(page, "task-sync-main");

    // Stub GitHub API with a test issue
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "test-repo-issue",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service to be ready
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    // Switch to GitHub and select repository
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "test-org");
    await selectFromDropdown(page, "repository-filter", "test-repo");

    // Import the test issue
    await clickIssueImportButton(page, 1);
    await waitForIssueImportComplete(page, 1);

    // Switch back to local to see the imported task
    await switchToTaskService(page, "local");

    // Verify the task was imported
    const task = await getTaskByTitle(page, "Test Repo Issue");
    expect(task).toBeDefined();
    expect(task.project).toBe("Test Project");
    expect(task.areas).toContain("Test Area");

    // NOW CHECK THE FRONTMATTER - This is the critical test
    // The project should be converted to wiki link format because the entity exists
    const taskFilePath = task.source.keys.obsidian;
    const frontMatter = await getFrontMatter(page, taskFilePath);

    // This assertion should pass after the fix
    expect(frontMatter.Project).toMatch(
      /^\[\[Projects\/Test Project\.md\|Test Project\]\]$/
    );

    // Areas should remain as plain names (for Bases filtering compatibility)
    expect(frontMatter.Areas).toEqual(expect.arrayContaining(["Test Area"]));
  });

  test("should save raw project string when project entity does not exist", async ({
    page,
  }) => {
    // DO NOT create the project entity - this tests the fallback behavior

    // Configure mapping to use a non-existent project
    await configureGitHubOrgRepoMappings(page, [
      {
        repository: "test-org/another-repo",
        targetArea: "Nonexistent Area",
        targetProject: "Nonexistent Project",
        priority: 1,
      },
    ]);

    // Open Tasks view
    await openView(page, "task-sync-main");

    // Stub GitHub API
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "another-repo-issue",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "test-org");
    await selectFromDropdown(page, "repository-filter", "another-repo");

    await clickIssueImportButton(page, 2);
    await waitForIssueImportComplete(page, 2);

    await switchToTaskService(page, "local");

    const task = await getTaskByTitle(page, "Another Repo Issue");
    expect(task).toBeDefined();
    expect(task.project).toBe("Nonexistent Project");

    // Check frontmatter - should be raw string when entity doesn't exist
    const taskFilePath = task.source.keys.obsidian;
    const frontMatter = await getFrontMatter(page, taskFilePath);

    // When the project entity doesn't exist, it should be saved as a plain string
    expect(frontMatter.Project).toBe("Nonexistent Project");
    expect(frontMatter.Areas).toEqual(
      expect.arrayContaining(["Nonexistent Area"])
    );
  });
});
