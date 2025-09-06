import type { Page } from 'playwright';
import { type SharedTestContext } from './shared-context';
import { openTaskSyncSettings } from './task-sync-setup';

/**
 * GitHub Integration helpers for e2e tests
 * Provides reusable functions for GitHub integration testing
 */



/**
 * Open GitHub Issues view through UI interactions (like a real user)
 */
export async function openGitHubIssuesView(page: Page): Promise<void> {
  console.log('🔍 Opening GitHub Issues view through UI...');

  // First ensure the view exists (but not active)
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];

    if (plugin) {
      // Check if view already exists
      const existingLeaves = app.workspace.getLeavesOfType('github-issues');
      if (existingLeaves.length === 0) {
        console.log('🔧 Creating GitHub Issues view...');
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
  console.log('🔍 Opening right sidebar...');

  // Click on the right sidebar to open it
  const rightSidebarToggle = page.locator('.workspace-ribbon.mod-right .side-dock-ribbon-action').first();
  if (await rightSidebarToggle.isVisible()) {
    await rightSidebarToggle.click();
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Look for the GitHub Issues tab and click it
  console.log('🔍 Looking for GitHub Issues tab...');
  const githubTab = page.locator('.workspace-tab-header').filter({ hasText: 'Task Sync' });

  if (await githubTab.isVisible()) {
    console.log('🔍 Found GitHub Issues tab, clicking it...');
    await githubTab.click();
    await new Promise(resolve => setTimeout(resolve, 500));
  } else {
    console.log('⚠️ GitHub Issues tab not found, trying alternative approach...');

    // Alternative: use command palette to open the view
    await page.keyboard.press('Control+p');
    await page.fill('.prompt-input', 'GitHub Issues');
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('✅ GitHub Issues view should now be open');
}

/**
 * Wait for GitHub Issues view to appear and be ready
 */
export async function waitForGitHubView(page: Page, timeout: number = 10000): Promise<void> {
  console.log('🔍 Waiting for GitHub view to appear...');

  // First, ensure the plugin has initialized the view
  await page.waitForFunction(() => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];
    return plugin !== undefined;
  }, { timeout: 5000 });

  console.log('✅ Plugin found, checking for GitHub view...');

  // Force view creation if it doesn't exist
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];

    if (plugin) {
      // Check if view already exists
      const existingLeaves = app.workspace.getLeavesOfType('github-issues');
      if (existingLeaves.length === 0) {
        console.log('🔧 Creating GitHub Issues view...');
        // Create the view in the right sidebar (but don't force it active)
        const rightLeaf = app.workspace.getRightLeaf(false);
        await rightLeaf.setViewState({
          type: 'github-issues',
          active: false
        });
      } else {
        console.log('✅ GitHub Issues view already exists');
      }
    }
  });

  // Wait for the view element to appear in DOM
  await page.waitForFunction(() => {
    // Check for data-type attribute (primary)
    let viewElement = document.querySelector('[data-type="github-issues"]');
    if (viewElement) {
      console.log('✅ Found GitHub view by data-type');
      return true;
    }

    // Fallback: check for class-based selector
    viewElement = document.querySelector('.github-issues-view');
    if (viewElement) {
      console.log('✅ Found GitHub view by class');
      return true;
    }

    // Fallback: check for view in workspace leaves
    const workspace = (window as any).app?.workspace;
    if (workspace) {
      const leaves = workspace.getLeavesOfType('github-issues');
      if (leaves && leaves.length > 0) {
        console.log('✅ Found GitHub view in workspace leaves');
        return true;
      }
    }

    console.log('❌ GitHub view not found yet');
    return false;
  }, { timeout });

  console.log('🔍 Waiting for GitHub view to be visible...');

  // Then wait for it to be visible (may take additional time for Obsidian to render)
  await page.waitForFunction(() => {
    let viewElement = document.querySelector('[data-type="github-issues"]') ||
      document.querySelector('.github-issues-view');

    if (!viewElement) {
      console.log('❌ View element not found');
      return false;
    }

    const isVisible = (viewElement as HTMLElement).offsetParent !== null;
    console.log(`🔍 View visibility: ${isVisible}`);
    return isVisible;
  }, { timeout: 5000 });

  console.log('✅ GitHub view is ready and visible');
}

