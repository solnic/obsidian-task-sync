/**
 * E2E tests for GitHub Integration
 * Tests basic GitHub service functionality with stubbed API responses
 */

import { test, expect } from "@playwright/test";

test.describe("GitHub Integration - Basic", () => {
  test.beforeEach(async ({ page }) => {
    // Open right sidebar for Tasks view
    await page.evaluate(() => {
      const app = (window as any).app;
      app.workspace.rightSplit.expand();
    });
  });

  test("should display GitHub issues when service is selected", async ({
    page,
  }) => {
    // Enable GitHub integration
    await page.evaluate(async (config) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      // Update settings to enable GitHub integration
      plugin.settings.integrations.github = {
        ...plugin.settings.integrations.github,
        enabled: true,
        personalAccessToken: "fake-token-for-testing",
        defaultRepository: "solnic/obsidian-task-sync",
      };

      await plugin.saveSettings();
    }, {});

    // Stub GitHub API responses
    await page.evaluate(async (fixtures) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Load fixture data
      const issuesFixture = await fetch(
        `/tests/e2e/fixtures/github/${fixtures.issues}.json`
      ).then((r) => r.json());
      const repositoriesFixture = await fetch(
        `/tests/e2e/fixtures/github/${fixtures.repositories}.json`
      ).then((r) => r.json());
      const currentUserFixture = await fetch(
        `/tests/e2e/fixtures/github/${fixtures.currentUser}.json`
      ).then((r) => r.json());
      const labelsFixture = await fetch(
        `/tests/e2e/fixtures/github/${fixtures.labels}.json`
      ).then((r) => r.json());

      // Store fixtures in window for stubbing
      (window as any).__githubApiStubs = {
        issues: issuesFixture,
        repositories: repositoriesFixture,
        currentUser: currentUserFixture,
        labels: labelsFixture,
      };

      // Get GitHub extension
      const githubExtension = plugin.taskSyncApp?.githubExtension;
      if (!githubExtension) {
        throw new Error("GitHub extension not found");
      }

      // Store original methods
      if (!(githubExtension as any).__originals) {
        (githubExtension as any).__originals = {
          fetchIssues: githubExtension.fetchIssues,
          fetchRepositories: githubExtension.fetchRepositories,
          getCurrentUser: githubExtension.getCurrentUser,
          fetchLabels: githubExtension.fetchLabels,
        };
      }

      // Install stubs
      githubExtension.fetchIssues = async () => {
        console.log("🔧 Stubbed fetchIssues called");
        return (window as any).__githubApiStubs?.issues || [];
      };

      githubExtension.fetchRepositories = async () => {
        console.log("🔧 Stubbed fetchRepositories called");
        return (window as any).__githubApiStubs?.repositories || [];
      };

      githubExtension.getCurrentUser = async () => {
        console.log("🔧 Stubbed getCurrentUser called");
        return (window as any).__githubApiStubs?.currentUser || null;
      };

      githubExtension.fetchLabels = async () => {
        console.log("🔧 Stubbed fetchLabels called");
        return (window as any).__githubApiStubs?.labels || [];
      };
    }, {
      issues: "issues-basic",
      repositories: "repositories-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Open Tasks view
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Activate the Tasks view
      const leaves = app.workspace.getLeavesOfType("task-sync-tasks-view");
      if (leaves.length > 0) {
        app.workspace.revealLeaf(leaves[0]);
      } else {
        await app.workspace.getRightLeaf(false).setViewState({
          type: "task-sync-tasks-view",
          active: true,
        });
      }
    });

    // Wait for Tasks view to be visible
    await page.waitForSelector('[data-type="task-sync-tasks-view"]', {
      state: "visible",
    });

    // Switch to GitHub service
    const serviceSelector = page.locator('[data-testid="service-selector"]');
    await serviceSelector.waitFor({ state: "visible" });
    await serviceSelector.click();

    // Wait for dropdown to appear
    const dropdown = page.locator(".task-sync-selector-menu");
    await dropdown.waitFor({ state: "visible" });

    // Select GitHub service
    const githubOption = dropdown.locator(
      '.task-sync-selector-item:has-text("GitHub")'
    );
    await githubOption.waitFor({ state: "visible" });
    await githubOption.click();

    // Wait for GitHub service to load
    await page.waitForSelector('[data-testid="github-service"]', {
      state: "visible",
    });

    // Verify issues are displayed
    const issuesList = page.locator('[data-testid="github-issues-list"]');
    await issuesList.waitFor({ state: "visible" });

    // Wait for issue items to appear
    const issueItems = page.locator('[data-testid="github-issue-item"]');
    await issueItems.first().waitFor({ state: "visible" });

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

