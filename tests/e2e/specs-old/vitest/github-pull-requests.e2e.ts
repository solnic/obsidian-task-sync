/**
 * E2E tests for GitHub Pull Requests Integration
 */

import { test, expect, describe, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import {
  enableIntegration,
  openView,
  switchToTaskService,
  toggleSidebar,
} from "../../helpers/global";
import { stubGitHubWithFixtures } from "../../helpers/github-integration-helpers";

describe("GitHub Pull Requests Integration", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test("should display pull requests tab and switch between tabs", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    await stubGitHubWithFixtures(context.page, {
      issues: "issues-basic",
      pullRequests: "pull-requests-multiple",
      repositories: "repositories-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    const pullRequestsTab = context.page.locator(
      '[data-testid="pull-requests-tab"]'
    );

    await pullRequestsTab.click();

    // Should show pull requests
    const prItems = context.page.locator('[data-testid="pr-item"]');
    const prCount = await prItems.count();

    expect(prCount).toBe(2);
  });

  test("should display pull request details correctly", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    await stubGitHubWithFixtures(context.page, {
      issues: "issues-basic",
      pullRequests: "pull-requests-detailed",
      repositories: "repositories-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    const pullRequestsTab = context.page.locator(
      '[data-testid="pull-requests-tab"]'
    );
    await pullRequestsTab.click();

    const prItem = context.page.locator('[data-testid="pr-item"]').first();
    const prItemVisible = await prItem.isVisible();

    expect(prItemVisible).toBe(true);

    // Check title and number
    const titleText = await prItem
      .locator(".task-sync-item-title")
      .textContent();
    const numberText = await prItem
      .locator(".task-sync-item-subtitle")
      .textContent();

    expect(titleText).toContain("Implement new authentication system");
    expect(numberText).toContain("#123");

    // Check metadata (assignee and branch info - state is shown in badges)
    const metaText = await prItem.locator(".task-sync-item-meta").textContent();
    expect(metaText).toContain("Assigned to reviewer");
    expect(metaText).toContain("feature/oauth2 → main");

    // Check labels
    const labels = prItem.locator(".task-sync-item-label");
    const labelCount = await labels.count();
    expect(labelCount).toBe(2);

    const firstLabelText = await labels.nth(0).textContent();
    const secondLabelText = await labels.nth(1).textContent();
    expect(firstLabelText).toContain("enhancement");
    expect(secondLabelText).toContain("security");
  });
});
