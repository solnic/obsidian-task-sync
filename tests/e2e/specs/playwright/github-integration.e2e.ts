/**
 * E2E tests for GitHub Integration
 * Ported from vitest version to Playwright
 */

import { test, expect } from "../../helpers/setup";
import { openView } from "../../helpers/global";
import { stubGitHubWithFixtures } from "../../helpers/github-integration-helpers";

test.describe("GitHub Integration", () => {
  test("should display GitHub issues when GitHub service is selected", async ({
    page,
  }) => {
    // Stub GitHub API with fixtures
    await stubGitHubWithFixtures(page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Open Tasks view FIRST
    await openView(page, "task-sync-main");

    // Wait for view to be visible
    await page.waitForSelector('[data-testid="tasks-view"]', {
      state: "visible",
      timeout: 5000,
    });

    // Enable GitHub integration - settings change will reactively initialize extension
    const result = await page.evaluate(async () => {
      try {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        console.log("Before enabling GitHub integration");

        // Update settings in memory
        plugin.settings.integrations.github.enabled = true;
        plugin.settings.integrations.github.personalAccessToken =
          "fake-token-for-testing";
        plugin.settings.integrations.github.defaultRepository =
          "solnic/obsidian-task-sync";

        console.log("Settings updated, calling updateSettings...");

        // Trigger reactive update WITHOUT saving (to avoid plugin reload)
        const taskSyncApp = plugin.host.getApp();
        await taskSyncApp.updateSettings(plugin.settings);

        console.log(
          "updateSettings completed, GitHub extension:",
          !!taskSyncApp.githubExtension
        );

        return { success: true };
      } catch (error: any) {
        console.error("Error in updateSettings:", error);
        return { success: false, error: error?.message || String(error) };
      }
    });

    if (!result.success) {
      throw new Error(`Failed to enable GitHub integration: ${result.error}`);
    }

    // Wait for GitHub extension to be initialized
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const taskSyncApp = plugin.host.getApp();
        const isInitialized =
          taskSyncApp?.githubExtension?.initialized === true;
        console.log("GitHub extension initialized:", isInitialized);
        return isInitialized;
      },
      { timeout: 5000 }
    );

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    // Wait a bit longer to ensure everything is ready
    await page.waitForTimeout(2000);

    // Click GitHub service button
    await page.click('[data-testid="service-github"]');

    // Wait for the click to process
    await page.waitForTimeout(500);

    // Wait for GitHub service to be visible
    await page.waitForSelector('[data-testid="github-service"]', {
      state: "visible",
      timeout: 10000,
    });

    // Verify issues list is displayed
    const issuesList = page.locator('[data-testid="github-issues-list"]');
    await issuesList.waitFor({ state: "visible", timeout: 10000 });

    // Wait for issue items to appear
    const issueItems = page.locator('[data-testid="github-issue-item"]');
    await issueItems.first().waitFor({ state: "visible", timeout: 10000 });

    // Verify we have issues displayed
    const issueCount = await issueItems.count();
    expect(issueCount).toBeGreaterThan(0);

    // Verify first issue has expected structure
    const firstIssue = issueItems.first();
    const issueNumber = await firstIssue.locator(".issue-number").textContent();
    const issueTitle = await firstIssue.locator(".issue-title").textContent();
    const issueState = await firstIssue.locator(".issue-state").textContent();

    expect(issueNumber).toBeTruthy();
    expect(issueTitle).toBeTruthy();
    expect(issueState).toBeTruthy();
  });
});