/**
 * Wait for GitHub view content to load
 */
export async function waitForGitHubViewContent(page: Page, timeout: number = 15000): Promise<void> {
  console.log('🔍 Waiting for GitHub view content to load...');

  // First ensure the view exists
  await waitForGitHubView(page, Math.min(timeout / 3, 10000));

  console.log('🔍 Waiting for view content elements...');

  // Take a screenshot before waiting for content
  await page.screenshot({
    path: `e2e/screenshots/github-view-before-wait-${Date.now()}.png`,
    fullPage: true
  });

  // Wait a bit for any async rendering to complete
  await new Promise(resolve => setTimeout(resolve, 200));

  // Take another screenshot after the delay
  await page.screenshot({
    path: `e2e/screenshots/github-view-after-delay-${Date.now()}.png`,
    fullPage: true
  });

  // Then wait for content to load
  await page.waitForFunction(() => {
    // Look for the view content container directly, not the tab element
    const viewElement = document.querySelector('.github-issues-view');
    if (!viewElement) {
      console.log('❌ View element not found');
      return false;
    }

    const hasHeader = viewElement.querySelector('.github-issues-header') !== null;
    const hasContent = viewElement.querySelector('.github-issues-content') !== null;
    const hasText = viewElement.textContent !== null && viewElement.textContent.length > 0;

    console.log(`🔍 Content check - Header: ${hasHeader}, Content: ${hasContent}, Text: ${hasText}`);
    console.log(`🔍 View text content: "${viewElement.textContent?.substring(0, 100)}..."`);

    return hasHeader && hasContent && hasText;
  }, { timeout: Math.max(timeout - 10000, 10000) }).catch(async (error) => {
    // Take a screenshot on failure
    await page.screenshot({
      path: `e2e/screenshots/github-view-timeout-failure-${Date.now()}.png`,
      fullPage: true
    });
    throw error;
  });

  console.log('✅ GitHub view content loaded successfully');
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
  console.log('🔧 Opening GitHub settings...');

  // Take a screenshot before opening settings
  await context.page.screenshot({
    path: `e2e/screenshots/before-open-settings-${Date.now()}.png`,
    fullPage: true
  });

  await openTaskSyncSettings(context);

  // Take a screenshot after opening Task Sync settings
  await context.page.screenshot({
    path: `e2e/screenshots/after-open-task-sync-settings-${Date.now()}.png`,
    fullPage: true
  });

  await waitForGitHubSettings(context.page);

  // Take a screenshot after GitHub settings are visible
  await context.page.screenshot({
    path: `e2e/screenshots/after-github-settings-visible-${Date.now()}.png`,
    fullPage: true
  });

  console.log('✅ GitHub settings opened');
}

/**
 * Toggle GitHub integration setting
 */
