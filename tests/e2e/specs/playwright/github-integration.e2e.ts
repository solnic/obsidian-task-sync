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
  readVaultFile,
  waitForFileUpdate,
  getFileContent,
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

    // Go back to GitHub tab - this reproduces the bug where source.data was stripped
    // When the GitHub tab renders the imported task, it will crash if source.data is missing
    await switchToTaskService(page, "github");

    // Wait for GitHub issues to be visible - this is where the crash would occur
    // if source.data was missing, because GitHubIssueItem tries to access task.source.data.title
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      state: "visible",
      timeout: 5000,
    });

    // CRITICAL: Verify that the imported task still has source.data after filter changes
    // Without the fix, source.data would be undefined here, causing crash when rendering
    const taskAfterFilterChange = await getTaskByTitle(
      page,
      "First test issue"
    );
    expect(taskAfterFilterChange).toBeDefined();
    expect(taskAfterFilterChange.source.extension).toBe("github");
    expect(taskAfterFilterChange.source.data).toBeDefined();
    expect(taskAfterFilterChange.source.data.title).toBe("First test issue");

    // Verify the imported issue is still visible and renders without crashing
    const importedIssue = page
      .locator('[data-testid="github-issue-item"]')
      .filter({ hasText: "First test issue" })
      .first();
    await expect(importedIssue).toBeVisible();

    // Verify no error message is shown (would show if source.data was missing)
    const errorMessage = importedIssue.locator(".error-message");
    await expect(errorMessage).not.toBeVisible();
  });

  test("should preserve imported tasks when switching to different repository", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multi-repo",
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

    // Import issue from first repository
    await clickIssueImportButton(page, 111);
    await waitForIssueImportComplete(page, 111);

    // Verify task was imported
    const taskExists = await fileExists(page, "Tasks/First test issue.md");
    expect(taskExists).toBe(true);

    // Verify task appears in Local Tasks view
    await switchToTaskService(page, "local");
    const localTaskCount = await page
      .locator(".task-sync-item-title:has-text('First test issue')")
      .count();
    expect(localTaskCount).toBe(1);

    // Switch back to GitHub and select a different repository
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "acme-corp");
    await selectFromDropdown(page, "repository-filter", "project-alpha");

    // BUG: The imported task from obsidian-task-sync should still exist in the task store
    // but it gets removed when we switch repositories

    // Verify the imported task still exists in Local Tasks view
    await switchToTaskService(page, "local");

    // Wait for the task to appear
    await page.waitForSelector(
      ".task-sync-item-title:has-text('First test issue')",
      { timeout: 5000 }
    );

    const taskStillExists = await page
      .locator(".task-sync-item-title:has-text('First test issue')")
      .count();
    expect(taskStillExists).toBe(1);

    // Verify the task file still exists
    const fileStillExists = await fileExists(page, "Tasks/First test issue.md");
    expect(fileStillExists).toBe(true);

    // Switch back to GitHub view and original repository to verify task is still there
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // The imported task should still be visible in GitHub view
    const importedIssue = page
      .locator('[data-testid="github-issue-item"]')
      .filter({ hasText: "First test issue" });
    await expect(importedIssue).toBeVisible({ timeout: 5000 });

    // Verify it's marked as imported by checking the data-imported attribute
    // The issue item should have data-imported="true"
    await expect(importedIssue).toHaveAttribute("data-imported", "true");
  });

  test("should preserve GitHub issue content when task is updated", async ({
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

    // Read the initial file content to verify it contains GitHub issue content
    const initialContent = await readVaultFile(
      page,
      "Tasks/First test issue.md"
    );
    expect(initialContent).toBeTruthy();
    expect(initialContent).toContain(
      "This is the first test issue for multiple imports"
    );

    // Get the task and update it (simulating what happens during scheduling)
    const task = await getTaskByTitle(page, "First test issue");
    expect(task).toBeDefined();

    // Update the task with a doDate to trigger updateNote
    const updatedTask = await page.evaluate(async (taskToUpdate) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskOps = plugin.operations.taskOperations;

      const updated = {
        ...taskToUpdate,
        doDate: new Date().toISOString().split("T")[0], // Today's date
      };

      return await taskOps.update(updated);
    }, task);

    expect(updatedTask).toBeTruthy();

    // Wait for the update to complete by waiting for file to be updated
    await waitForFileUpdate(page, "Tasks/First test issue.md", "Do Date:");

    // CRITICAL: Read the file content again - it should still contain the GitHub issue content
    const finalContent = await readVaultFile(page, "Tasks/First test issue.md");
    expect(finalContent).toBeTruthy();
    expect(finalContent).toContain(
      "This is the first test issue for multiple imports"
    );
    expect(finalContent).toContain("Do Date:");
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

  test("should show 'Schedule for today' for already imported issue during wizard and stage it", async ({
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

    // Wait for GitHub service to be enabled
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

    // Import issue #111 so it becomes an already-imported item
    await clickIssueImportButton(page, 111);
    await waitForIssueImportComplete(page, 111);

    // Start Daily Planning wizard and go to step 2
    await executeCommand(page, "Task Sync: Start Daily Planning");
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Switch back to GitHub service in Tasks view (wizard stays open)
    await page.click('[data-testid="tasks-view-tab"]');
    await switchToTaskService(page, "github");

    // Find the already-imported issue and hover to reveal actions
    const importedIssue = page
      .locator('[data-testid="github-issue-item"]')
      .filter({ hasText: "#111" })
      .first();
    await importedIssue.waitFor({ state: "visible" });
    await importedIssue.hover();

    // Verify the wizard-specific action is visible for imported items (scoped to this item)
    const scheduleBtn = importedIssue.locator(
      '[data-testid="schedule-for-today-button"]'
    );
    await expect(scheduleBtn).toBeVisible();
    await expect(scheduleBtn).toHaveText("Schedule for today");

    // Click to stage scheduling for today
    await scheduleBtn.click();

    // Go back to the wizard (step 2 should still be shown)
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // The scheduled list should now include the imported issue title
    const scheduledItems = page.locator('[data-testid="scheduled-task"]');
    await expect(
      scheduledItems.filter({ hasText: "First test issue" })
    ).toHaveCount(1);
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
    expect(task.source.keys.github).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(task.source.keys.obsidian).toBe("Tasks/First test issue.md");

    // Modify the task file to trigger an update
    await updateFileFrontmatter(page, "Tasks/First test issue.md", {
      Status: "In Progress",
    });

    // Verify source.extension is STILL 'github' after file modification
    const taskAfterUpdate = await getTaskByTitle(page, "First test issue");
    expect(taskAfterUpdate).toBeDefined();
    expect(taskAfterUpdate.source.extension).toBe("github");
    expect(taskAfterUpdate.source.keys.github).toBe(
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
    expect(taskBeforeReload.source.keys.github).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(taskBeforeReload.source.keys.obsidian).toBe(
      "Tasks/First test issue.md"
    );

    // Verify persisted data has correct source metadata
    const persistedTask = await getPersistedTaskByTitle(
      page,
      "First test issue"
    );
    expect(persistedTask).toBeDefined();
    expect(persistedTask.source.extension).toBe("github");
    expect(persistedTask.source.keys.github).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(persistedTask.source.keys.obsidian).toBe(
      "Tasks/First test issue.md"
    );

    // Reload the plugin to simulate app restart
    await reloadPlugin(page);

    // Verify source.extension is STILL 'github' after reload
    const taskAfterReload = await getTaskByTitle(page, "First test issue");
    expect(taskAfterReload).toBeDefined();
    expect(taskAfterReload.source.extension).toBe("github");
    expect(taskAfterReload.source.keys.github).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(taskAfterReload.source.keys.obsidian).toBe(
      "Tasks/First test issue.md"
    );
  });

  test("should preserve source.extension='github' when file is modified multiple times", async ({
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

    // Verify initial source.extension is 'github'
    const initialTask = await getTaskByTitle(page, "First test issue");
    expect(initialTask).toBeDefined();
    expect(initialTask.source.extension).toBe("github");
    expect(initialTask.source.keys.github).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );

    // Modify the task file multiple times to trigger parseFileToTaskData
    await updateFileFrontmatter(page, "Tasks/First test issue.md", {
      Status: "In Progress",
    });

    // Wait for file change to be processed
    await waitForFileUpdate(
      page,
      "Tasks/First test issue.md",
      "Status: In Progress"
    );

    // Verify source.extension is STILL 'github' after first modification
    const taskAfterFirstUpdate = await getTaskByTitle(page, "First test issue");
    expect(taskAfterFirstUpdate).toBeDefined();
    expect(taskAfterFirstUpdate.source.extension).toBe("github");
    expect(taskAfterFirstUpdate.source.keys.github).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );

    // Modify the task file again
    await updateFileFrontmatter(page, "Tasks/First test issue.md", {
      Priority: "High",
    });

    // Wait for file change to be processed
    await waitForFileUpdate(
      page,
      "Tasks/First test issue.md",
      "Priority: High"
    );

    // Verify source.extension is STILL 'github' after second modification
    const taskAfterSecondUpdate = await getTaskByTitle(
      page,
      "First test issue"
    );
    expect(taskAfterSecondUpdate).toBeDefined();
    expect(taskAfterSecondUpdate.source.extension).toBe("github");
    expect(taskAfterSecondUpdate.source.keys.github).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );

    // Modify the task file a third time
    await updateFileFrontmatter(page, "Tasks/First test issue.md", {
      Category: "Enhancement",
    });

    // Wait for file change to be processed
    await waitForFileUpdate(
      page,
      "Tasks/First test issue.md",
      "Category: Enhancement"
    );

    // Verify source.extension is STILL 'github' after third modification
    const taskAfterThirdUpdate = await getTaskByTitle(page, "First test issue");
    expect(taskAfterThirdUpdate).toBeDefined();
    expect(taskAfterThirdUpdate.source.extension).toBe("github");
    expect(taskAfterThirdUpdate.source.keys.github).toBe(
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
        keys: {
          github: issueData.html_url,
        },
        data: {
          id: issueData.id,
          number: issueData.number,
          html_url: issueData.html_url,
        },
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

  test("should overwrite local changes with GitHub data when GitHub is refreshed", async ({
    page,
  }) => {
    // This test verifies that GitHub refresh overwrites local changes with authoritative GitHub data
    // GitHub is the source of truth during refresh operations

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

    // Switch to GitHub service and import an issue
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Click import button for first issue (#111)
    await clickIssueImportButton(page, 111);
    await waitForIssueImportComplete(page, 111);

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/First test issue.md");
    expect(taskExists).toBe(true);

    // Modify the task file title in Obsidian
    await updateFileFrontmatter(page, "Tasks/First test issue.md", {
      Title: "Modified GitHub Issue Title",
    });

    // Wait for file change to be processed
    await waitForFileUpdate(
      page,
      "Tasks/First test issue.md",
      "Title: Modified GitHub Issue Title"
    );

    // Wait for file watcher to process the change
    // This ensures the Obsidian file change is fully processed before GitHub refresh
    await waitForFileUpdate(
      page,
      "Tasks/First test issue.md",
      "Title: Modified GitHub Issue Title"
    );

    const refreshButton = page.locator(
      '[data-testid="task-sync-github-refresh-button"]'
    );
    await refreshButton.waitFor({ state: "visible", timeout: 5000 });
    await refreshButton.click();

    // Wait for refresh to complete by waiting for the button to be enabled again
    await page.waitForFunction(
      () => {
        const refreshButton = document.querySelector(
          '[data-testid="task-sync-github-refresh-button"]'
        );
        return refreshButton && !refreshButton.hasAttribute("disabled");
      },
      undefined,
      { timeout: 10000 }
    );

    // Verify that the GitHub task now reflects the original GitHub title (local changes overwritten)
    // Check this by looking at the task in the store
    const syncedTask = await page.evaluate(async () => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];

      // Get current tasks from store
      let currentTasks: any[] = [];
      const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
        currentTasks = state.tasks;
      });
      unsubscribe();

      // Find the GitHub task
      const githubTask = currentTasks.find(
        (t: any) =>
          t.source.keys.github ===
          "https://github.com/solnic/obsidian-task-sync/issues/111"
      );

      return githubTask;
    });

    expect(syncedTask).toBeDefined();
    expect(syncedTask.title).toBe("First test issue"); // Original GitHub title, not the modified one
    expect(syncedTask.source.extension).toBe("github");
    expect(syncedTask.source.keys.github).toBe(
      "https://github.com/solnic/obsidian-task-sync/issues/111"
    );
    expect(syncedTask.source.keys.obsidian).toBe("Tasks/First test issue.md");

    // CRITICAL: Also verify that the file front-matter was actually updated
    // This is the real test - the file should reflect the GitHub data, not the local changes
    const fileContent = await getFileContent(page, "Tasks/First test issue.md");
    expect(fileContent).toContain("Title: First test issue"); // Should be GitHub title, not "Modified GitHub Issue Title"
    expect(fileContent).not.toContain("Title: Modified GitHub Issue Title"); // Local changes should be overwritten
  });

  test("should restore last used org and repo filters when reopening GitHub tab", async ({
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

    // Select org and repo
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for issues to load
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      state: "visible",
      timeout: 5000,
    });

    // Switch to local tasks
    await switchToTaskService(page, "local");

    // Switch back to GitHub tasks
    await switchToTaskService(page, "github");

    // Verify that the org and repo filters are still set
    const orgButton = page.locator('[data-testid="organization-filter"]');
    const repoButton = page.locator('[data-testid="repository-filter"]');

    await expect(orgButton).toContainText("solnic");
    await expect(repoButton).toContainText("obsidian-task-sync");

    // Verify issues are still visible (filters are applied)
    const issueCount = await page
      .locator('[data-testid="github-issue-item"]')
      .count();
    expect(issueCount).toBeGreaterThan(0);
  });

  test("should persist recently used organizations and repositories across plugin reload", async ({
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

    // Switch to GitHub service
    await switchToTaskService(page, "github");

    // Select an organization and repository to add them to recently used
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for the selection to be saved
    await page.waitForTimeout(1000);

    // Reload the plugin to test persistence
    await reloadPlugin(page);

    // Re-stub GitHub API after reload
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Open the view again after reload
    await openView(page, "task-sync-main");

    // Switch to GitHub tasks
    await switchToTaskService(page, "github");

    // Wait for GitHub service to be ready
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Now check that recently used items appear at the top of dropdowns after reload
    // Wait for the GitHub service to load data and compute options
    await page.waitForTimeout(3000);

    // Click organization dropdown
    await page.locator('[data-testid="organization-filter"]').click();

    // Wait for dropdown to appear
    await page.waitForSelector('[data-testid="organization-filter-dropdown"]', {
      state: "visible",
      timeout: 5000,
    });

    // Get all dropdown items
    const orgItems = await page
      .locator(
        '[data-testid="organization-filter-dropdown"] .task-sync-selector-item'
      )
      .allTextContents();

    // The recently used "solnic" should be at index 1 (after "Select organization")
    expect(orgItems[1]).toContain("solnic");

    // Close the dropdown
    await page.keyboard.press("Escape");

    // Check repository dropdown as well
    await page.locator('[data-testid="repository-filter"]').click();

    await page.waitForSelector('[data-testid="repository-filter-dropdown"]', {
      state: "visible",
      timeout: 5000,
    });

    const repoItems = await page
      .locator(
        '[data-testid="repository-filter-dropdown"] .task-sync-selector-item'
      )
      .allTextContents();

    // The recently used "obsidian-task-sync" should be at index 1 (after "Select repository")
    expect(repoItems[1]).toContain("obsidian-task-sync");
  });

  test("should restore last used org and repo filters after plugin reload", async ({
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

    // Select org and repo
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for issues to load
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      state: "visible",
      timeout: 5000,
    });

    // Reload the plugin
    await reloadPlugin(page);

    // Re-stub GitHub API after reload
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Open the view again after reload
    await openView(page, "task-sync-main");

    // Switch to GitHub tasks
    await switchToTaskService(page, "github");

    // Wait for GitHub service to be ready
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    // Wait for data to load and filters to be restored
    await page.waitForTimeout(2000);

    // Verify that the org and repo filters are restored
    const orgButton = page.locator('[data-testid="organization-filter"]');
    const repoButton = page.locator('[data-testid="repository-filter"]');

    const orgText = await orgButton.textContent();
    const repoText = await repoButton.textContent();

    // The filters should be restored
    await expect(orgButton).toContainText("solnic");
    await expect(repoButton).toContainText("obsidian-task-sync");

    // Verify issues are visible (filters are applied)
    const issueCount = await page
      .locator('[data-testid="github-issue-item"]')
      .count();
    expect(issueCount).toBeGreaterThan(0);
  });

  test("should map GitHub labels to categories case-insensitively when importing", async ({
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

    // Import issue #111 which has "bug" label (should map to "Bug" category)
    await clickIssueImportButton(page, 111);
    await waitForIssueImportComplete(page, 111);

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/First test issue.md");
    expect(taskExists).toBe(true);

    // Verify the task has the correct category mapped from GitHub label
    const task = await getTaskByTitle(page, "First test issue");
    expect(task).toBeDefined();
    expect(task.category).toBe("Bug"); // "bug" label should map to "Bug" category

    // Verify the category is also in the file frontmatter
    const fileContent = await readVaultFile(page, "Tasks/First test issue.md");
    expect(fileContent).toContain("Category: Bug");
  });

  test("should map 'improvement' label to 'Improvement' category case-insensitively", async ({
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

    // Import issue #333 which has "improvement" label (should map to "Improvement" category)
    await clickIssueImportButton(page, 333);
    await waitForIssueImportComplete(page, 333);

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/Third test issue.md");
    expect(taskExists).toBe(true);

    // Verify the task has the default "Task" category since "improvement" doesn't match any available category
    const task = await getTaskByTitle(page, "Third test issue");
    expect(task).toBeDefined();
    expect(task.category).toBe("Improvement"); // "improvement" label should map to "Improvement" category

    // Verify the category is also in the file frontmatter
    const fileContent = await readVaultFile(page, "Tasks/Third test issue.md");
    expect(fileContent).toContain("Category: Improvement");
  });

  test("should map 'feature' label to 'Feature' category case-insensitively", async ({
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

    // Import issue #222 which has "feature" label (should map to "Feature" category)
    await clickIssueImportButton(page, 222);
    await waitForIssueImportComplete(page, 222);

    // Verify task file was created
    const taskExists = await fileExists(page, "Tasks/Second test issue.md");
    expect(taskExists).toBe(true);

    // Verify the task has the correct category mapped from GitHub label
    const task = await getTaskByTitle(page, "Second test issue");
    expect(task).toBeDefined();
    expect(task.category).toBe("Feature"); // "feature" label should map to "Feature" category

    // Verify the category is also in the file frontmatter
    const fileContent = await readVaultFile(page, "Tasks/Second test issue.md");
    expect(fileContent).toContain("Category: Feature");
  });

  test("should default to 'Task' category when GitHub label doesn't match any available category", async ({
    page,
  }) => {
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Override with custom issue that has a non-matching label
    await page.evaluate(() => {
      (window as any).__githubApiStubs.issues = [
        {
          id: 999888,
          number: 999,
          title: "Issue with non-matching label",
          body: "This issue has a label that doesn't match any configured category",
          state: "open",
          html_url: "https://github.com/solnic/obsidian-task-sync/issues/999",
          labels: [{ name: "wontfix", color: "ffffff" }], // This doesn't match any default category
          assignee: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];
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

    // Import issue #999 which has "wontfix" label (should default to "Task" category)
    await clickIssueImportButton(page, 999);
    await waitForIssueImportComplete(page, 999);

    // Verify task file was created
    const taskExists = await fileExists(
      page,
      "Tasks/Issue with non-matching label.md"
    );
    expect(taskExists).toBe(true);

    // Verify the task defaults to "Task" category since "wontfix" doesn't match any configured category
    const task = await getTaskByTitle(page, "Issue with non-matching label");
    expect(task).toBeDefined();
    expect(task.category).toBe("Task"); // Should default to "Task" category

    // Verify the category is also in the file frontmatter
    const fileContent = await readVaultFile(
      page,
      "Tasks/Issue with non-matching label.md"
    );
    expect(fileContent).toContain("Category: Task");
  });
});
