/**
 * E2E tests for GitHub import status persistence
 * Tests that import status is preserved across plugin restarts
 */

import { test, expect, describe } from 'vitest';
import { createTestFolders } from '../helpers/task-sync-setup';
import {
  setupE2ETestHooks,
  executeCommand
} from '../helpers/shared-context';
import { toggleSidebar } from '../helpers/plugin-setup';
import {
  configureGitHubIntegration,
  openGitHubIssuesView,
  waitForGitHubViewContent,
  stubGitHubApiResponses,
  restoreGitHubApiMethods,
  clickIssueImportButton,
  waitForIssueImportComplete
} from '../helpers/github-integration-helpers';

describe('GitHub Import Status Persistence', () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await createTestFolders(context.page);
    await toggleSidebar(context.page, 'right', true);
  });

  test('should preserve import status after plugin restart', async () => {
    // Stub GitHub API responses with test data
    const mockIssues = [
      {
        id: 999888,
        number: 999,
        title: 'Test import persistence issue',
        body: 'This issue tests that import status is preserved across restarts.',
        labels: [{ name: 'test' }],
        assignee: null as any,
        state: 'open',
        html_url: 'https://github.com/solnic/obsidian-task-sync/issues/999',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z'
      }
    ];

    await stubGitHubApiResponses(context.page, { issues: mockIssues });

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: 'solnic/obsidian-task-sync',
      token: 'fake-token-for-testing'
    });

    // Open GitHub Issues view through UI
    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 15000);

    // Verify the issue appears with import button
    const hasImportButton = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll('.issue-item');
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || '';
        if (issueText.includes('#999') && issueText.includes('Test import persistence issue')) {
          const importButton = item.querySelector('[data-test="issue-import-button"]');
          return !!importButton;
        }
      }
      return false;
    });

    expect(hasImportButton).toBe(true);
    console.log('✅ Issue appears with import button');

    // Click the import button through UI
    await clickIssueImportButton(context.page, 999);

    // Wait for import to complete
    await waitForIssueImportComplete(context.page, 999);

    // Verify the issue now shows "Imported" status
    const hasImportedStatus = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll('.issue-item');
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || '';
        if (issueText.includes('#999') && issueText.includes('Test import persistence issue')) {
          const importedIndicator = item.querySelector('.import-status.imported');
          return !!importedIndicator;
        }
      }
      return false;
    });

    expect(hasImportedStatus).toBe(true);
    console.log('✅ Issue shows imported status after import');

    // Simulate plugin restart by disabling and re-enabling the plugin
    console.log('🔄 Simulating plugin restart...');
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const pluginManager = app.plugins;

      // Disable the plugin
      await pluginManager.disablePlugin('obsidian-task-sync');

      // Re-enable the plugin
      await pluginManager.enablePlugin('obsidian-task-sync');
    });

    // Wait for plugin to fully restart
    await context.page.waitForTimeout(2000);

    // Re-stub the GitHub API responses (they get cleared on restart)
    await stubGitHubApiResponses(context.page, { issues: mockIssues });

    // Refresh the GitHub view to reload issues
    await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.githubService) {
        // Force refresh the GitHub view
        const views = app.workspace.getLeavesOfType('github-issues');
        if (views.length > 0) {
          views[0].view.loadIssues();
        }
      }
    });

    // Wait for issues to load
    await context.page.waitForTimeout(2000);

    // BUG: This should show "Imported" status but will show import button instead
    // because import status is not persisted across plugin restarts
    const stillHasImportedStatus = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll('.issue-item');
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || '';
        if (issueText.includes('#999') && issueText.includes('Test import persistence issue')) {
          const importedIndicator = item.querySelector('.import-status.imported');
          return !!importedIndicator;
        }
      }
      return false;
    });

    // This test should FAIL initially, demonstrating the bug
    expect(stillHasImportedStatus).toBe(true);
    console.log('✅ Import status preserved after plugin restart');
  });
});
