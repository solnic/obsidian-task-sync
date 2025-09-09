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

    // Verify import status is recorded in the service before restart
    const importStatusBeforeRestart = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.importStatusService) {
        return plugin.importStatusService.isTaskImported('github-999888', 'github');
      }
      return false;
    });

    expect(importStatusBeforeRestart).toBe(true);

    // Wait for any pending save operations to complete
    await context.page.waitForTimeout(1000);

    // Restart the plugin
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const pluginManager = app.plugins;

      await pluginManager.disablePlugin('obsidian-task-sync');
      await pluginManager.enablePlugin('obsidian-task-sync');
    });

    // Wait for plugin to fully initialize
    await context.page.waitForTimeout(3000);

    // Verify import status is still recorded after restart
    const importStatusAfterRestart = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.importStatusService) {
        return plugin.importStatusService.isTaskImported('github-999888', 'github');
      }
      return false;
    });

    expect(importStatusAfterRestart).toBe(true);

    await stubGitHubApiResponses(context.page, { issues: mockIssues });

    await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.githubService) {
        const views = app.workspace.getLeavesOfType('github-issues');
        if (views.length > 0) {
          views[0].view.loadIssues();
        }
      }
    });

    await context.page.waitForTimeout(2000);

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

    expect(stillHasImportedStatus).toBe(true);
  });
});
