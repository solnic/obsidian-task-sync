import type { Page } from 'playwright';
import { type SharedTestContext } from './shared-context';
import { openTaskSyncSettings } from './task-sync-setup';

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
  const notices = page.locator('.notice-container .notice');
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
 * Open GitHub Issues view through UI interactions (like a real user)
 */
export async function openGitHubIssuesView(page: Page): Promise<void> {
  await dismissNotices(page);

  // First ensure the view exists (but not active)
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];

    if (plugin) {
      // Check if view already exists
      const existingLeaves = app.workspace.getLeavesOfType('github-issues');
      if (existingLeaves.length === 0) {
        // Create the view in the right sidebar (but don't force it active)
        const rightLeaf = app.workspace.getRightLeaf(false);
        await rightLeaf.setViewState({
          type: 'github-issues',
          active: false
        });
      }
    }
  });

  // Wait for the view to be created
  await new Promise(resolve => setTimeout(resolve, 500));

  // Now open the right sidebar and activate the GitHub Issues tab through UI
  const rightSidebarToggle = page.locator('.workspace-ribbon.mod-right .side-dock-ribbon-action').first();
  if (await rightSidebarToggle.isVisible()) {
    await rightSidebarToggle.click();
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Look for the GitHub Issues tab and click it
  const githubTab = page.locator('.workspace-tab-header').filter({ hasText: 'Task Sync' });

  if (await githubTab.isVisible()) {
    await githubTab.click();
    await new Promise(resolve => setTimeout(resolve, 500));
  } else {

    // Alternative: use command palette to open the view
    await page.keyboard.press('Control+p');
    await page.fill('.prompt-input', 'GitHub Issues');
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

}

/**
 * Wait for GitHub Issues view to appear and be ready
 */
export async function waitForGitHubView(page: Page, timeout: number = 10000): Promise<void> {

  // First, ensure the plugin has initialized the view
  await page.waitForFunction(() => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];
    return plugin !== undefined;
  }, { timeout: 5000 });

  // Force view creation if it doesn't exist
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];

    if (plugin) {
      // Check if view already exists
      const existingLeaves = app.workspace.getLeavesOfType('github-issues');
      if (existingLeaves.length === 0) {
        // Create the view in the right sidebar (but don't force it active)
        const rightLeaf = app.workspace.getRightLeaf(false);
        await rightLeaf.setViewState({
          type: 'github-issues',
          active: false
        });
      }
    }
  });

  // Wait for the view element to appear in DOM
  await page.waitForFunction(() => {
    // Check for data-type attribute (primary)
    let viewElement = document.querySelector('[data-type="github-issues"]');
    if (viewElement) {
      return true;
    }

    // Fallback: check for class-based selector
    viewElement = document.querySelector('.github-issues-view');
    if (viewElement) {
      return true;
    }

    // Fallback: check for view in workspace leaves
    const workspace = (window as any).app?.workspace;
    if (workspace) {
      const leaves = workspace.getLeavesOfType('github-issues');
      if (leaves && leaves.length > 0) {
        return true;
      }
    }

    return false;
  }, { timeout });


  // Then wait for it to be visible (may take additional time for Obsidian to render)
  await page.waitForFunction(() => {
    let viewElement = document.querySelector('[data-type="github-issues"]') ||
      document.querySelector('.github-issues-view');

    if (!viewElement) {
      return false;
    }

    const isVisible = (viewElement as HTMLElement).offsetParent !== null;
    return isVisible;
  }, { timeout: 5000 });

}

/**
 * Wait for GitHub view content to load
 */
export async function waitForGitHubViewContent(page: Page, timeout: number = 15000): Promise<void> {
  await waitForGitHubView(page, Math.min(timeout / 3, 10000));

  await page.waitForFunction(() => {
    const viewElement = document.querySelector('.github-issues-view');

    if (!viewElement) {
      return false;
    }

    const hasHeader = viewElement.querySelector('.github-issues-header') !== null;
    const hasContent = viewElement.querySelector('.github-issues-content') !== null;
    const hasText = viewElement.textContent !== null && viewElement.textContent.length > 0;

    return hasHeader && hasContent && hasText;
  }, { timeout: Math.max(timeout - 10000, 10000) }).catch(async (error) => {
    throw error;
  });
}

/**
 * Wait for GitHub settings section to be visible
 */
export async function waitForGitHubSettings(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const settingsContainer = document.querySelector('.vertical-tab-content');
    if (!settingsContainer) return false;

    const text = settingsContainer.textContent || '';
    return text.includes('Enable GitHub Integration');
  }, { timeout });
}

