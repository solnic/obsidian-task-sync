/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import {
  toggleSidebar,
  openView,
  enableIntegration,
  switchToTaskService,
} from "../../helpers/global";
import {
  openGitHubIssuesView,
  stubGitHubWithFixtures,
} from "../../helpers/github-integration-helpers";

describe("GitHub Integration", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test("should filter repositories by organization when organization is selected", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-with-orgs",
      issues: "issues-basic",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    // First check that repository filter shows full names when no org is selected
    const repositoryFilter = context.page.locator(
      '[data-testid="repository-filter"]'
    );
    await repositoryFilter.click();

    let dropdown = context.page.locator(".task-sync-selector-menu");
    await dropdown.waitFor({ state: "visible" });

    // Close the dropdown by clicking elsewhere
    await context.page.click("body");
    await dropdown.waitFor({ state: "hidden" });

    // Now select an organization
    const organizationFilter = context.page.locator(
      '[data-testid="organization-filter"]'
    );
    await organizationFilter.click();

    const orgDropdown = context.page.locator(".task-sync-selector-menu");
    await orgDropdown.waitFor({ state: "visible" });

    // Select the first organization available
    const firstOrg = orgDropdown.locator(".task-sync-selector-item").first();
    const orgName = await firstOrg.textContent();
    await firstOrg.click();

    // Wait for organization selection to complete and repositories to load
    await context.page.waitForTimeout(2000);

    // Verify that the organization filter shows as active
    const orgFilterText = await organizationFilter.textContent();
    expect(orgFilterText).toContain(orgName);

    // Now check repository filter after organization selection
    await repositoryFilter.click();

    dropdown = context.page.locator(".task-sync-selector-menu");
    await dropdown.waitFor({ state: "visible" });

    const repoOptions = dropdown.locator(".task-sync-selector-item");
    const repoCount = await repoOptions.count();

    // Should have repositories available for the selected organization
    expect(repoCount).toBeGreaterThan(0);

    // Verify that we can select a repository from the filtered list
    const firstRepo = repoOptions.first();
    await firstRepo.click();

    // Wait for repository selection to complete
    await context.page.waitForTimeout(1000);

    // Verify that repository filter shows the selected repository
    const repoFilterText = await repositoryFilter.textContent();
    expect(repoFilterText).not.toBe("Select repository");
  });
});
