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

    // Wait for refresh to complete and data to reload
    await page.waitForTimeout(2000);

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

    // Wait for all async operations to complete (file creation, store updates, etc.)
    await page.waitForTimeout(1000);

    // Verify the task has source.extension set to 'github'
    const taskSource = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const task = plugin.query.findTaskByTitle("First test issue");
      return task?.source;
    });

    expect(taskSource).toBeDefined();
    expect(taskSource.extension).toBe("github");
    expect(taskSource.url).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(taskSource.filePath).toBe("Tasks/First test issue.md");

    // Modify the task file to trigger an update
    await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("Tasks/First test issue.md");
      if (file) {
        await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
          frontmatter.Status = "In Progress";
        });
      }
    });

    // Wait for the file modification to propagate
    await page.waitForTimeout(1000);

    // Verify source.extension is STILL 'github' after file modification
    const taskSourceAfterUpdate = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const task = plugin.query.findTaskByTitle("First test issue");
      return task?.source;
    });

    expect(taskSourceAfterUpdate).toBeDefined();
    expect(taskSourceAfterUpdate.extension).toBe("github");
    expect(taskSourceAfterUpdate.url).toBe(
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

    // Wait for all operations to complete
    await page.waitForTimeout(1000);

    // Verify source.extension is 'github' before reload
    const taskSourceBeforeReload = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const task = plugin.query.findTaskByTitle("First test issue");
      return task?.source;
    });

    expect(taskSourceBeforeReload).toBeDefined();
    expect(taskSourceBeforeReload.extension).toBe("github");

    // Check what's in the persisted data before reload
    const persistedData = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const data = await plugin.loadData();
      const githubTask = data?.entities?.tasks?.find(
        (t: any) => t.title === "First test issue"
      );
      return githubTask;
    });

    expect(persistedData).toBeDefined();
    expect(persistedData.source.extension).toBe("github");

    // Also check what's in the store before reload
    const storeTaskBeforeReload = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const task = plugin.query.findTaskByTitle("First test issue");
      return task;
    });

    // Reload the plugin to simulate app restart
    await page.evaluate(async () => {
      const app = (window as any).app;
      await app.plugins.disablePlugin("obsidian-task-sync");
      await app.plugins.enablePlugin("obsidian-task-sync");
    });

    // Wait for plugin to reload and vault to be scanned
    await page.waitForTimeout(2000);

    // Verify source.extension is STILL 'github' after reload
    const taskSourceAfterReload = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const task = plugin.query.findTaskByTitle("First test issue");
      return task?.source;
    });

    expect(taskSourceAfterReload).toBeDefined();
    expect(taskSourceAfterReload.extension).toBe("github");
    expect(taskSourceAfterReload.url).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
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

    // Get the first issue data from the fixture
    const issueData = await page.evaluate(() => {
      return {
        id: 111222,
        number: 111,
        title: "First test issue",
        html_url: "https://github.com/solnic/obsidian-task-sync/issues/111",
      };
    });

    // Create a task with proper source property matching the GitHub issue
    await page.evaluate(
      async ({ issueData }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        const taskData = {
          title: issueData.title,
          description: "This is the first test issue for multiple imports.",
          category: "Bug",
          status: "Backlog",
          priority: "Medium",
          project: "",
          doDate: undefined,
          source: {
            extension: "github",
            url: issueData.html_url,
            filePath: `Tasks/${issueData.title}.md`,
            data: {
              id: issueData.id,
              number: issueData.number,
              title: issueData.title,
              html_url: issueData.html_url,
            },
          },
        };

        const task = await plugin.operations.taskOperations.create(taskData);
        return task;
      },
      { issueData }
    );

    // Wait for the task file to be created
    await fileExists(page, `Tasks/${issueData.title}.md`);

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

    // Wait for the issue to show as imported in the GitHub view
    // The reactivity should update the view automatically
    await page.waitForTimeout(2000);

    // Verify the issue is now marked as imported in the GitHub view
    const issueLocator = page
      .locator('[data-testid="github-issue-item"]')
      .filter({
        hasText: `#${issueData.number}`,
      });

    await expect(issueLocator).toHaveAttribute("data-imported", "true");

    // Now update the task note with new properties using processFrontMatter
    await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("Tasks/First test issue.md");
      if (file) {
        await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
          frontmatter.Category = "Feature";
          frontmatter.Status = "In Progress";
          frontmatter.Project = "obsidian-task-sync";
          frontmatter["Do Date"] = "2024-02-15";
        });
      }
    });

    // Wait for the file to be updated and changes to propagate
    await page.waitForTimeout(1000);

    // Verify the changes are reflected in the task store
    const updatedTask = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const task = plugin.query.findTaskByTitle("First test issue");
      return task;
    });

    expect(updatedTask.category).toBe("Feature");
    expect(updatedTask.status).toBe("In Progress");
    expect(updatedTask.project).toBe("obsidian-task-sync");
    expect(updatedTask.doDate).toBeDefined();

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
});
