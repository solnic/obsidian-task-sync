/**
 * E2E tests for GitHub Integration
 * Ported from vitest version to Playwright
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
} from "../../helpers/global";
import { stubGitHubWithFixtures } from "../../helpers/github-integration-helpers";

test.describe("GitHub Integration", () => {
  test("should display GitHub issues when GitHub service is selected", async ({
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

    await page.locator('[data-testid="organization-filter"]').click();

    await page
      .locator(
        '[data-testid="organization-filter-dropdown-item"]:has-text("solnic")'
      )
      .click();

    await page.locator('[data-testid="repository-filter"]').click();

    await page
      .locator(
        '[data-testid="repository-filter-dropdown-item"]:has-text("obsidian-task-sync")'
      )
      .click();

    expect(
      await page
        .locator(".task-sync-item-title:has-text('First test issue')")
        .count()
    ).toBe(1);
  });
});
