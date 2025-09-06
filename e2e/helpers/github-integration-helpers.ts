import type { Page } from 'playwright';
import { executeCommand, type SharedTestContext } from './shared-context';
import { openTaskSyncSettings, closeSettings } from './task-sync-setup';

/**
 * GitHub Integration helpers for e2e tests
 * Provides reusable functions for GitHub integration testing
 */

/**
 * Execute a GitHub-related command
 */
export async function executeGitHubCommand(context: SharedTestContext, commandId: string): Promise<void> {
  await context.page.evaluate(async (id) => {
    const app = (window as any).app;
    const commands = app.commands.commands;
    const command = Object.values(commands).find((cmd: any) => cmd.id === id);
    
    if (!command) {
      throw new Error(`Command not found: ${id}`);
    }
    
    await (command as any).callback();
  }, commandId);
}

/**
 * Wait for GitHub Issues view to appear and be ready
 */
export async function waitForGitHubView(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const viewElement = document.querySelector('[data-type="github-issues"]');
    return viewElement !== null && (viewElement as HTMLElement).offsetParent !== null;
  }, { timeout });
}

/**
 * Wait for GitHub view content to load
 */
export async function waitForGitHubViewContent(page: Page, timeout: number = 10000): Promise<void> {
  await page.waitForFunction(() => {
    const viewElement = document.querySelector('[data-type="github-issues"]');
    if (!viewElement) return false;
    
    const hasHeader = viewElement.querySelector('.github-issues-header') !== null;
    const hasContent = viewElement.querySelector('.github-issues-content') !== null;
    const hasText = viewElement.textContent !== null && viewElement.textContent.length > 0;
    
    return hasHeader && hasContent && hasText;
  }, { timeout });
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
    await waitForGitHubTokenSettings(page);
  }
}

/**
 * Wait for GitHub token settings to appear
 */
export async function waitForGitHubTokenSettings(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const settingsContainer = document.querySelector('.vertical-tab-content');
    if (!settingsContainer) return false;
    
    const text = settingsContainer.textContent || '';
    return text.includes('GitHub Personal Access Token') && text.includes('Default Repository');
  }, { timeout });
}

/**
 * Configure GitHub personal access token
 */
export async function configureGitHubToken(page: Page, token: string): Promise<void> {
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
 * Configure GitHub integration programmatically
 */
export async function configureGitHubIntegration(
  page: Page, 
  config: {
    enabled: boolean;
    token?: string;
    repository?: string;
  }
): Promise<void> {
  await page.evaluate(async (configuration) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];
    
    if (!plugin) {
      throw new Error('Task Sync plugin not found');
    }

    plugin.settings.githubIntegration = {
      ...plugin.settings.githubIntegration,
      enabled: configuration.enabled,
      ...(configuration.token && { personalAccessToken: configuration.token }),
      ...(configuration.repository && { defaultRepository: configuration.repository })
    };
    
    await plugin.saveSettings();
  }, config);
}

/**
 * Wait for GitHub view to show disabled state
 */
export async function waitForGitHubDisabledState(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForFunction(() => {
    const viewElement = document.querySelector('[data-type="github-issues"]');
    if (!viewElement) return false;

    const text = viewElement.textContent || '';
    return text.includes('GitHub integration is not enabled') ||
           text.includes('Please configure it in settings');
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
 * Get GitHub view UI structure information
 */
export async function getGitHubViewStructure(page: Page): Promise<{
  exists: boolean;
  hasHeader: boolean;
  hasContent: boolean;
  isVisible: boolean;
  hasText: boolean;
}> {
  return await page.evaluate(() => {
    const viewElement = document.querySelector('[data-type="github-issues"]');
    if (!viewElement) return { exists: false, hasHeader: false, hasContent: false, isVisible: false, hasText: false };

    return {
      exists: true,
      hasHeader: viewElement.querySelector('.github-issues-header') !== null,
      hasContent: viewElement.querySelector('.github-issues-content') !== null,
      isVisible: (viewElement as HTMLElement).offsetParent !== null,
      hasText: viewElement.textContent !== null && viewElement.textContent.length > 0
    };
  });
}
