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
} from "../../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";

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

    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    expect(
      await page
        .locator(".task-sync-item-title:has-text('First test issue')")
        .count()
    ).toBe(1);
  });

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
});
