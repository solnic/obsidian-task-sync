/**
 * E2E tests for GitHub Pull Requests Integration
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createTestFolders } from "../helpers/task-sync-setup";
import { toggleSidebar } from "../helpers/plugin-setup";
import {
  waitForGitHubViewContent,
  configureGitHubIntegration,
  openGitHubIssuesView,
  stubGitHubWithFixtures,
} from "../helpers/github-integration-helpers";

describe("GitHub Pull Requests Integration", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await createTestFolders(context.page);
    await toggleSidebar(context.page, "right", true);
  });

  test("should display pull requests tab and switch between tabs", async () => {
    await stubGitHubWithFixtures(context.page, {
      issues: "issues-basic",
      pullRequests: "pull-requests-multiple",
      repositories: "repositories-basic",
    });

    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 30000);

    // Check that both tabs are visible
    const issuesTab = context.page.locator('[data-testid="issues-tab"]');
    const pullRequestsTab = context.page.locator(
      '[data-testid="pull-requests-tab"]'
    );

    const issuesTabVisible = await issuesTab.isVisible();
    const pullRequestsTabVisible = await pullRequestsTab.isVisible();

    expect(issuesTabVisible).toBe(true);
    expect(pullRequestsTabVisible).toBe(true);

    // Issues tab should be active by default
    const issuesTabClass = await issuesTab.getAttribute("class");
    const pullRequestsTabClass = await pullRequestsTab.getAttribute("class");

    expect(issuesTabClass).toContain("active");
    expect(pullRequestsTabClass).not.toContain("active");

    // Should show issues by default
    const issueItems = context.page.locator('[data-testid="issue-item"]');
    const issueCount = await issueItems.count();
    expect(issueCount).toBe(1);

    // Click on pull requests tab
    await pullRequestsTab.click();

    // Wait for pull requests to load
    await context.page.waitForTimeout(1000);

    // Pull requests tab should now be active
    const pullRequestsTabClassAfter = await pullRequestsTab.getAttribute(
      "class"
    );
    const issuesTabClassAfter = await issuesTab.getAttribute("class");

    expect(pullRequestsTabClassAfter).toContain("active");
    expect(issuesTabClassAfter).not.toContain("active");

    // Should show pull requests
    const prItems = context.page.locator('[data-testid="pr-item"]');
    const prCount = await prItems.count();
    expect(prCount).toBe(2);

    // Switch back to issues tab
    await issuesTab.click();
    await context.page.waitForTimeout(500);

    // Issues tab should be active again
    const issuesTabClassFinal = await issuesTab.getAttribute("class");
    const pullRequestsTabClassFinal = await pullRequestsTab.getAttribute(
      "class"
    );

    expect(issuesTabClassFinal).toContain("active");
    expect(pullRequestsTabClassFinal).not.toContain("active");

    // Should show issues again
    const issueCountFinal = await issueItems.count();
    expect(issueCountFinal).toBe(1);
  });

  test("should display pull request details correctly", async () => {
    await stubGitHubWithFixtures(context.page, {
      issues: "issues-basic",
      pullRequests: "pull-requests-detailed",
      repositories: "repositories-basic",
    });

    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 30000);

    // Switch to pull requests tab
    const pullRequestsTab = context.page.locator(
      '[data-testid="pull-requests-tab"]'
    );
    await pullRequestsTab.click();
    await context.page.waitForTimeout(1000);

    // Check pull request details
    const prItem = context.page.locator('[data-testid="pr-item"]').first();
    const prItemVisible = await prItem.isVisible();
    expect(prItemVisible).toBe(true);

    // Check title and number
    const titleText = await prItem.locator(".issue-title").textContent();
    const numberText = await prItem.locator(".issue-number").textContent();

    expect(titleText).toContain("Implement new authentication system");
    expect(numberText).toContain("#123");

    // Check metadata (assignee, state, branch info)
    const metaText = await prItem.locator(".issue-meta").textContent();
    expect(metaText).toContain("Assigned to reviewer");
    expect(metaText).toContain("open");
    expect(metaText).toContain("feature/oauth2 → main");

    // Check labels
    const labels = prItem.locator(".issue-label");
    const labelCount = await labels.count();
    expect(labelCount).toBe(2);

    const firstLabelText = await labels.nth(0).textContent();
    const secondLabelText = await labels.nth(1).textContent();
    expect(firstLabelText).toContain("enhancement");
    expect(secondLabelText).toContain("security");
  });

  test("should show import button on pull request hover", async () => {
    await stubGitHubWithFixtures(context.page, {
      issues: "issues-basic",
      pullRequests: "pull-requests-basic",
      repositories: "repositories-basic",
    });

    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 30000);

    // Switch to pull requests tab
    const pullRequestsTab = context.page.locator(
      '[data-testid="pull-requests-tab"]'
    );
    await pullRequestsTab.click();
    await context.page.waitForTimeout(1000);

    // Hover over the pull request
    const prItem = context.page.locator('[data-testid="pr-item"]').first();
    await prItem.hover();

    // Wait for the import button to be visible
    await context.page.waitForSelector('[data-testid="pr-import-button"]', {
      state: "visible",
      timeout: 5000,
    });

    const importButton = context.page.locator(
      '[data-testid="pr-import-button"]'
    );
    const importButtonVisible = await importButton.isVisible();
    const importButtonText = await importButton.textContent();

    expect(importButtonVisible).toBe(true);
    expect(importButtonText).toContain("Import");

    // Move away to test hover state cleanup
    await context.page.locator("body").hover();

    // Wait for the import button to be hidden
    await context.page.waitForSelector('[data-testid="pr-import-button"]', {
      state: "hidden",
      timeout: 5000,
    });
  });

  test("should update search placeholder based on active tab", async () => {
    await stubGitHubWithFixtures(context.page, {
      issues: "issues-basic",
      pullRequests: "pull-requests-basic",
      repositories: "repositories-basic",
    });

    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 30000);

    const searchInput = context.page.locator('[data-testid="search-input"]');

    // Should show "Search issues..." by default
    const initialPlaceholder = await searchInput.getAttribute("placeholder");
    expect(initialPlaceholder).toBe("Search issues...");

    // Switch to pull requests tab
    const pullRequestsTab = context.page.locator(
      '[data-testid="pull-requests-tab"]'
    );
    await pullRequestsTab.click();
    await context.page.waitForTimeout(500);

    // Should show "Search pull requests..."
    const prPlaceholder = await searchInput.getAttribute("placeholder");
    expect(prPlaceholder).toBe("Search pull requests...");

    // Switch back to issues tab
    const issuesTab = context.page.locator('[data-testid="issues-tab"]');
    await issuesTab.click();
    await context.page.waitForTimeout(500);

    // Should show "Search issues..." again
    const finalPlaceholder = await searchInput.getAttribute("placeholder");
    expect(finalPlaceholder).toBe("Search issues...");
  });
});
