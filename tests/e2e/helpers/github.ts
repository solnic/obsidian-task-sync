/**
 * GitHub helper functions for e2e tests
 * Provides reusable functions for GitHub integration testing including organization/repository mapping
 */

import type { Page } from "playwright";
import { expect } from "playwright/test";
import { stubGitHubAPIs } from "./api-stubbing";
import type { GitHubOrgRepoMapping } from "../../../src/app/types/settings";

/**
 * Open settings modal
 */
export async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press("Control+,");
  await page.waitForSelector(".vertical-tab-content", { timeout: 5000 });

  // Navigate to Task Sync settings
  const taskSyncTab = page
    .locator(".vertical-tab-nav-item")
    .filter({ hasText: "Task Sync" });
  await taskSyncTab.click();
  await page.waitForTimeout(500);
}

/**
 * Enable GitHub integration with basic configuration
 */
export async function enableGitHubIntegration(
  page: Page,
  config: {
    personalAccessToken: string;
    defaultRepository?: string;
  }
): Promise<void> {
  // Find and click the GitHub integration toggle
  const toggleSetting = page.locator(".setting-item").filter({
    hasText: "Enable GitHub Integration",
  });

  const toggle = toggleSetting.locator(".checkbox-container");
  await toggle.click();

  // Wait for additional settings to appear
  await page.waitForTimeout(1000);

  // Configure personal access token
  const tokenSetting = page.locator(".setting-item").filter({
    hasText: "GitHub Personal Access Token",
  });
  const tokenInput = tokenSetting.locator('input[type="password"]');
  await tokenInput.fill(config.personalAccessToken);

  // Configure default repository if provided
  if (config.defaultRepository) {
    const repoSetting = page.locator(".setting-item").filter({
      hasText: "Default Repository",
    });
    const repoInput = repoSetting.locator('input[type="text"]');
    await repoInput.fill(config.defaultRepository);
  }
}

/**
 * Configure GitHub organization/repository mappings
 */
export async function configureGitHubOrgRepoMappings(
  page: Page,
  mappings: GitHubOrgRepoMapping[]
): Promise<void> {
  // Scroll down to find the mappings section
  await page.evaluate(() => {
    const settingsContainer = document.querySelector(".vertical-tab-content");
    if (settingsContainer) {
      settingsContainer.scrollTop = settingsContainer.scrollHeight;
    }
  });

  // Wait for GitHub settings to be fully loaded
  await page.waitForTimeout(2000);

  // For now, configure mappings programmatically since the UI might not be fully implemented
  await page.evaluate(async (mappingsData) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (!plugin) {
      throw new Error("Task Sync plugin not found");
    }

    // Update the settings with the mappings
    plugin.settings.integrations.github.orgRepoMappings = mappingsData;
    await plugin.saveSettings();

    // Update the GitHub extension if it exists
    const githubExtension = plugin.host?.getExtensionById?.("github");
    if (githubExtension && githubExtension.updateSettings) {
      githubExtension.updateSettings(plugin.settings);
    }
  }, mappings);
}

/**
 * Open Tasks view
 */
export async function openTasksView(page: Page): Promise<void> {
  // Use command palette to open Tasks view
  await page.keyboard.press("Control+p");
  await page.fill(".prompt-input", "Tasks");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);

  // Wait for Tasks view to be visible
  await page.waitForSelector('[data-testid="tasks-view"]', { timeout: 10000 });
}

/**
 * Switch to GitHub service in Tasks view
 */
export async function switchToGitHubService(page: Page): Promise<void> {
  const githubTab = page.locator('[data-testid="service-github"]');
  await githubTab.click();
  await page.waitForTimeout(1000);

  // Wait for GitHub service content to load
  await page.waitForSelector('[data-testid="github-service"]', {
    timeout: 10000,
  });
}

/**
 * Select a repository in GitHub service
 */
