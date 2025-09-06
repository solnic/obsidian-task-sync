/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe } from 'vitest';
import { setupE2ETestHooks } from '../helpers/shared-context';
import { createTestFolders } from '../helpers/task-sync-setup';
import {
  executeGitHubCommand,
  waitForGitHubView,
  waitForGitHubViewContent,
  openGitHubSettings,
  toggleGitHubIntegration,
  configureGitHubToken,
  configureGitHubIntegration,
  waitForGitHubDisabledState,
  waitForGitHubErrorState,
  hasGitHubToggle,
  getGitHubViewStructure
} from '../helpers/github-integration-helpers';

describe('GitHub Integration', () => {
  const context = setupE2ETestHooks();

  test('should open GitHub Issues view via command', async () => {
    await createTestFolders(context.page);

    // Execute the GitHub Issues command using helper
    await executeGitHubCommand(context, 'obsidian-task-sync:open-github-issues');

    // Wait for view to open using smart waiting
    await waitForGitHubView(context.page);

    // Verify the view is visible in the UI
    const viewVisible = await context.page.evaluate(() => {
      const viewElement = document.querySelector('[data-type="github-issues"]') as HTMLElement;
      return viewElement !== null && viewElement.offsetParent !== null;
    });

    expect(viewVisible).toBe(true);
  });

  test('should show GitHub integration settings in plugin settings', async () => {
    await createTestFolders(context.page);

    // Open GitHub settings using helper
    await openGitHubSettings(context);

    // Check that GitHub integration section exists by looking for the toggle
    const toggleExists = await hasGitHubToggle(context.page);
    expect(toggleExists).toBe(true);
  });

  test('should enable GitHub integration via settings toggle', async () => {
    await createTestFolders(context.page);

    // Open GitHub settings using helper
    await openGitHubSettings(context);

    // Enable GitHub integration using helper
    await toggleGitHubIntegration(context.page, true);

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

    // Enable GitHub integration using helper
    await configureGitHubIntegration(context.page, {
      enabled: true,
      token: 'test-token',
      repository: 'octocat/Hello-World'
    });

    // Open GitHub Issues view using helper
    await executeGitHubCommand(context, 'obsidian-task-sync:open-github-issues');

    // Wait for view content to load using smart waiting
    await waitForGitHubViewContent(context.page);

    // Check for main UI components using helper
    const uiStructure = await getGitHubViewStructure(context.page);

    expect(uiStructure.exists).toBe(true);
    expect(uiStructure.hasHeader).toBe(true);
    expect(uiStructure.hasContent).toBe(true);
    expect(uiStructure.isVisible).toBe(true);
    expect(uiStructure.hasText).toBe(true);
  });

  test('should show disabled state when GitHub integration is not configured', async () => {
    await createTestFolders(context.page);

    // Ensure GitHub integration is disabled using helper
    await configureGitHubIntegration(context.page, {
      enabled: false,
      token: ''
    });

    // Open GitHub Issues view using helper
    await executeGitHubCommand(context, 'obsidian-task-sync:open-github-issues');

    // Wait for disabled state using smart waiting
    await waitForGitHubDisabledState(context.page);

    // Verify disabled message is shown
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

    // Open GitHub settings using helper
    await openGitHubSettings(context);

    // Enable GitHub integration using helper
    await toggleGitHubIntegration(context.page, true);

    // Configure GitHub token using helper
    await configureGitHubToken(context.page, 'test-token-123');

    // Verify token was configured by checking the input value
    const tokenConfigured = await context.page.evaluate(() => {
      const settingsContainer = document.querySelector('.vertical-tab-content');
      if (!settingsContainer) return false;

      const settings = Array.from(settingsContainer.querySelectorAll('.setting-item'));
      for (const setting of settings) {
        const nameEl = setting.querySelector('.setting-item-name');
        if (nameEl && nameEl.textContent?.includes('GitHub Personal Access Token')) {
          const input = setting.querySelector('input[type="password"]') as HTMLInputElement;
          return input && input.value === 'test-token-123';
        }
      }
      return false;
    });

    expect(tokenConfigured).toBe(true);
  });

  test('should show error message when GitHub API fails', async () => {
    await createTestFolders(context.page);

    // Configure GitHub integration with invalid token using helper
    await configureGitHubIntegration(context.page, {
      enabled: true,
      token: 'invalid-token',
      repository: 'octocat/Hello-World'
    });

    // Open GitHub Issues view using helper
    await executeGitHubCommand(context, 'obsidian-task-sync:open-github-issues');

    // Wait for error state using smart waiting
    await waitForGitHubErrorState(context.page);

    // Verify error message is displayed
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
