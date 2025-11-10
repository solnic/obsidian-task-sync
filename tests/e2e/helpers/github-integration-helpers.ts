import type { Page } from "playwright";
import { stubGitHubAPIs } from "./api-stubbing";

/**
 * GitHub Integration helpers for e2e tests
 * Provides reusable functions for GitHub integration testing
 */

/**
 * Dismiss any visible notices that might block UI interactions
 */
export async function dismissNotices(page: Page): Promise<void> {
  // Wait a bit for notices to appear
  await page.waitForTimeout(100);

  // Click on any visible notices to dismiss them
  const notices = page.locator(".notice-container .notice");
  const noticeCount = await notices.count();

  if (noticeCount > 0) {
    for (let i = 0; i < noticeCount; i++) {
      try {
        const notice = notices.nth(i);
        if (await notice.isVisible()) {
          await notice.click();
          await page.waitForTimeout(100);
        }
      } catch (error) {
        // Ignore errors when dismissing notices
      }
    }
  }

  // Wait for notices to disappear
  await page.waitForTimeout(300);
}

/**
 * Open Tasks view through UI interactions (like a real user)
 */
export async function openGitHubIssuesView(page: Page): Promise<void> {
  await dismissNotices(page);

  // First ensure the view exists (but not active)
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

    if (plugin) {
      // Check if view already exists
      const existingLeaves = app.workspace.getLeavesOfType("tasks");
      if (existingLeaves.length === 0) {
        // Create the view in the right sidebar (but don't force it active)
        const rightLeaf = app.workspace.getRightLeaf(false);
        await rightLeaf.setViewState({
          type: "tasks",
          active: false,
        });
      }
    }
  });

  // Wait for the view to be created
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Now open the right sidebar and activate the Tasks tab through UI
  const rightSidebarToggle = page
    .locator(".workspace-ribbon.mod-right .side-dock-ribbon-action")
    .first();
  if (await rightSidebarToggle.isVisible()) {
    await rightSidebarToggle.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Look for the Tasks tab and click it - use first() to handle multiple tabs
  const tasksTab = page
    .locator(".workspace-tab-header")
    .filter({ hasText: "Tasks" })
    .first();

  if (await tasksTab.isVisible()) {
    await tasksTab.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  } else {
    // Alternative: use command palette to open the view
    await page.keyboard.press("Control+p");
    await page.fill(".prompt-input", "Tasks");
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Switch to GitHub service tab
  const githubServiceTab = page.locator('[data-testid="service-github"]');
  if (await githubServiceTab.isVisible()) {
    await githubServiceTab.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Wait for Tasks view to appear and be ready
 */
export async function waitForGitHubView(
  page: Page,
  timeout: number = 10000
): Promise<void> {
  // First, ensure the plugin has initialized the view
  await page.waitForFunction(
    () => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];
      return plugin !== undefined;
    },
    { timeout: 5000 }
  );

  // Force view creation if it doesn't exist
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

    if (plugin) {
      // Check if view already exists
      const existingLeaves = app.workspace.getLeavesOfType("tasks");
      if (existingLeaves.length === 0) {
        // Create the view in the right sidebar (but don't force it active)
        const rightLeaf = app.workspace.getRightLeaf(false);
        await rightLeaf.setViewState({
          type: "tasks",
          active: false,
        });
      }
    }
  });

  // Wait for the view element to appear in DOM
  await page.waitForFunction(
    () => {
      // Check for data-testid attribute (primary)
      let viewElement = document.querySelector('[data-testid="tasks-view"]');
      if (viewElement) {
        return true;
      }

      // Fallback: check for data-type attribute
      viewElement = document.querySelector('[data-type="tasks"]');
      if (viewElement) {
        return true;
      }

      // Fallback: check for view in workspace leaves
      const workspace = (window as any).app?.workspace;
      if (workspace) {
        const leaves = workspace.getLeavesOfType("tasks");
        if (leaves && leaves.length > 0) {
          return true;
        }
      }

      return false;
    },
    { timeout }
  );

  // Then wait for it to be visible (may take additional time for Obsidian to render)
  await page.waitForFunction(
    () => {
      let viewElement =
        document.querySelector('[data-type="tasks"]') ||
        document.querySelector(".tasks-view");

      if (!viewElement) {
        return false;
      }

      const isVisible = (viewElement as HTMLElement).offsetParent !== null;
      return isVisible;
    },
    { timeout: 5000 }
  );
}

/**
 * Wait for GitHub view content to load
 */
