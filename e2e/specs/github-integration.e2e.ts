/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createTestFolders } from "../helpers/task-sync-setup";
import { toggleSidebar } from "../helpers/plugin-setup";
import {
  waitForGitHubViewContent,
  openGitHubSettings,
  toggleGitHubIntegration,
  configureGitHubToken,
  configureGitHubIntegration,
  openGitHubIssuesView,
  stubGitHubWithFixtures,
} from "../helpers/github-integration-helpers";

describe("GitHub Integration", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await createTestFolders(context.page);
    await toggleSidebar(context.page, "right", true);
  });

  test("should configure GitHub token via settings input", async () => {
    await openGitHubSettings(context);
    await toggleGitHubIntegration(context.page, true);
    await configureGitHubToken(context.page, "test-token-123");

    const tokenConfigured = await context.page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (!settingsContainer) return false;

      const settings = Array.from(
        settingsContainer.querySelectorAll(".setting-item")
      );
      for (const setting of settings) {
        const nameEl = setting.querySelector(".setting-item-name");
        if (
          nameEl &&
          nameEl.textContent?.includes("GitHub Personal Access Token")
        ) {
          const input = setting.querySelector(
            'input[type="password"]'
          ) as HTMLInputElement;
          return input && input.value === "test-token-123";
        }
      }
      return false;
    });

    expect(tokenConfigured).toBe(true);
  });

  test("should display import buttons on GitHub issues", async () => {
    // Use fixture-based stubbing for better maintainability
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "integration-test",
    });

    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 30000);

    // Check for import buttons on issues (they appear on hover)
    const issueItems = context.page.locator('[data-testid="issue-item"]');
    const issueCount = await issueItems.count();

    expect(issueCount).toBeGreaterThan(0);

    // Test hover functionality on the first issue
    const firstIssue = issueItems.first();

    // Hover over the issue
    await firstIssue.hover();

    // Wait for the import button to be visible
    await context.page.waitForSelector('[data-testid="issue-import-button"]', {
      state: "visible",
      timeout: 5000,
    });

    // Move away to test hover state cleanup
    await context.page.locator("body").hover();

    // Wait for the import button to be hidden
    await context.page.waitForSelector('[data-testid="issue-import-button"]', {
      state: "hidden",
      timeout: 5000,
    });
  });
});
