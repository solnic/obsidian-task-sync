/**
 * E2E tests for sync property filtering
 * Tests that extensions can define which properties should be synced
 * and that other properties are not overridden during sync
 */

import { test, expect } from "../../helpers/setup";
import { getTaskByTitle } from "../../helpers/entity-helpers";
import {
  fileExists,
  readVaultFile,
  enableIntegration,
  openView,
  switchToTaskService,
  selectFromDropdown,
  updateFileFrontmatter,
  waitForFileUpdate,
} from "../../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";

test.describe("Sync Property Filtering", () => {
  test("should only sync GitHub-defined properties and preserve Obsidian-specific properties", async ({
    page,
  }) => {
    // Step 1: Enable GitHub integration and set up fixtures
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    // Set up initial GitHub fixture with issue #456
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-test-repo",
      issues: "issue-updated-456",
      currentUser: "current-user-basic",
    });

    // Wait for GitHub to be ready
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      { state: "visible", timeout: 2500 }
    );

    // Step 2: Import the GitHub issue through UI
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "test-owner");
    await selectFromDropdown(page, "repository-filter", "test-repo");

    // Import issue #456
    await clickIssueImportButton(page, 456);
    await waitForIssueImportComplete(page, 456);

    // Verify the task was imported
    const taskExists = await fileExists(
      page,
      "Tasks/Updated Title from GitHub.md"
    );
    expect(taskExists).toBe(true);

    // Step 3: Add Obsidian-specific properties to the imported task
    await updateFileFrontmatter(page, "Tasks/Updated Title from GitHub.md", {
      Priority: "High",
      Areas: ["Development", "Testing"],
      Project: "My Project",
    });

    // Wait for file changes to be processed
    await waitForFileUpdate(
      page,
      "Tasks/Updated Title from GitHub.md",
      "Priority: High"
    );

    // Verify task now has Obsidian properties
    const taskWithObsidianProps = await getTaskByTitle(
      page,
      "Updated Title from GitHub"
    );
    expect(taskWithObsidianProps.priority).toBe("High");
    expect(taskWithObsidianProps.areas).toEqual(["Development", "Testing"]);
    expect(taskWithObsidianProps.project).toBe("My Project");

    // Step 4: Update GitHub fixture to simulate a title change
    await page.evaluate(() => {
      const stubs = (window as any).__githubApiStubs;
      if (stubs && stubs.issues && stubs.issues.length > 0) {
        // Update the issue title to simulate a GitHub change
        stubs.issues[0].title = "GitHub Updated This Title";
        stubs.issues[0].updated_at = "2024-01-03T00:00:00Z";
      }
    });

    // Step 5: Trigger GitHub refresh to sync changes
    const refreshButton = page.locator(
      '[data-testid="task-sync-github-refresh-button"]'
    );
    await refreshButton.waitFor({ state: "visible", timeout: 2500 });
    await refreshButton.click();

    // Wait for refresh to complete
    await page.waitForFunction(
      () => {
        const refreshButton = document.querySelector(
          '[data-testid="task-sync-github-refresh-button"]'
        );
        return refreshButton && !refreshButton.hasAttribute("disabled");
      },
      undefined,
      { timeout: 2500 }
    );

    // Step 6: Verify that GitHub properties were updated but Obsidian properties preserved
    const syncedTask = await getTaskByTitle(page, "GitHub Updated This Title");
    expect(syncedTask).toBeDefined();

    // GitHub-defined properties SHOULD be synced from GitHub
    expect(syncedTask.title).toBe("GitHub Updated This Title");
    expect(syncedTask.description).toBe("Updated description from GitHub");

    // Obsidian-specific properties should NOT be overridden
    expect(syncedTask.priority).toBe("High");
    expect(syncedTask.areas).toEqual(["Development", "Testing"]);
    expect(syncedTask.project).toBe("My Project");

    // Verify the file content - file name doesn't automatically change with title
    // So we check the original file name
    const fileContent = await readVaultFile(
      page,
      "Tasks/Updated Title from GitHub.md"
    );
    expect(fileContent).toBeTruthy();
    expect(fileContent).toContain("Title: GitHub Updated This Title");
    expect(fileContent).toContain("Priority: High");
    expect(fileContent).toContain("Development");
    expect(fileContent).toContain("Testing");
    expect(fileContent).toContain("Project: My Project");
  });

  test("should allow Obsidian to update non-GitHub properties without conflict", async ({
    page,
  }) => {
    // Step 1: Enable GitHub integration and set up fixtures
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    // Set up GitHub fixtures with issue #789
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-test-repo",
      issues: "issue-789",
      currentUser: "current-user-basic",
    });

    // Wait for GitHub to be ready
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      { state: "visible", timeout: 2500 }
    );

    // Step 2: Import the GitHub issue through UI
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "test-owner");
    await selectFromDropdown(page, "repository-filter", "test-repo");

    // Import issue #789
    await clickIssueImportButton(page, 789);
    await waitForIssueImportComplete(page, 789);

    // Verify the task was imported
    const taskExists = await fileExists(page, "Tasks/GitHub Task.md");
    expect(taskExists).toBe(true);

    // Step 3: Update Obsidian-specific properties via the file
    await updateFileFrontmatter(page, "Tasks/GitHub Task.md", {
      Priority: "High",
      Areas: ["Important"],
    });

    // Wait for file changes to be processed
    await waitForFileUpdate(page, "Tasks/GitHub Task.md", "Priority: High");

    // Verify task has updated Obsidian properties
    const taskWithUpdates = await getTaskByTitle(page, "GitHub Task");
    expect(taskWithUpdates.priority).toBe("High");
    expect(taskWithUpdates.areas).toEqual(["Important"]);

    // Step 4: Trigger GitHub refresh to ensure Obsidian properties are preserved
    const refreshButton = page.locator(
      '[data-testid="task-sync-github-refresh-button"]'
    );
    await refreshButton.waitFor({ state: "visible", timeout: 2500 });
    await refreshButton.click();

    // Wait for refresh to complete
    await page.waitForFunction(
      () => {
        const refreshButton = document.querySelector(
          '[data-testid="task-sync-github-refresh-button"]'
        );
        return refreshButton && !refreshButton.hasAttribute("disabled");
      },
      undefined,
      { timeout: 2500 }
    );

    // Step 5: Verify Obsidian-specific properties were preserved after GitHub sync
    const taskAfterSync = await getTaskByTitle(page, "GitHub Task");
    expect(taskAfterSync).toBeDefined();

    // GitHub properties should still be from GitHub
    expect(taskAfterSync.title).toBe("GitHub Task");
    expect(taskAfterSync.description).toBe("Test description from GitHub");

    // Obsidian-specific properties should be preserved
    expect(taskAfterSync.priority).toBe("High");
    expect(taskAfterSync.areas).toEqual(["Important"]);

    // Verify file content
    const fileContent = await readVaultFile(page, "Tasks/GitHub Task.md");
    expect(fileContent).toBeTruthy();
    expect(fileContent).toContain("Priority: High");
    expect(fileContent).toContain("Important");
  });
});
