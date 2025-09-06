/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe } from 'vitest';
import { setupE2ETestHooks } from '../helpers/shared-context';
import { createTestFolders } from '../helpers/task-sync-setup';

describe('GitHub Integration', () => {
  const context = setupE2ETestHooks();

  test('should open GitHub Issues view via command', async () => {
    await createTestFolders(context.page);

    // Execute the GitHub Issues command
    const commandExecuted = await context.page.evaluate(async () => {
      const app = (window as any).app;
      try {
        // Find and execute the GitHub Issues command
        const commands = app.commands.commands;
        const githubCommand = Object.values(commands).find((cmd: any) =>
          cmd.id === 'obsidian-task-sync:open-github-issues'
        );

        if (!githubCommand) return false;

        // Execute the command
        await (githubCommand as any).callback();
        return true;
      } catch (error) {
        console.error('Command execution failed:', error);
        return false;
      }
    });

    expect(commandExecuted).toBe(true);

    // Wait for view to open
    await context.page.waitForTimeout(1000);

    // Verify the view is visible in the UI
    const viewVisible = await context.page.evaluate(() => {
      const viewElement = document.querySelector('[data-type="github-issues"]') as HTMLElement;
      return viewElement !== null && viewElement.offsetParent !== null;
    });

    expect(viewVisible).toBe(true);
  });

  test('should show GitHub integration settings in plugin settings', async () => {
    await createTestFolders(context.page);

    // Open plugin settings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const settingTab = app.setting.openTabById('obsidian-task-sync');
      return settingTab !== null;
    });

    // Wait for settings to load
    await context.page.waitForTimeout(1000);

    // Check that GitHub integration section exists by looking for the toggle
    const hasGitHubToggle = await context.page.evaluate(() => {
      const settingsContainer = document.querySelector('.vertical-tab-content');
      if (!settingsContainer) return false;

      // Look for the GitHub integration toggle setting
      const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
      for (const setting of settings) {
        const nameEl = setting.querySelector('.setting-item-name');
        if (nameEl && nameEl.textContent?.includes('Enable GitHub Integration')) {
          return true;
        }
      }
      return false;
    });

    expect(hasGitHubToggle).toBe(true);
  });

  test('should enable GitHub integration via settings toggle', async () => {
    await createTestFolders(context.page);

    // Open plugin settings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.openTabById('obsidian-task-sync');
    });

    await context.page.waitForTimeout(1000);

    // Find and click the GitHub integration toggle
    const toggleClicked = await context.page.evaluate(() => {
      const settingsContainer = document.querySelector('.vertical-tab-content');
      if (!settingsContainer) return false;

      const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
      for (const setting of settings) {
        const nameEl = setting.querySelector('.setting-item-name');
        if (nameEl && nameEl.textContent?.includes('Enable GitHub Integration')) {
          const toggle = setting.querySelector('.checkbox-container') as HTMLElement;
          if (toggle) {
            toggle.click();
            return true;
          }
        }
      }
      return false;
    });

    expect(toggleClicked).toBe(true);

    // Wait for settings to update
    await context.page.waitForTimeout(500);

    // Verify additional GitHub settings appear
    const additionalSettingsVisible = await context.page.evaluate(() => {
      const settingsContainer = document.querySelector('.vertical-tab-content');
      if (!settingsContainer) return false;

      const text = settingsContainer.textContent || '';
      return text.includes('GitHub Personal Access Token') && text.includes('Default Repository');
    });

    expect(additionalSettingsVisible).toBe(true);
  });

  test('should display GitHub Issues view with proper UI structure', async () => {
    await createTestFolders(context.page);

    // Enable GitHub integration first
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken = 'test-token';
        plugin.settings.githubIntegration.defaultRepository = 'octocat/Hello-World';
        await plugin.saveSettings();
      }
    });

    // Open GitHub Issues view via command
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      const githubCommand = Object.values(commands).find((cmd: any) =>
        cmd.id === 'obsidian-task-sync:open-github-issues'
      );
      if (githubCommand) {
        await (githubCommand as any).callback();
      }
    });

    // Wait for view to load
    await context.page.waitForTimeout(2000);

    // Check for main UI components
    const uiStructure = await context.page.evaluate(() => {
      const viewElement = document.querySelector('[data-type="github-issues"]');
      if (!viewElement) return { exists: false };

      return {
        exists: true,
        hasHeader: viewElement.querySelector('.github-issues-header') !== null,
        hasContent: viewElement.querySelector('.github-issues-content') !== null,
        isVisible: (viewElement as HTMLElement).offsetParent !== null,
        hasText: viewElement.textContent !== null && viewElement.textContent.length > 0
      };
    });

    expect(uiStructure.exists).toBe(true);
    expect(uiStructure.hasHeader).toBe(true);
    expect(uiStructure.hasContent).toBe(true);
    expect(uiStructure.isVisible).toBe(true);
    expect(uiStructure.hasText).toBe(true);
  });

  test('should show disabled state when GitHub integration is not configured', async () => {
    await createTestFolders(context.page);

    // Ensure GitHub integration is disabled
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.githubIntegration.enabled = false;
        plugin.settings.githubIntegration.personalAccessToken = '';
        await plugin.saveSettings();
      }
    });

    // Open GitHub Issues view
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      const githubCommand = Object.values(commands).find((cmd: any) =>
        cmd.id === 'obsidian-task-sync:open-github-issues'
      );
      if (githubCommand) {
        await (githubCommand as any).callback();
      }
    });

    await context.page.waitForTimeout(1000);

    // Check that disabled message is shown
    const disabledMessage = await context.page.evaluate(() => {
      const viewElement = document.querySelector('[data-type="github-issues"]');
      if (!viewElement) return null;

      const text = viewElement.textContent || '';
      return text.includes('GitHub integration is not enabled') ||
        text.includes('Please configure it in settings');
    });

    expect(disabledMessage).toBe(true);
  });

  test('should configure GitHub token via settings input', async () => {
    await createTestFolders(context.page);

    // Open plugin settings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.openTabById('obsidian-task-sync');
    });

    await context.page.waitForTimeout(1000);

    // Enable GitHub integration first
    await context.page.evaluate(() => {
      const settingsContainer = document.querySelector('.vertical-tab-content');
      if (!settingsContainer) return false;

      const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
      for (const setting of settings) {
        const nameEl = setting.querySelector('.setting-item-name');
        if (nameEl && nameEl.textContent?.includes('Enable GitHub Integration')) {
          const toggle = setting.querySelector('.checkbox-container') as HTMLElement;
          if (toggle) {
            toggle.click();
            return true;
          }
        }
      }
      return false;
    });

    await context.page.waitForTimeout(500);

    // Find and fill the GitHub token input
    const tokenConfigured = await context.page.evaluate(() => {
      const settingsContainer = document.querySelector('.vertical-tab-content');
      if (!settingsContainer) return false;

      const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
      for (const setting of settings) {
        const nameEl = setting.querySelector('.setting-item-name');
        if (nameEl && nameEl.textContent?.includes('GitHub Personal Access Token')) {
          const input = setting.querySelector('input[type="password"]') as HTMLInputElement;
          if (input) {
            input.value = 'test-token-123';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }
      }
      return false;
    });

    expect(tokenConfigured).toBe(true);
  });

  test('should show error message when GitHub API fails', async () => {
    await createTestFolders(context.page);

    // Configure GitHub integration with invalid token
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken = 'invalid-token';
        plugin.settings.githubIntegration.defaultRepository = 'octocat/Hello-World';
        await plugin.saveSettings();
      }
    });

    // Open GitHub Issues view
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      const githubCommand = Object.values(commands).find((cmd: any) =>
        cmd.id === 'obsidian-task-sync:open-github-issues'
      );
      if (githubCommand) {
        await (githubCommand as any).callback();
      }
    });

    // Wait for API call to fail
    await context.page.waitForTimeout(3000);

    // Check that error message is displayed
    const errorDisplayed = await context.page.evaluate(() => {
      const viewElement = document.querySelector('[data-type="github-issues"]');
      if (!viewElement) return false;

      const text = viewElement.textContent || '';
      return text.includes('Bad credentials') ||
        text.includes('Failed to load') ||
        text.includes('error') ||
        text.includes('Error');
    });

    expect(errorDisplayed).toBe(true);
  });
});
