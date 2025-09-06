/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe } from 'vitest';
import { setupE2ETestHooks } from '../helpers/shared-context';
import { createTestFolders } from '../helpers/task-sync-setup';
import {
  waitForGitHubViewContent,
  openGitHubSettings,
  toggleGitHubIntegration,
  configureGitHubToken,
  configureGitHubIntegration,
  getGitHubViewStructure,
  openGitHubIssuesView
} from '../helpers/github-integration-helpers';

describe('GitHub Integration', () => {
  const context = setupE2ETestHooks();

  test('should display GitHub Issues view with proper UI structure', async () => {
    console.log('🧪 Starting GitHub Issues view UI structure test');

    await createTestFolders(context.page);

    // Enable GitHub integration using helper (will use GITHUB_TOKEN from environment)
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: 'solnic/obsidian-task-sync'
    });

    // Open the GitHub Issues view through UI interactions (like a real user)
    console.log('🔍 Opening GitHub Issues view through UI...');
    await openGitHubIssuesView(context.page);

    // Wait for GitHub Issues view content to load
    console.log('🔍 Waiting for GitHub view content...');
    await waitForGitHubViewContent(context.page, 30000);

    // Check for main UI components using helper
    console.log('🔍 Getting GitHub view structure...');
    const uiStructure = await getGitHubViewStructure(context.page);

    console.log('✅ UI structure check complete:', uiStructure);

    expect(uiStructure.exists).toBe(true);
    expect(uiStructure.hasHeader).toBe(true);
    expect(uiStructure.hasContent).toBe(true);
    expect(uiStructure.isVisible).toBe(true);
    expect(uiStructure.hasText).toBe(true);
  });

  test('should configure GitHub token via settings input', async () => {
    console.log('🧪 Starting GitHub token configuration test');

    await createTestFolders(context.page);

    // Open GitHub settings using helper
    console.log('🔧 Opening GitHub settings...');
    await openGitHubSettings(context);

    // Enable GitHub integration using helper
    console.log('🔧 Enabling GitHub integration...');
    await toggleGitHubIntegration(context.page, true);

    // Configure GitHub token using helper
    console.log('🔧 Configuring GitHub token...');
    await configureGitHubToken(context.page, 'test-token-123');

    // Verify token was configured by checking the input value
    console.log('🔍 Verifying token configuration...');
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
    console.log('✅ GitHub token configuration test completed successfully');
  });
});
