/**
 * E2E tests for GitHub import status persistence
 * Tests that import status is preserved across plugin restarts
 */

import { test, expect, describe } from "vitest";
import { createTestFolders } from "../helpers/task-sync-setup";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { toggleSidebar } from "../helpers/plugin-setup";
import {
  configureGitHubIntegration,
  openGitHubIssuesView,
  waitForGitHubViewContent,
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../helpers/github-integration-helpers";

describe("GitHub Import Status Persistence", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await createTestFolders(context.page);
    await toggleSidebar(context.page, "right", true);
  });

  test("should preserve import status after plugin restart", async () => {
    // Use fixture-based stubbing for better maintainability
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "persistence-test",
    });

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    // Open GitHub Issues view through UI
    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 15000);

    // Verify the issue appears and is not imported initially
    const isNotImportedInitially = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll(
        '[data-testid="issue-item"]'
      );
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || "";
        if (
          issueText.includes("#999") &&
          issueText.includes("Test import persistence issue")
        ) {
          return item.getAttribute("data-imported") === "false";
        }
      }
      return false;
    });

    expect(isNotImportedInitially).toBe(true);

    // Hover over the issue to make import button visible and verify it exists
    const issueLocator = context.page
      .locator('[data-testid="issue-item"]')
      .filter({
        hasText: "#999",
      });
    await issueLocator.hover();

    const importButton = issueLocator.locator(
      '[data-testid="issue-import-button"]'
    );
    await importButton.waitFor({ state: "visible", timeout: 5000 });
    expect(await importButton.isVisible()).toBe(true);

    // Click the import button through UI
    await clickIssueImportButton(context.page, 999);

    // Wait for import to complete
    await waitForIssueImportComplete(context.page, 999);

    // Verify the issue now shows "Imported" status via data attribute
    const hasImportedStatus = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll(
        '[data-testid="issue-item"]'
      );
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || "";
        if (
          issueText.includes("#999") &&
          issueText.includes("Test import persistence issue")
        ) {
          return item.getAttribute("data-imported") === "true";
        }
      }
      return false;
    });

    expect(hasImportedStatus).toBe(true);

    // Verify import status is recorded by checking if task file exists
    const importStatusBeforeRestart = await context.page.evaluate(() => {
      const app = (window as any).app;
      // Check if the task file exists in the vault (using the actual issue title)
      const taskFile = app.vault.getAbstractFileByPath(
        "Tasks/Test import persistence issue.md"
      );
      return taskFile !== null;
    });

    expect(importStatusBeforeRestart).toBe(true);

    // Wait for any pending save operations to complete
    await context.page.waitForTimeout(1000);

    // Restart the plugin
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const pluginManager = app.plugins;

      await pluginManager.disablePlugin("obsidian-task-sync");
      await pluginManager.enablePlugin("obsidian-task-sync");
    });

    // Wait for plugin to fully initialize
    await context.page.waitForTimeout(3000);

    // Verify import status is still recorded after restart by checking task file
    const importStatusAfterRestart = await context.page.evaluate(() => {
      const app = (window as any).app;
      // Check if the task file still exists in the vault after restart
      const taskFile = app.vault.getAbstractFileByPath(
        "Tasks/Test import persistence issue.md"
      );
      return taskFile !== null;
    });

    expect(importStatusAfterRestart).toBe(true);

    // Re-stub the APIs after plugin restart
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "persistence-test",
    });

    await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin && plugin.githubService) {
        const views = app.workspace.getLeavesOfType("github-issues");
        if (views.length > 0) {
          views[0].view.refresh();
        }
      }
    });

    await context.page.waitForTimeout(2000);

    const stillHasImportedStatus = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll(
        '[data-testid="issue-item"]'
      );
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || "";
        if (
          issueText.includes("#999") &&
          issueText.includes("Test import persistence issue")
        ) {
          return item.getAttribute("data-imported") === "true";
        }
      }
      return false;
    });

    expect(stillHasImportedStatus).toBe(true);
  });
});