export async function waitForGitHubViewContent(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await waitForGitHubView(page, Math.min(timeout / 3, 10000));

  await page
    .waitForFunction(
      () => {
        const viewElement = document.querySelector(
          "[data-testid='github-service']"
        );

        if (!viewElement) {
          return false;
        }

        const hasHeader =
          viewElement.querySelector(".github-issues-header") !== null;
        const hasContent =
          viewElement.querySelector(".github-issues-content") !== null;
        const hasText =
          viewElement.textContent !== null &&
          viewElement.textContent.length > 0;

        return hasHeader && hasContent && hasText;
      },
      { timeout: Math.max(timeout - 10000, 10000) }
    )
    .catch(async (error) => {
      throw error;
    });
}

/**
 * Wait for GitHub settings section to be visible
 */
export async function waitForGitHubSettings(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    () => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (!settingsContainer) return false;

      const text = settingsContainer.textContent || "";
      return text.includes("Enable GitHub Integration");
    },
    { timeout }
  );
}

/**
 * Toggle GitHub integration setting
 */
export async function toggleGitHubIntegration(
  page: Page,
  enabled: boolean
): Promise<void> {
  const toggleClicked = await page.evaluate((shouldEnable) => {
    const settingsContainer = document.querySelector(".vertical-tab-content");
    if (!settingsContainer) return false;

    const settings = Array.from(
      settingsContainer.querySelectorAll(".setting-item")
    );
    for (const setting of settings) {
      const nameEl = setting.querySelector(".setting-item-name");
      if (nameEl && nameEl.textContent?.includes("Enable GitHub Integration")) {
        const toggle = setting.querySelector(
          ".checkbox-container"
        ) as HTMLElement;
        const checkbox = setting.querySelector(
          'input[type="checkbox"]'
        ) as HTMLInputElement;

        if (toggle && checkbox) {
          const isCurrentlyEnabled = checkbox.checked;
          if (isCurrentlyEnabled !== shouldEnable) {
            toggle.click();
          } else {
          }
          return true;
        }
      }
    }
    return false;
  }, enabled);

  if (!toggleClicked) {
    throw new Error("Could not find GitHub integration toggle");
  }

  // Wait for additional settings to appear/disappear
  if (enabled) {
    await waitForGitHubTokenSettings(page, 10000); // Increase timeout to 10 seconds
  }
}

/**
 * Wait for GitHub token settings to appear
 */
export async function waitForGitHubTokenSettings(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    () => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (!settingsContainer) {
        return false;
      }

      const text = settingsContainer.textContent || "";
      const hasToken = text.includes("GitHub Personal Access Token");
      const hasRepo = text.includes("Default Repository");

      return hasToken && hasRepo;
    },
    { timeout }
  );
}

/**
 * Configure GitHub personal access token
 */
export async function configureGitHubToken(
  page: Page,
  token: string
): Promise<void> {
  const settingsDebugInfo = await page.evaluate(() => {
    const settingsContainer = document.querySelector(".vertical-tab-content");
    if (!settingsContainer) {
      return { error: "No settings container found" };
    }

    const settings = Array.from(
      settingsContainer.querySelectorAll(".setting-item")
    );
    const settingNames = settings.map((setting) => {
      const nameEl = setting.querySelector(".setting-item-name");
      return nameEl?.textContent || "No name";
    });

    return {
      containerExists: true,
      settingsCount: settings.length,
      settingNames,
      containerHTML: settingsContainer.innerHTML.substring(0, 500),
    };
  });

  const tokenConfigured = await page.evaluate((tokenValue) => {
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
        if (input) {
          input.value = tokenValue;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
      }
    }
    return false;
  }, token);

  if (!tokenConfigured) {
    throw new Error("Could not find GitHub token input field");
  }
}

/**
 * Configure GitHub default repository
 */
