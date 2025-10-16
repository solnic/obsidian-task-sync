/**
 * E2E tests for GitHub Integration
 * Ported from vitest version to Playwright
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
  selectFromDropdown,
  fileExists,
  executeCommand,
  getActiveFilePath,
  reloadPlugin,
  updateFileFrontmatter,
} from "../../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";
import {
  getTaskByTitle,
  getPersistedTaskByTitle,
  createTaskWithSource,
  waitForTaskUpdated,
} from "../../helpers/entity-helpers";

test.describe("GitHub Integration", () => {
  test("should import GitHub issue as task", async ({ page }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Click import button for first issue (#111)
    await clickIssueImportButton(page, 111);
    await waitForIssueImportComplete(page, 111);

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/First test issue.md");
    expect(taskExists).toBe(true);

    // Verify task appears in Local Tasks view
    await switchToTaskService(page, "local");
    expect(
      await page
        .locator(".task-sync-item-title:has-text('First test issue')")
        .count()
    ).toBe(1);
  });

  test("should automatically open note when GitHub issue is imported", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Click import button for first issue (#111)
    await clickIssueImportButton(page, 111);
    await waitForIssueImportComplete(page, 111);

    // Wait for the note to be created and opened
    // The note should be automatically opened after import
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        return (
          app.workspace.getActiveFile()?.path === "Tasks/First test issue.md"
        );
      },
      { timeout: 10000 }
    );

    // Verify the note was automatically opened in Obsidian
    const activeFile = await getActiveFilePath(page);
    expect(activeFile).toBe("Tasks/First test issue.md");

    // Verify the note file exists
    const taskFileExists = await fileExists(page, "Tasks/First test issue.md");
    expect(taskFileExists).toBe(true);
  });

  test("should NOT display pull requests in the issues list", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    // Use fixture that contains both issues and pull requests (mixed response from GitHub API)
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-with-pull-requests", // This fixture contains 2 issues + 2 pull requests
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Should only show 2 issues, not 4 (2 issues + 2 pull requests)
    // BUG: Currently this will fail because pull requests are included
    const issueCount = await page.locator(".task-sync-item-title").count();
    expect(issueCount).toBe(2); // Should be 2 issues, not 4

    // Verify that only actual issues are displayed (not pull requests)
    expect(
      await page
        .locator(".task-sync-item-title:has-text('First test issue')")
        .count()
    ).toBe(1);

    expect(
      await page
        .locator(".task-sync-item-title:has-text('Second test issue')")
        .count()
    ).toBe(1);

    // Should NOT contain the 2 pull requests
    expect(
      await page
        .locator(".task-sync-item-title:has-text('Add new feature')")
        .count()
    ).toBe(0);

    expect(
      await page
        .locator(".task-sync-item-title:has-text('Fix critical bug')")
        .count()
    ).toBe(0);
  });

  test("should show 'Schedule for today' button when Daily Planning wizard is active", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for issues to load
    await expect(
      page.locator('[data-testid="github-issues-list"]')
    ).toBeVisible();

    // Find the first issue and hover to reveal import button
    const firstIssue = page
      .locator('[data-testid="github-issue-item"]')
      .first();
    await firstIssue.waitFor({ state: "visible" });
    await firstIssue.hover();

    // Initially, should show regular "Import" button
    await expect(
      page.locator('[data-testid="issue-import-button"]').first()
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="issue-import-button"]').first()
    ).toHaveText("Import");

    // Start Daily Planning wizard
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate to step 2 (Today's Agenda) where we can import tasks
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Switch back to GitHub service in the Tasks view
    // The Daily Planning wizard should still be active in the background
    await page.click('[data-testid="tasks-view-tab"]');
    await switchToTaskService(page, "github");

    // Hover over the first issue again to reveal the updated button
    await firstIssue.hover();

    // Now the import button should show "Schedule for today"
    await expect(
      page.locator('[data-testid="schedule-for-today-button"]').first()
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="schedule-for-today-button"]').first()
    ).toHaveText("Schedule for today");
  });

  test("should clear cache and reload data when refresh button is clicked", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for issues to load
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      state: "visible",
      timeout: 10000,
    });

    // Verify issues are displayed
    const initialIssueCount = await page
      .locator('[data-testid="github-issue-item"]')
      .count();
    expect(initialIssueCount).toBeGreaterThan(0);

    // Click refresh button and immediately check for loading state
    const refreshButton = page.locator(
      '[data-testid="task-sync-github-refresh-button"]'
    );

    // Start the refresh and immediately check for loading indicator
    const refreshPromise = refreshButton.click();

    // The loading indicator should appear immediately when refresh starts
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]');

    // Wait for either the loading indicator to appear OR for the refresh to complete
    // This tests that the UI immediately shows loading state
    await Promise.race([
      loadingIndicator.waitFor({ state: "visible", timeout: 1000 }),
      refreshPromise,
    ]);

    // At this point, either loading indicator appeared (good) or refresh completed very fast
    const hasLoadingIndicator = await loadingIndicator.isVisible();

    // If loading indicator didn't appear, check if tasks were at least cleared momentarily
    let tasksWereCleared = false;
    if (!hasLoadingIndicator) {
      // Check if tasks list is empty (they should be cleared immediately on refresh)
      const issueCount = await page
        .locator('[data-testid="github-issue-item"]')
        .count();
      tasksWereCleared = issueCount === 0;
    }

    // The refresh should either show loading indicator OR clear the tasks list immediately
    expect(hasLoadingIndicator || tasksWereCleared).toBe(true);

    // After refresh, issues should be loaded again
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      state: "visible",
      timeout: 10000,
    });

    const finalIssueCount = await page
      .locator('[data-testid="github-issue-item"]')
      .count();
    expect(finalIssueCount).toBeGreaterThan(0);
  });

  test("should set source.extension to 'github' when importing GitHub issue", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Click import button for first issue (#111)
    await clickIssueImportButton(page, 111);
    await waitForIssueImportComplete(page, 111);

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/First test issue.md");
    expect(taskExists).toBe(true);

    // Verify the task has source.extension set to 'github'
    const task = await getTaskByTitle(page, "First test issue");
    expect(task).toBeDefined();
    expect(task.source.extension).toBe("github");
    expect(task.source.url).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(task.source.filePath).toBe("Tasks/First test issue.md");

    // Modify the task file to trigger an update
    await updateFileFrontmatter(page, "Tasks/First test issue.md", {
      Status: "In Progress",
    });

    // Verify source.extension is STILL 'github' after file modification
    const taskAfterUpdate = await getTaskByTitle(page, "First test issue");
    expect(taskAfterUpdate).toBeDefined();
    expect(taskAfterUpdate.source.extension).toBe("github");
    expect(taskAfterUpdate.source.url).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
  });

  test("should preserve source.extension='github' after plugin reload", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Click import button for first issue (#111)
    await clickIssueImportButton(page, 111);
    await waitForIssueImportComplete(page, 111);

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/First test issue.md");
    expect(taskExists).toBe(true);

    // Verify source.extension is 'github' before reload
    const taskBeforeReload = await getTaskByTitle(page, "First test issue");
    expect(taskBeforeReload).toBeDefined();
    expect(taskBeforeReload.source.extension).toBe("github");
    expect(taskBeforeReload.source.url).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(taskBeforeReload.source.filePath).toBe("Tasks/First test issue.md");

    // Verify persisted data has correct source metadata
    const persistedTask = await getPersistedTaskByTitle(
      page,
      "First test issue"
    );
    expect(persistedTask).toBeDefined();
    expect(persistedTask.source.extension).toBe("github");
    expect(persistedTask.source.url).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(persistedTask.source.filePath).toBe("Tasks/First test issue.md");

    // Reload the plugin to simulate app restart
    await reloadPlugin(page);

    // Verify source.extension is STILL 'github' after reload
    const taskAfterReload = await getTaskByTitle(page, "First test issue");
    expect(taskAfterReload).toBeDefined();
    expect(taskAfterReload.source.extension).toBe("github");
    expect(taskAfterReload.source.url).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(taskAfterReload.source.filePath).toBe("Tasks/First test issue.md");
  });

  test("should reactively update imported issue when task note is modified", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for issues to load
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      state: "visible",
      timeout: 10000,
    });

    // Define the issue data from the fixture
    const issueData = {
      id: 111222,
      number: 111,
      title: "First test issue",
      html_url: "https://github.com/solnic/obsidian-task-sync/issues/111",
    };

    // Create a task with proper source property matching the GitHub issue
    await createTaskWithSource(page, {
      title: issueData.title,
      description: "This is the first test issue for multiple imports.",
      category: "Bug",
      status: "Backlog",
      priority: "Medium",
      source: {
        extension: "github",
        url: issueData.html_url,
        id: issueData.id.toString(),
      },
    });

    // Wait for the task file to be created
    const taskFileExists = await fileExists(
      page,
      `Tasks/${issueData.title}.md`
    );
    expect(taskFileExists).toBe(true);

    // Wait for the task to be added to the task store and verify it has the correct source
    await page.waitForFunction(
      ({ url }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const task = plugin.query.findTaskBySourceUrl(url);
        return task;
      },
      { url: issueData.html_url },
      { timeout: 5000 }
    );

    // Verify the issue is now marked as imported in the GitHub view
    const issueLocator = page
      .locator('[data-testid="github-issue-item"]')
      .filter({
        hasText: `#${issueData.number}`,
      });

    await expect(issueLocator).toHaveAttribute("data-imported", "true");

    const changes = {
      Category: "Feature",
      Status: "In Progress",
      Project: "obsidian-task-sync",
      "Do Date": "2024-02-15",
    };

    // Now update the task note with new properties
    await updateFileFrontmatter(page, "Tasks/First test issue.md", changes);

    const updatedTask = await waitForTaskUpdated(page, "First test issue", {
      category: "Feature",
      status: "In Progress",
      project: "obsidian-task-sync",
    });

    expect(updatedTask.doDate.getFullYear()).toBe(2024);
    expect(updatedTask.doDate.getMonth()).toBe(1); // February is 1
    expect(updatedTask.doDate.getDate()).toBe(15);

    // Verify the issue still shows as imported (reactivity maintained)
    await expect(issueLocator).toHaveAttribute("data-imported", "true");

    // Verify the updated doDate is visible in the UI as a scheduled badge
    // Reactivity should automatically update the UI when the task changes
    // The scheduled badge should appear within the issue item
    const scheduledBadge = issueLocator.locator(".scheduled-badge");
    await expect(scheduledBadge).toBeVisible({ timeout: 10000 });

    // Verify the badge shows the correct date
    await expect(scheduledBadge).toContainText("Scheduled for");
  });

  test("should sort GitHub issues by canonical updated_at timestamp descending", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for issues to load
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      state: "visible",
      timeout: 10000,
    });

    // Get all issue items
    const issueItems = page.locator('[data-testid="github-issue-item"]');
    const count = await issueItems.count();
    expect(count).toBe(3);

    // Verify issues are sorted by updated_at descending (newest first)
    // Fixture data:
    // - Issue #333: updated_at "2024-01-14T16:45:00Z" (newest)
    // - Issue #222: updated_at "2024-01-12T14:30:00Z" (middle)
    // - Issue #111: updated_at "2024-01-10T09:00:00Z" (oldest)

    // First issue should be #333 (newest)
    const firstIssue = issueItems.nth(0);
    await expect(firstIssue).toContainText("#333");
    await expect(firstIssue).toContainText("Third test issue");

    // Second issue should be #222 (middle)
    const secondIssue = issueItems.nth(1);
    await expect(secondIssue).toContainText("#222");
    await expect(secondIssue).toContainText("Second test issue");

    // Third issue should be #111 (oldest)
    const thirdIssue = issueItems.nth(2);
    await expect(thirdIssue).toContainText("#111");
    await expect(thirdIssue).toContainText("First test issue");
  });
});