export async function toggleGitHubIntegration(page: Page, enabled: boolean): Promise<void> {
  console.log(`🔧 Toggling GitHub integration to: ${enabled}`);

  // Take a screenshot before toggling
  await page.screenshot({
    path: `e2e/screenshots/before-toggle-${enabled ? 'enable' : 'disable'}-${Date.now()}.png`,
    fullPage: true
  });

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
          console.log(`🔍 Current state: ${isCurrentlyEnabled}, Target state: ${shouldEnable}`);
          if (isCurrentlyEnabled !== shouldEnable) {
            toggle.click();
            console.log('🔧 Clicked toggle');
          } else {
            console.log('🔍 Already in desired state');
          }
          return true;
        }
      }
    }
    return false;
  }, enabled);

  if (!toggleClicked) {
    // Take a screenshot on failure
    await page.screenshot({
      path: `e2e/screenshots/toggle-failed-${Date.now()}.png`,
      fullPage: true
    });
    throw new Error('Could not find GitHub integration toggle');
  }

  // Wait for additional settings to appear/disappear
  if (enabled) {
    console.log('🔍 Waiting for GitHub token settings to appear...');

    // Wait a bit for the section to be recreated
    await page.waitForTimeout(1000);

    // Take a screenshot after waiting
    await page.screenshot({
      path: `e2e/screenshots/after-toggle-wait-${Date.now()}.png`,
      fullPage: true
    });

    await waitForGitHubTokenSettings(page, 10000); // Increase timeout to 10 seconds

    // Take a screenshot after settings appear
    await page.screenshot({
      path: `e2e/screenshots/after-toggle-enable-${Date.now()}.png`,
      fullPage: true
    });
  }

  console.log('✅ GitHub integration toggle completed');
}

/**
 * Wait for GitHub token settings to appear
 */
export async function waitForGitHubTokenSettings(page: Page, timeout: number = 5000): Promise<void> {
  console.log(`🔍 Waiting for GitHub token settings to appear (timeout: ${timeout}ms)...`);

  try {
    await page.waitForFunction(() => {
      const settingsContainer = document.querySelector('.vertical-tab-content');
      if (!settingsContainer) {
        console.log('❌ No settings container found');
        return false;
      }

      const text = settingsContainer.textContent || '';
      const hasToken = text.includes('GitHub Personal Access Token');
      const hasRepo = text.includes('Default Repository');

      console.log(`🔍 Settings check - Token: ${hasToken}, Repo: ${hasRepo}`);
      console.log(`🔍 Settings text preview: "${text.substring(0, 200)}..."`);

      return hasToken && hasRepo;
    }, { timeout });

    console.log('✅ GitHub token settings appeared');
  } catch (error) {
    console.error('❌ Timeout waiting for GitHub token settings');

    // Take a screenshot on timeout
    await page.screenshot({
      path: `e2e/screenshots/token-settings-timeout-${Date.now()}.png`,
      fullPage: true
    });

    // Debug what settings are actually present
    const settingsDebug = await page.evaluate(() => {
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
        fullText: settingsContainer.textContent?.substring(0, 1000) || 'No text'
      };
    });

    console.error('❌ Settings debug info:', JSON.stringify(settingsDebug, null, 2));
    throw error;
  }
}

/**
 * Configure GitHub personal access token
 */
export async function configureGitHubToken(page: Page, token: string): Promise<void> {
  console.log('🔧 Configuring GitHub token...');

  // Take a screenshot before attempting to configure token
  await page.screenshot({
    path: `e2e/screenshots/before-token-config-${Date.now()}.png`,
    fullPage: true
  });

  // First, let's debug what settings are actually available
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

  console.log('🔍 Settings debug info:', JSON.stringify(settingsDebugInfo, null, 2));

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
    // Take a screenshot on failure
    await page.screenshot({
      path: `e2e/screenshots/token-config-failed-${Date.now()}.png`,
      fullPage: true
    });

    console.error('❌ Could not find GitHub token input field');
    console.error('❌ Available settings:', settingsDebugInfo);
    throw new Error('Could not find GitHub token input field');
  }

  console.log('✅ GitHub token configured successfully');
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
  console.log(`🔧 Configuring GitHub integration: enabled=${config.enabled}, repository=${config.repository}`);

  // Use environment token as fallback if no token provided
  const tokenToUse = config.token || process.env.GITHUB_TOKEN || '';

  if (!tokenToUse && config.enabled) {
    console.warn('⚠️ No GitHub token provided and GITHUB_TOKEN environment variable not set');
  }

  await page.evaluate(async (configuration) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];

    if (!plugin) {
      throw new Error('Task Sync plugin not found');
    }

    console.log('🔧 Updating plugin settings...');

    const oldSettings = { ...plugin.settings.githubIntegration };

    plugin.settings.githubIntegration = {
      ...plugin.settings.githubIntegration,
      enabled: configuration.enabled,
      ...(configuration.token && { personalAccessToken: configuration.token }),
      ...(configuration.repository && { defaultRepository: configuration.repository })
    };

    console.log('🔧 Old settings:', oldSettings);
    console.log('🔧 New settings:', plugin.settings.githubIntegration);

    await plugin.saveSettings();

    console.log('✅ GitHub integration settings saved');
  }, { ...config, token: tokenToUse });

  // Wait a bit for settings to propagate
  await page.waitForTimeout(1000);

  // Ensure the GitHub view is created/updated after settings change
  await ensureGitHubViewExists(page);

  console.log('✅ GitHub integration configured');
}