export async function configureGitHubRepository(
  page: Page,
  repository: string
): Promise<void> {
  const repoConfigured = await page.evaluate((repoValue) => {
    const settingsContainer = document.querySelector(".vertical-tab-content");
    if (!settingsContainer) return false;

    const settings = Array.from(
      settingsContainer.querySelectorAll(".setting-item")
    );
    for (const setting of settings) {
      const nameEl = setting.querySelector(".setting-item-name");
      if (nameEl && nameEl.textContent?.includes("Default Repository")) {
        const input = setting.querySelector(
          'input[type="text"]'
        ) as HTMLInputElement;
        if (input) {
          input.value = repoValue;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
      }
    }
    return false;
  }, repository);

  if (!repoConfigured) {
    throw new Error("Could not find GitHub repository input field");
  }
}

/**
 * Stub GitHub API using fixture files
 * Now uses simplified stubbing that persists across plugin reloads
 *
 * @example
 * await stubGitHubWithFixtures(page, {
 *   issues: "issues-basic",
 *   repositories: "repositories-basic"
 * });
 */
export async function stubGitHubWithFixtures(
  page: Page,
  fixtures: {
    issues?: string;
    pullRequests?: string;
    repositories?: string;
    organizations?: string;
    currentUser?: string;
    labels?: string;
  }
): Promise<void> {
  // Use the simplified stubbing system that handles plugin reloads
  await stubGitHubAPIs(page, fixtures);
}

/**
 * Configure GitHub integration programmatically
 * Automatically uses GITHUB_TOKEN from environment if no token is provided
 */
export async function configureGitHubIntegration(
  page: Page,
  config: {
    enabled: boolean;
    token?: string;
    repository?: string;
  }
): Promise<void> {
  // Use environment token as fallback if no token provided
  const tokenToUse = config.token || process.env.GITHUB_TOKEN || "";

  await page.evaluate(
    async (configuration) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      const oldSettings = { ...plugin.settings.integrations.github };

      plugin.settings.integrations.github = {
        ...plugin.settings.integrations.github,
        enabled: configuration.enabled,
        ...(configuration.token && {
          personalAccessToken: configuration.token,
        }),
        ...(configuration.repository && {
          defaultRepository: configuration.repository,
        }),
      };

      await plugin.saveSettings();
    },
    { ...config, token: tokenToUse }
  );

  // Wait for IntegrationManager to create the GitHub service
  await page.waitForFunction(
    () => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];
      return plugin?.integrationManager?.getGitHubService() !== null;
    },
    { timeout: 5000 }
  );

  // Ensure the GitHub view is created/updated after settings change
  await ensureGitHubViewExists(page);
}

/**
 * Ensure GitHub view exists and is properly initialized
 */
export async function ensureGitHubViewExists(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

    if (!plugin) {
      throw new Error("Task Sync plugin not found");
    }

    // Check if view already exists
    const existingLeaves = app.workspace.getLeavesOfType("tasks");
    if (existingLeaves.length === 0) {
      const rightLeaf = app.workspace.getRightLeaf(false);
      await rightLeaf.setViewState({
        type: "tasks",
        active: false,
      });

      // Wait for view to be created
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Manually call onOpen if it wasn't called automatically
      const newLeaves = app.workspace.getLeavesOfType("tasks");
      if (newLeaves.length > 0) {
        const view = newLeaves[0].view;
        if (view && view.onOpen && typeof view.onOpen === "function") {
          await view.onOpen();
        }
      }
    } else {
      existingLeaves.forEach((leaf: any) => {
        const view = leaf.view;
        if (view && view.updateSettings) {
          view.updateSettings(plugin.settings);
        }

        if (view && view.onOpen && typeof view.onOpen === "function") {
          view.onOpen().catch((error: any) => {
            console.warn("⚠️ Error calling onOpen():", error);
          });
        }
      });
    }
  });
}

/**
 * Wait for GitHub view to show disabled state
 */
export async function waitForGitHubDisabledState(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await waitForGitHubView(page, timeout);
  await page.waitForFunction(
    () => {
      const viewElement =
        document.querySelector('[data-testid="github-service"]') ||
        document.querySelector('[data-type="github-service"]');
      if (!viewElement) {
        return false;
      }

      const text = viewElement.textContent || "";
      const hasDisabledText =
        text.includes("GitHub integration is not enabled") ||
        text.includes("Please configure it in settings");

      return hasDisabledText;
    },
    { timeout }
  );
}

/**
 * Wait for GitHub view to show error state
 */
export async function waitForGitHubErrorState(
  page: Page,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    () => {
      const viewElement = document.querySelector(
        '[data-testid="github-service"]'
      );
      if (!viewElement) return false;

      const text = viewElement.textContent || "";
      return (
        text.includes("Bad credentials") ||
        text.includes("Failed to load") ||
        text.includes("error") ||
        text.includes("Error")
      );
    },
    { timeout }
  );
}

/**
 * Check if GitHub integration toggle exists in settings
 */
