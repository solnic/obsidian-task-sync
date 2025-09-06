/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe } from 'vitest';
import { setupE2ETestHooks } from '../helpers/shared-context';
import { createTestFolders } from '../helpers/task-sync-setup';

describe('GitHub Integration', () => {
  const context = setupE2ETestHooks();

  test('should register GitHub Issues view type', async () => {
    await createTestFolders(context.page);

    // Check that the GitHub Issues view type is registered
    const isViewRegistered = await context.page.evaluate(() => {
      const app = (window as any).app;
      return app.viewRegistry.typeByExtension['github-issues'] !== undefined;
    });

    expect(isViewRegistered).toBe(true);
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

    // Check that GitHub integration section exists
    const hasGitHubSection = await context.page.evaluate(() => {
      const settingsContainer = document.querySelector('.vertical-tab-content');
      if (!settingsContainer) return false;

      // Look for GitHub integration related text
      const text = settingsContainer.textContent || '';
      return text.includes('GitHub') || text.includes('Integrations');
    });

    expect(hasGitHubSection).toBe(true);
  });

  test('should be able to open GitHub Issues view', async () => {
    await createTestFolders(context.page);

    // Configure GitHub integration first
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin) {
        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken = process.env.GITHUB_TEST_PAT || 'test-token';
        plugin.settings.githubIntegration.defaultRepository = 'octocat/Hello-World';
        await plugin.saveSettings();
      }
    });

    // Open GitHub Issues view
    const viewOpened = await context.page.evaluate(async () => {
      const app = (window as any).app;

      try {
        const leaf = app.workspace.getRightLeaf(false);
        await leaf.setViewState({
          type: 'github-issues',
          active: true
        });
        return true;
      } catch (error) {
        console.error('Failed to open GitHub Issues view:', error);
        return false;
      }
    });

    expect(viewOpened).toBe(true);

    // Wait for view to be created
    await context.page.waitForTimeout(1000);

    // Check that the view is displayed
    const viewExists = await context.page.evaluate(() => {
      const viewElement = document.querySelector('[data-type="github-issues"]');
      return viewElement !== null;
    });

    expect(viewExists).toBe(true);
  });

  test('should display GitHub Issues view UI components', async () => {
    await createTestFolders(context.page);

    // Configure and open GitHub Issues view
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin) {
        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken = process.env.GITHUB_TEST_PAT || 'test-token';
        plugin.settings.githubIntegration.defaultRepository = 'octocat/Hello-World';
        await plugin.saveSettings();

        const leaf = app.workspace.getRightLeaf(false);
        await leaf.setViewState({
          type: 'github-issues',
          active: true
        });
      }
    });

    // Wait for view to load
    await context.page.waitForTimeout(2000);

    // Check for main UI components
    const hasUIComponents = await context.page.evaluate(() => {
      const viewElement = document.querySelector('[data-type="github-issues"]');
      if (!viewElement) return false;

      const hasHeader = viewElement.querySelector('.github-issues-header') !== null;
      const hasContent = viewElement.querySelector('.github-issues-content') !== null;

      return hasHeader && hasContent;
    });

    expect(hasUIComponents).toBe(true);
  });

  test('should handle GitHub service initialization', async () => {
    await createTestFolders(context.page);

    // Test GitHub service functionality
    const serviceWorks = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (!plugin || !plugin.githubService) return false;

      // Test basic service methods
      const isEnabled = plugin.githubService.isEnabled();
      const validRepo = plugin.githubService.validateRepository('owner/repo');
      const invalidRepo = plugin.githubService.validateRepository('invalid');

      return {
        hasService: true,
        isEnabled: typeof isEnabled === 'boolean',
        validatesCorrectly: validRepo === true && invalidRepo === false
      };
    });

    if (serviceWorks) {
      expect(serviceWorks.hasService).toBe(true);
      expect(serviceWorks.isEnabled).toBe(true);
      expect(serviceWorks.validatesCorrectly).toBe(true);
    } else {
      expect(serviceWorks).not.toBe(false);
    }
  });

  test('should execute GitHub Issues view command', async () => {
    await createTestFolders(context.page);

    // Execute the GitHub Issues view command
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

    // Verify view was opened
    const viewOpened = await context.page.evaluate(() => {
      return document.querySelector('[data-type="github-issues"]') !== null;
    });

    expect(viewOpened).toBe(true);
  });

  test('should fetch repositories when PAT is configured and refresh is clicked', async () => {
    await createTestFolders(context.page);

    // Configure GitHub integration with PAT
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];

      if (plugin) {
        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken = process.env.GITHUB_TOKEN || process.env.GITHUB_TEST_PAT || 'test-token';
        plugin.settings.githubIntegration.defaultRepository = 'octocat/Hello-World';
        await plugin.saveSettings();
      }
    });

    // Open GitHub Issues view
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const leaf = app.workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: 'github-issues',
        active: true
      });
    });

    // Wait for view to load
    await context.page.waitForTimeout(2000);

    // Check initial state - repositories should already be loaded from onOpen
    const initialRepos = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return plugin?.settings?.githubIntegration?.repositories || [];
    });

    // Repositories should already be populated from onOpen
    expect(initialRepos.length).toBeGreaterThan(0);

    // Click refresh button to fetch repositories
    const refreshClicked = await context.page.evaluate(async () => {
      const refreshButton = document.querySelector('.refresh-button') as HTMLButtonElement;
      if (!refreshButton) return false;

      refreshButton.click();
      return true;
    });

    expect(refreshClicked).toBe(true);

    // Wait for repositories to be fetched
    await context.page.waitForTimeout(3000);

    // Check that repositories were fetched and populated
    const fetchedRepos = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return plugin?.settings?.githubIntegration?.repositories || [];
    });

    // With a real PAT, repositories should now be populated
    expect(fetchedRepos.length).toBeGreaterThan(0);

    // Check that repository selector has options
    const hasRepoOptions = await context.page.evaluate(() => {
      const repoSelect = document.querySelector('.repository-selector select') as HTMLSelectElement;
      return repoSelect && repoSelect.options.length > 0;
    });

    expect(hasRepoOptions).toBe(true);
  });
});
