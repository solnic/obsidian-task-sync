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
} from "../../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";

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
    // Check that the active file is the imported task note
    const activeFile = await page.evaluate(() => {
      const app = (window as any).app;
      return app.workspace.getActiveFile()?.path;
    });

    expect(activeFile).toBe("Tasks/First test issue.md");

    // Verify the note content is visible by checking the file exists
    const fileExists = await page.evaluate(() => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("Tasks/First test issue.md");
      return file !== null;
    });

    expect(fileExists).toBe(true);
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

    // Wait a moment for the state to propagate
    await page.waitForTimeout(1000);

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
});