export async function hasGitHubToggle(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const settingsContainer = document.querySelector(".vertical-tab-content");
    if (!settingsContainer) return false;

    const settings = Array.from(
      settingsContainer.querySelectorAll(".setting-item")
    );
    for (const setting of settings) {
      const nameEl = setting.querySelector(".setting-item-name");
      if (nameEl && nameEl.textContent?.includes("Enable GitHub Integration")) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Wait for GitHub issues list to finish loading/reloading
 * This should be called after switching to GitHub tab or changing filters
 */
export async function waitForGitHubIssuesLoaded(
  page: Page,
  timeout: number = 10000
): Promise<void> {
  // Wait for the issues list to be in a stable state
  // Either we have issues loaded, or we have an empty state, or we're loading
  await page.waitForFunction(
    () => {
      const issues = document.querySelectorAll('[data-testid="github-issue-item"]');
      const emptyState = document.querySelector('[data-testid="github-empty-state"]');
      const loadingIndicator = document.querySelector('[data-testid="github-loading"]');

      // If we're loading, wait for it to finish
      if (loadingIndicator) {
        return false;
      }

      // Otherwise, we should have either issues or empty state
      return issues.length > 0 || emptyState !== null;
    },
    undefined,
    { timeout }
  );

  // Wait for hover states to be ready by checking that issue items are fully interactive
  await page.waitForFunction(
    () => {
      const issues = document.querySelectorAll('[data-testid="github-issue-item"]');
      if (issues.length === 0) return true; // Empty state is fine

      // Check that at least one issue is fully rendered and interactive
      const firstIssue = issues[0] as HTMLElement;
      return firstIssue && firstIssue.offsetHeight > 0 && firstIssue.offsetWidth > 0;
    },
    undefined,
    { timeout: 5000 }
  );
}

/**
 * Click import button for a specific GitHub issue in the UI
 * Note: Import buttons now appear on hover, so we need to hover first
 */
export async function clickIssueImportButton(
  page: Page,
  issueNumber: number
): Promise<void> {
  // Wait for issues to finish loading first
  await waitForGitHubIssuesLoaded(page);

  // Find the issue item and hover over it
  const issueLocator = page
    .locator('[data-testid="github-issue-item"]')
    .filter({
      hasText: `#${issueNumber}`,
    });

  // Wait for the issue to be visible
  await issueLocator.waitFor({ state: "visible", timeout: 10000 });

  // Ensure the issue is within viewport before hovering
  await issueLocator.scrollIntoViewIfNeeded();

  // Hover over the issue to make the import button appear
  await issueLocator.hover();

  // Wait explicitly for action overlay to appear; retry hover if needed
  const overlay = issueLocator.locator(".task-sync-action-overlay");
  try {
    await overlay.waitFor({ state: "visible", timeout: 2000 });
  } catch (_) {
    // Retry: scroll, hover, and wait for overlay
    await issueLocator.scrollIntoViewIfNeeded();
    await issueLocator.hover();
    await overlay.waitFor({ state: "visible", timeout: 2000 });
  }

  // Wait for any valid import action button to appear and click it.
  // Depending on the planning modes, the button's test id varies.
  const candidateSelectors = [
    '[data-testid="issue-import-button"]',
    '[data-testid="add-to-today-button"]',
    '[data-testid="schedule-for-today-button"]',
  ];

  // Try to find the first visible candidate
  let clicked = false;
  for (const selector of candidateSelectors) {
    const button = issueLocator.locator(selector);
    try {
      // Wait for the button to be attached first, then visible
      await button.waitFor({ state: "attached", timeout: 2000 });
      await button.waitFor({ state: "visible", timeout: 2000 });
      await button.click();
      clicked = true;
      break;
    } catch (_) {
      // Try next selector
    }
  }

  if (!clicked) {
    throw new Error(
      `Import action button not visible for issue #${issueNumber} (tried ${candidateSelectors.join(
        ", "
      )})`
    );
  }
}

/**
 * Wait for issue import to complete (issue gets data-imported="true" attribute)
 */
export async function waitForIssueImportComplete(
  page: Page,
  issueNumber: number,
  timeout: number = 10000
): Promise<void> {
  // Find the issue item and wait for it to have data-imported="true"
  const issueLocator = page
    .locator('[data-testid="github-issue-item"]')
    .filter({
      hasText: `#${issueNumber}`,
    });

  // Wait for the issue to be visible first
  await issueLocator.waitFor({ state: "visible", timeout: 5000 });

  // Wait for the data-imported attribute to be set to "true"
  await issueLocator.waitFor({
    state: "attached",
    timeout,
  });

  await page.waitForFunction(
    (issueNumber) => {
      const issueItems = document.querySelectorAll(
        '[data-testid="github-issue-item"]'
      );
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        if (item.textContent?.includes(`#${issueNumber}`)) {
          return item.getAttribute("data-imported") === "true";
        }
      }
      return false;
    },
    issueNumber,
    { timeout }
  );
}