export async function selectRepository(
  page: Page,
  repository: string
): Promise<void> {
  // Look for repository dropdown or input
  const repoDropdown = page
    .locator('[data-testid="repository-filter"]')
    .or(page.locator("select").filter({ hasText: /repository/i }));

  if (await repoDropdown.isVisible()) {
    await repoDropdown.selectOption(repository);
  } else {
    // Try clicking on repository selector
    const repoSelector = page
      .locator(".repository-selector")
      .or(page.locator("button").filter({ hasText: /repository/i }));
    await repoSelector.click();

    // Select the repository from dropdown
    const repoOption = page.locator(`text=${repository}`);
    await repoOption.click();
  }

  await page.waitForTimeout(1000);
}

/**
 * Import a GitHub issue by issue number
 */
export async function importGitHubIssue(
  page: Page,
  issueNumber: number
): Promise<void> {
  // Find the issue item
  const issueItem = page.locator('[data-testid="github-issue-item"]').filter({
    hasText: `#${issueNumber}`,
  });

  // Hover over the issue to reveal import button
  await issueItem.hover();
  await page.waitForTimeout(200);

  // Click the import button
  const importButton = issueItem.locator('[data-testid="issue-import-button"]');
  await importButton.click();

  // Wait for import to complete
  await page.waitForFunction(
    (issueNum) => {
      const issueItems = document.querySelectorAll(
        '[data-testid="github-issue-item"]'
      );
      for (const item of issueItems) {
        if (item.textContent?.includes(`#${issueNum}`)) {
          return item.getAttribute("data-imported") === "true";
        }
      }
      return false;
    },
    issueNumber,
    { timeout: 10000 }
  );
}

/**
 * Verify a task exists in Local Tasks with expected properties
 */
export async function verifyTaskInLocalTasks(
  page: Page,
  expectedTask: {
    title: string;
    area?: string;
    project?: string;
    source?: string;
  }
): Promise<void> {
  // Switch to Local Tasks service
  const localTasksTab = page.locator('[data-testid="service-local"]');
  await localTasksTab.click();
  await page.waitForTimeout(1000);

  // Find the task by title
  const taskItem = page.locator('[data-testid="local-task-item"]').filter({
    hasText: expectedTask.title,
  });

  await taskItem.waitFor({ state: "visible", timeout: 10000 });

  // Verify task properties by checking the task content
  const taskContent = await taskItem.textContent();

  if (expectedTask.area) {
    expect(taskContent).toContain(expectedTask.area);
  }

  if (expectedTask.project) {
    expect(taskContent).toContain(expectedTask.project);
  }

  if (expectedTask.source) {
    // Check for GitHub source indicator (URL or icon)
    const hasGitHubSource =
      (await taskItem
        .locator('[data-testid="task-source-github"]')
        .isVisible()) || taskContent?.includes("github.com");
    expect(hasGitHubSource).toBe(true);
  }
}

/**
 * Stub GitHub API with fixture files
 */
export async function stubGitHubAPI(
  page: Page,
  fixtures: Record<string, string>
): Promise<void> {
  await stubGitHubAPIs(page, fixtures);
}

/**
 * Create test fixtures for GitHub issues
 */
export async function createGitHubIssueFixture(
  page: Page,
  repository: string,
  issues: Array<{
    id: number;
    number: number;
    title: string;
    body?: string;
    state?: "open" | "closed";
    labels?: Array<{ name: string; color?: string }>;
  }>
): Promise<void> {
  // Store fixture data in page context for API stubbing
  await page.evaluate(
    ({ repo, issueData }) => {
      (window as any).__githubFixtures = (window as any).__githubFixtures || {};
      (window as any).__githubFixtures[`${repo}/issues`] = issueData.map(
        (issue) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body || "",
          labels: issue.labels || [],
          assignee: null,
          assignees: [],
          state: issue.state || "open",
          html_url: `https://github.com/${repo}/issues/${issue.number}`,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          closed_at: issue.state === "closed" ? "2024-01-02T00:00:00Z" : null,
          user: {
            login: "testuser",
            id: 5678,
            avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
            html_url: "https://github.com/testuser",
          },
        })
      );
    },
    { repo: repository, issueData: issues }
  );
}