/**
 * Ensure GitHub view exists and is properly initialized
 */
export async function ensureGitHubViewExists(page: Page): Promise<void> {
  console.log('🔧 Ensuring GitHub view exists...');

  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];

    if (!plugin) {
      throw new Error('Task Sync plugin not found');
    }

    // Check if view already exists
    const existingLeaves = app.workspace.getLeavesOfType('github-issues');
    if (existingLeaves.length === 0) {
      console.log('🔧 Creating GitHub Issues view...');
      // Create the view in the right sidebar (but don't force it active)
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
          console.log('🔧 Manually calling onOpen() for GitHub view...');
          await view.onOpen();
          console.log('✅ onOpen() called successfully');
        }
      }
    } else {
      console.log('✅ GitHub Issues view already exists');

      // Update existing views with new settings
      existingLeaves.forEach((leaf: any) => {
        const view = leaf.view;
        if (view && view.updateSettings) {
          view.updateSettings(plugin.settings);
        }

        // Also try to call onOpen if it hasn't been called
        if (view && view.onOpen && typeof view.onOpen === 'function') {
          console.log('🔧 Manually calling onOpen() for existing GitHub view...');
          view.onOpen().catch((error: any) => {
            console.warn('⚠️ Error calling onOpen():', error);
          });
        }
      });
    }
  });

  console.log('✅ GitHub view ensured');
}

/**
 * Wait for GitHub view to show disabled state
 */
export async function waitForGitHubDisabledState(page: Page, timeout: number = 5000): Promise<void> {
  console.log('🔍 Waiting for GitHub view disabled state...');

  // First ensure the view exists
  await waitForGitHubView(page, timeout);

  console.log('🔍 Checking for disabled state content...');

  // Then wait for disabled state content
  await page.waitForFunction(() => {
    const viewElement = document.querySelector('[data-type="github-issues"]') ||
      document.querySelector('.github-issues-view');
    if (!viewElement) {
      console.log('❌ View element not found for disabled state check');
      return false;
    }

    const text = viewElement.textContent || '';
    const hasDisabledText = text.includes('GitHub integration is not enabled') ||
      text.includes('Please configure it in settings');

    console.log(`🔍 Disabled state check - Text: "${text.substring(0, 100)}...", Has disabled text: ${hasDisabledText}`);

    return hasDisabledText;
  }, { timeout });

  console.log('✅ GitHub view showing disabled state');
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

  console.log('🔍 GitHub View Debug Info:');
  console.log('Plugin:', JSON.stringify(debugInfo.pluginInfo, null, 2));
  console.log('Leaves:', JSON.stringify(debugInfo.leavesInfo, null, 2));
  console.log('DOM:', JSON.stringify(debugInfo.domInfo, null, 2));
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
  console.log('🔍 Getting GitHub view structure...');

  // First debug the current state
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

  console.log('🔍 View structure result:', JSON.stringify(result, null, 2));
  return result;
}