/**
 * Open GitHub integration settings
 */
export async function openGitHubSettings(context: SharedTestContext): Promise<void> {
  await openTaskSyncSettings(context);
  await waitForGitHubSettings(context.page);
}

/**
 * Toggle GitHub integration setting
 */
export async function toggleGitHubIntegration(page: Page, enabled: boolean): Promise<void> {
  const toggleClicked = await page.evaluate((shouldEnable) => {
    const settingsContainer = document.querySelector('.vertical-tab-content');
    if (!settingsContainer) return false;

    const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
    for (const setting of settings) {
      const nameEl = setting.querySelector('.setting-item-name');
      if (nameEl && nameEl.textContent?.includes('Enable GitHub Integration')) {
        const toggle = setting.querySelector('.checkbox-container') as HTMLElement;
        const checkbox = setting.querySelector('input[type="checkbox"]') as HTMLInputElement;

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
    throw new Error('Could not find GitHub integration toggle');
  }

  // Wait for additional settings to appear/disappear
  if (enabled) {
    await page.waitForTimeout(1000);
    await waitForGitHubTokenSettings(page, 10000); // Increase timeout to 10 seconds
  }
}

/**
 * Wait for GitHub token settings to appear
 */
export async function waitForGitHubTokenSettings(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const settingsContainer = document.querySelector('.vertical-tab-content');
    if (!settingsContainer) {
      return false;
    }

    const text = settingsContainer.textContent || '';
    const hasToken = text.includes('GitHub Personal Access Token');
    const hasRepo = text.includes('Default Repository');

    return hasToken && hasRepo;
  }, { timeout });
}

/**
 * Configure GitHub personal access token
 */
export async function configureGitHubToken(page: Page, token: string): Promise<void> {
  const settingsDebugInfo = await page.evaluate(() => {
    const settingsContainer = document.querySelector('.vertical-tab-content');
    if (!settingsContainer) {
      return { error: 'No settings container found' };
    }

    const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
    const settingNames = settings.map(setting => {
      const nameEl = setting.querySelector('.setting-item-name');
      return nameEl?.textContent || 'No name';
    });

    return {
      containerExists: true,
      settingsCount: settings.length,
      settingNames,
      containerHTML: settingsContainer.innerHTML.substring(0, 500)
    };
  });

  const tokenConfigured = await page.evaluate((tokenValue) => {
    const settingsContainer = document.querySelector('.vertical-tab-content');
    if (!settingsContainer) return false;

    const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
    for (const setting of settings) {
      const nameEl = setting.querySelector('.setting-item-name');
      if (nameEl && nameEl.textContent?.includes('GitHub Personal Access Token')) {
        const input = setting.querySelector('input[type="password"]') as HTMLInputElement;
        if (input) {
          input.value = tokenValue;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
    }
    return false;
  }, token);

  if (!tokenConfigured) {
    throw new Error('Could not find GitHub token input field');
  }
}

/**
 * Configure GitHub default repository
 */
export async function configureGitHubRepository(page: Page, repository: string): Promise<void> {
  const repoConfigured = await page.evaluate((repoValue) => {
    const settingsContainer = document.querySelector('.vertical-tab-content');
    if (!settingsContainer) return false;

    const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
    for (const setting of settings) {
      const nameEl = setting.querySelector('.setting-item-name');
      if (nameEl && nameEl.textContent?.includes('Default Repository')) {
        const input = setting.querySelector('input[type="text"]') as HTMLInputElement;
        if (input) {
          input.value = repoValue;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
    }
    return false;
  }, repository);

  if (!repoConfigured) {
    throw new Error('Could not find GitHub repository input field');
  }
}

/**
 * Stub GitHub API responses for testing
 * This mocks the external GitHub API calls while keeping all internal plugin logic real
 */
export async function stubGitHubApiResponses(
  page: Page,
  mockData: {
    issues?: any[];
    repositories?: any[];
  }
): Promise<void> {
  await page.evaluate(async (data) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];

    if (!plugin || !plugin.githubService) {
      throw new Error('Task Sync plugin or GitHub service not found');
    }

    // Store original methods
    const originalFetchIssues = plugin.githubService.fetchIssues;
    const originalFetchRepositories = plugin.githubService.fetchRepositories;

    // Stub fetchIssues method
    if (data.issues) {
      plugin.githubService.fetchIssues = async (repository: string) => {
        return data.issues;
      };
    }

    // Stub fetchRepositories method
    if (data.repositories) {
      plugin.githubService.fetchRepositories = async () => {
        return data.repositories;
      };
    }

    // Store original methods for potential restoration
    (plugin.githubService as any)._originalFetchIssues = originalFetchIssues;
    (plugin.githubService as any)._originalFetchRepositories = originalFetchRepositories;
  }, mockData);
}

/**
 * Restore original GitHub API methods (cleanup after stubbing)
 */
export async function restoreGitHubApiMethods(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];

    if (!plugin || !plugin.githubService) {
      return;
    }

    // Restore original methods if they were stored
    if ((plugin.githubService as any)._originalFetchIssues) {
      plugin.githubService.fetchIssues = (plugin.githubService as any)._originalFetchIssues;
      delete (plugin.githubService as any)._originalFetchIssues;
    }

    if ((plugin.githubService as any)._originalFetchRepositories) {
      plugin.githubService.fetchRepositories = (plugin.githubService as any)._originalFetchRepositories;
      delete (plugin.githubService as any)._originalFetchRepositories;
    }
  });
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
  const tokenToUse = config.token || process.env.GITHUB_TOKEN || '';

  await page.evaluate(async (configuration) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];

    if (!plugin) {
      throw new Error('Task Sync plugin not found');
    }

    const oldSettings = { ...plugin.settings.githubIntegration };

    plugin.settings.githubIntegration = {
      ...plugin.settings.githubIntegration,
      enabled: configuration.enabled,
      ...(configuration.token && { personalAccessToken: configuration.token }),
      ...(configuration.repository && { defaultRepository: configuration.repository })
    };

    await plugin.saveSettings();
  }, { ...config, token: tokenToUse });

  // Wait a bit for settings to propagate
  await page.waitForTimeout(1000);

  // Ensure the GitHub view is created/updated after settings change
  await ensureGitHubViewExists(page);
}

