/**
 * E2E tests for GitHub task import and deletion synchronization
 * Tests that deleting imported task files properly updates GitHub imported status
 */

import { test, expect } from "../helpers/setup";
import {
  executeCommand,
  openView,
  enableIntegration,
  switchToTaskService,
  selectFromDropdown,
  deleteVaultFile,
  waitForFileDeletion,
} from "../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../helpers/github-integration-helpers";

test.describe("GitHub Import and Deletion Sync", () => {
  test("should remove imported status when local task file is deleted and refresh is run", async ({
    page,
  }) => {
    // Open view and enable GitHub integration first
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    // Setup GitHub API stubs
    await stubGitHubWithFixtures(page, {
      issues: "issues-basic",
      repositories: "repositories-basic",
      currentUser: "current-user-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 2500,
      }
    );

    // Switch to GitHub service and select repository
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for GitHub tasks to load
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      timeout: 2500,
    });

    // Import the GitHub issue (issue #999 from the fixture)
    await clickIssueImportButton(page, 999);
    await waitForIssueImportComplete(page, 999);

    // Verify the task file was created
    const githubUrl = "https://github.com/solnic/obsidian-task-sync/issues/999";
    const taskFilePath = await page.evaluate((url) => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      let tasks: any[] = [];
      const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
        tasks = state.tasks;
      });
      unsubscribe();

      const importedTask = tasks.find((t: any) => t.source.keys.github === url);
      return importedTask?.source.keys.obsidian;
    }, githubUrl);

    expect(taskFilePath).toBeTruthy();

    // Delete the local task file
    await deleteVaultFile(page, taskFilePath);
    await waitForFileDeletion(page, taskFilePath);

    // Verify task was removed from task store
    const taskInStore = await page.evaluate((url) => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      let tasks: any[] = [];
      const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
        tasks = state.tasks;
      });
      unsubscribe();

      return tasks.find((t: any) => t.source.keys.github === url);
    }, githubUrl);

    expect(taskInStore).toBeUndefined();

    // Verify GitHub entity store still has the issue but without Obsidian key
    const githubStoreCheck = await page.evaluate((url) => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      const githubExtension = plugin.taskSyncApp.githubExtension;

      if (!githubExtension) {
        return { error: "GitHub extension not found" };
      }

      let githubTasks: any[] = [];
      const unsubscribe = githubExtension
        .getEntityStore()
        .subscribe((tasks: any) => {
          githubTasks = tasks;
        });
      unsubscribe();

      const task = githubTasks.find((t: any) => t.source?.keys?.github === url);
      return {
        taskFound: !!task,
        taskCount: githubTasks.length,
        taskId: task?.id,
        hasObsidianKey: task?.source?.keys?.obsidian ? true : false,
      };
    }, githubUrl);

    // GitHub issue should be removed from entity store after deletion
    // (reactive cleanup removes deleted tasks from GitHub entity store)
    expect(githubStoreCheck.taskFound).toBe(false);

    // Run "Refresh Tasks" command
    await executeCommand(page, "Refresh Tasks");

    // Verify the GitHub task no longer shows as imported
    await openView(page, "task-sync-main");
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for GitHub tasks to load
    await page.waitForSelector('[data-testid="github-issue-item"]', {
      timeout: 2500,
    });

    // The task should be visible but NOT have the imported badge
    const taskItemAfterRefresh = page
      .locator('[data-testid="github-issue-item"]')
      .filter({ hasText: "Test import persistence issue" })
      .first();
    await expect(taskItemAfterRefresh).toBeVisible();

    // Should NOT have imported badge
    const importedBadge = taskItemAfterRefresh.locator(
      '[data-testid="imported-badge"]'
    );
    await expect(importedBadge).not.toBeVisible();

    // Hover over the item to make the import button appear
    await taskItemAfterRefresh.hover();

    // Should have import button available again
    const importButton = taskItemAfterRefresh.locator(
      '[data-testid="issue-import-button"]'
    );
    await expect(importButton).toBeVisible();
  });
});
