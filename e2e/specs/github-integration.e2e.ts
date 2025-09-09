/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe } from 'vitest';
import { setupE2ETestHooks } from '../helpers/shared-context';
import { createTestFolders } from '../helpers/task-sync-setup';
import { toggleSidebar } from '../helpers/plugin-setup';
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

  beforeEach(async () => {
    await createTestFolders(context.page);
    await toggleSidebar(context.page, 'right', true);
  });

  test('should configure GitHub token via settings input', async () => {
    await openGitHubSettings(context);
    await toggleGitHubIntegration(context.page, true);
    await configureGitHubToken(context.page, 'test-token-123');

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

  test('should display import buttons on GitHub issues', async () => {
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: 'solnic/obsidian-task-sync'
    });

    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 30000);

    // Check for import buttons on issues
    const hasImportButtons = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll('.issue-item');
      if (issueItems.length === 0) return false;

      // Check if each issue has an import button
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const importButton = item.querySelector('[data-test="issue-import-button"]');
        if (!importButton) return false;
      }
      return true;
    });

    expect(hasImportButtons).toBe(true);
  });

  test('should display import all button in header', async () => {
    await createTestFolders(context.page);

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: 'solnic/obsidian-task-sync'
    });

    // Open GitHub Issues view
    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 30000);

    // Check for import all button in header
    const hasImportAllButton = await context.page.evaluate(() => {
      const header = document.querySelector('.github-issues-header');
      if (!header) return false;

      const importAllButton = header.querySelector('[data-test="import-all-button"]');
      return !!importAllButton;
    });

    expect(hasImportAllButton).toBe(true);
  });
});