/**
 * Ensure GitHub view exists and is properly initialized
 */
export async function ensureGitHubViewExists(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];

    if (!plugin) {
      throw new Error('Task Sync plugin not found');
    }

    // Check if view already exists
    const existingLeaves = app.workspace.getLeavesOfType('github-issues');
    if (existingLeaves.length === 0) {
      const rightLeaf = app.workspace.getRightLeaf(false);
      await rightLeaf.setViewState({
        type: 'github-issues',
        active: false
      });

      // Wait for view to be created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Manually call onOpen if it wasn't called automatically
      const newLeaves = app.workspace.getLeavesOfType('github-issues');
      if (newLeaves.length > 0) {
        const view = newLeaves[0].view;
        if (view && view.onOpen && typeof view.onOpen === 'function') {
          await view.onOpen();
        }
      }
    } else {
      existingLeaves.forEach((leaf: any) => {
        const view = leaf.view;
        if (view && view.updateSettings) {
          view.updateSettings(plugin.settings);
        }

        if (view && view.onOpen && typeof view.onOpen === 'function') {
          view.onOpen().catch((error: any) => {
            console.warn('⚠️ Error calling onOpen():', error);
          });
        }
      });
    }
  });
}

/**
 * Wait for GitHub view to show disabled state
 */
export async function waitForGitHubDisabledState(page: Page, timeout: number = 5000): Promise<void> {
  await waitForGitHubView(page, timeout);
  await page.waitForFunction(() => {
    const viewElement = document.querySelector('[data-type="github-issues"]') ||
      document.querySelector('.github-issues-view');
    if (!viewElement) {
      return false;
    }

    const text = viewElement.textContent || '';
    const hasDisabledText = text.includes('GitHub integration is not enabled') ||
      text.includes('Please configure it in settings');

    return hasDisabledText;
  }, { timeout });
}

/**
 * Wait for GitHub view to show error state
 */
export async function waitForGitHubErrorState(page: Page, timeout: number = 10000): Promise<void> {
  await page.waitForFunction(() => {
    const viewElement = document.querySelector('[data-type="github-issues"]');
    if (!viewElement) return false;

    const text = viewElement.textContent || '';
    return text.includes('Bad credentials') ||
      text.includes('Failed to load') ||
      text.includes('error') ||
      text.includes('Error');
  }, { timeout });
}

/**
 * Check if GitHub integration toggle exists in settings
 */
