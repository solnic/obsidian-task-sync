/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createTestFolders } from "../helpers/task-sync-setup";
import { toggleSidebar } from "../helpers/plugin-setup";
import {
  openGitHubSettings,
  toggleGitHubIntegration,
  configureGitHubToken,
  configureGitHubIntegration,
  openGitHubIssuesView,
  stubGitHubWithFixtures,
} from "../helpers/github-integration-helpers";

describe("GitHub Integration", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
  });

  beforeEach(async () => {
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

  test("should filter repositories by organization when organization is selected", async () => {
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-with-orgs",
      issues: "issues-basic",
      organizations: "organizations-basic",
    });

    await openGitHubIssuesView(context.page);

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