export async function hasGitHubToggle(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const settingsContainer = document.querySelector('.vertical-tab-content');
    if (!settingsContainer) return false;

    const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
    for (const setting of settings) {
      const nameEl = setting.querySelector('.setting-item-name');
      if (nameEl && nameEl.textContent?.includes('Enable GitHub Integration')) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Debug GitHub view state - logs detailed information about the view
 */
export async function debugGitHubViewState(page: Page): Promise<void> {
  const debugInfo = await page.evaluate(() => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];

    // Check plugin state
    const pluginInfo = {
      pluginExists: !!plugin,
      githubServiceEnabled: plugin?.githubService?.isEnabled?.() || false,
      githubSettings: plugin?.settings?.githubIntegration || null
    };

    // Check workspace leaves
    const leaves = app?.workspace?.getLeavesOfType?.('github-issues') || [];
    const leavesInfo = {
      count: leaves.length,
      leaves: leaves.map((leaf: any) => ({
        viewType: leaf.view?.getViewType?.(),
        isVisible: leaf.view?.containerEl?.offsetParent !== null
      }))
    };

    // Check DOM elements
    const viewByDataType = document.querySelector('[data-type="github-issues"]');
    const viewByClass = document.querySelector('.github-issues-view');
    const domInfo = {
      foundByDataType: !!viewByDataType,
      foundByClass: !!viewByClass,
      element: viewByDataType || viewByClass,
      hasHeader: !!(viewByDataType || viewByClass)?.querySelector('.github-issues-header'),
      hasContent: !!(viewByDataType || viewByClass)?.querySelector('.github-issues-content'),
      textContent: (viewByDataType || viewByClass)?.textContent?.substring(0, 200) || null
    };

    return { pluginInfo, leavesInfo, domInfo };
  });
}

/**
 * Click import button for a specific GitHub issue in the UI
 */
export async function clickIssueImportButton(page: Page, issueNumber: number): Promise<void> {
  await page.waitForFunction((targetIssueNumber) => {
    const issueItems = document.querySelectorAll('.issue-item');
    for (let i = 0; i < issueItems.length; i++) {
      const item = issueItems[i];
      const issueText = item.textContent || '';
      if (issueText.includes(`#${targetIssueNumber}`)) {
        const importButton = item.querySelector('[data-test="issue-import-button"]');
        return importButton !== null;
      }
    }
    return false;
  }, issueNumber, { timeout: 10000 });

  // Click the import button
  const clicked = await page.evaluate((targetIssueNumber) => {
    const issueItems = document.querySelectorAll('.issue-item');
    for (let i = 0; i < issueItems.length; i++) {
      const item = issueItems[i];
      const issueText = item.textContent || '';
      if (issueText.includes(`#${targetIssueNumber}`)) {
        const importButton = item.querySelector('[data-test="issue-import-button"]') as HTMLButtonElement;
        if (importButton) {
          importButton.click();
          return true;
        }
      }
    }
    return false;
  }, issueNumber);

  if (!clicked) {
    throw new Error(`Could not find or click import button for issue #${issueNumber}`);
  }
}

/**
 * Wait for issue import to complete (button changes to "Imported" state)
 */
export async function waitForIssueImportComplete(page: Page, issueNumber: number, timeout: number = 10000): Promise<void> {
  await page.waitForFunction((targetIssueNumber) => {
    const issueItems = document.querySelectorAll('.issue-item');
    for (let i = 0; i < issueItems.length; i++) {
      const item = issueItems[i];
      const issueText = item.textContent || '';
      if (issueText.includes(`#${targetIssueNumber}`)) {
        const importedIndicator = item.querySelector('.import-status.imported');
        return importedIndicator !== null;
      }
    }
    return false;
  }, issueNumber, { timeout });
}

/**
 * Get GitHub view UI structure information
 */
export async function getGitHubViewStructure(page: Page): Promise<{
  exists: boolean;
  hasHeader: boolean;
  hasContent: boolean;
  isVisible: boolean;
  hasText: boolean;
}> {
  await debugGitHubViewState(page);

  const result = await page.evaluate(() => {
    // Look for the actual view content container, not the tab element
    // The view content is inside the workspace leaf content area
    let viewElement = document.querySelector('.github-issues-view');

    if (!viewElement) {
      // Fallback: look for the view content inside any workspace leaf
      const leaves = document.querySelectorAll('.workspace-leaf-content');
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i];
        const githubView = leaf.querySelector('.github-issues-view');
        if (githubView) {
          viewElement = githubView;
          break;
        }
      }
    }

    if (!viewElement) {
      return { exists: false, hasHeader: false, hasContent: false, isVisible: false, hasText: false };
    }

    return {
      exists: true,
      hasHeader: viewElement.querySelector('.github-issues-header') !== null,
      hasContent: viewElement.querySelector('.github-issues-content') !== null,
      isVisible: (viewElement as HTMLElement).offsetParent !== null,
      hasText: viewElement.textContent !== null && viewElement.textContent.length > 0
    };
  });

  return result;
}
