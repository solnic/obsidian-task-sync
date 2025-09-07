/**
 * E2E tests for context-aware GitHub importing
 * Tests that GitHub issues are actually imported to the correct area/project with proper label mapping
 */

import { test, expect, describe } from 'vitest';
import { createTestFolders } from '../helpers/task-sync-setup';
import {
  setupE2ETestHooks,
  executeCommand
} from '../helpers/shared-context';
import {
  configureGitHubIntegration,
  openGitHubIssuesView,
  waitForGitHubViewContent,
  stubGitHubApiResponses,
  restoreGitHubApiMethods,
  clickIssueImportButton,
  waitForIssueImportComplete
} from '../helpers/github-integration-helpers';

describe('Context-Aware GitHub Import', () => {
  const context = setupE2ETestHooks();

  test('should import GitHub issue to project with correct label mapping', async () => {
    console.log('🧪 Starting real GitHub import to project test');

    await createTestFolders(context.page);

    // Create a test project file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const projectContent = `---
Type: Project
---

# Test Project

This is a test project for context-aware importing.
`;
      await app.vault.create('Projects/Test Project.md', projectContent);
    });

    // Open the project file to set context
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Projects/Test Project.md');
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Wait for context to be set
    await context.page.waitForTimeout(500);

    // Stub GitHub API responses with test data
    const mockIssues = [
      {
        id: 123456,
        number: 123,
        title: 'Fix login error when user has special characters',
        body: 'Users with special characters in their username cannot log in properly.',
        labels: [{ name: 'bug' }, { name: 'urgent' }],
        assignee: { login: 'testuser' },
        state: 'open',
        html_url: 'https://github.com/solnic/obsidian-task-sync/issues/123',
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

    // Verify the issue appears in the UI
    const issueVisible = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll('.issue-item');
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || '';
        if (issueText.includes('#123') && issueText.includes('Fix login error when user has special characters')) {
          return true;
        }
      }
      return false;
    });

    expect(issueVisible).toBe(true);

    // Click the import button through UI
    await clickIssueImportButton(context.page, 123);

    // Wait for import to complete
    await waitForIssueImportComplete(context.page, 123);

    // Verify the task was created by checking the file system
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const files = app.vault.getMarkdownFiles();

      for (const file of files) {
        if (file.path.startsWith('Tasks/') && file.name.includes('Fix login error')) {
          return file.path;
        }
      }
      return null;
    });

    expect(taskPath).toBeTruthy();
    expect(taskPath).toContain('Tasks/');

    // Verify the task file has correct properties
    const taskContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;

      const content = await app.vault.read(file);
      return content;
    }, taskPath);

    expect(taskContent).toBeTruthy();
    expect(taskContent).toContain('Title: Fix login error when user has special characters');
    expect(taskContent).toContain('Type: Task'); // Type is always 'Task' for task entities
    expect(taskContent).toContain('Category: Bug'); // Label mapping should work for Category
    expect(taskContent).toContain("Project: '[[Test Project]]'"); // Should be assigned to project with note linking
    expect(taskContent).toContain('bug'); // Should include original labels as tags

    // Verify context was correctly detected during import
    const contextInfo = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return plugin ? plugin.getCurrentContext() : null;
    });

    expect(contextInfo.type).toBe('project');
    expect(contextInfo.name).toBe('Test Project');

    console.log('✅ Real GitHub import to project test completed successfully');
  });

  test('should import GitHub issue to area with enhancement label mapping', async () => {
    console.log('🧪 Starting real GitHub import to area test');

    await createTestFolders(context.page);

    // Create a test area file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const areaContent = `---
Type: Area
---

# Development

This is a test area for context-aware importing.
`;
      await app.vault.create('Areas/Development.md', areaContent);
    });

    // Open the area file to set context
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Areas/Development.md');
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Wait for context to be set
    await context.page.waitForTimeout(500);

    // Stub GitHub API responses with test data
    const mockIssues = [
      {
        id: 456789,
        number: 456,
        title: 'Add dark mode support',
        body: 'Users have requested dark mode support for better usability.',
        labels: [{ name: 'enhancement' }, { name: 'ui' }],
        assignee: null as any,
        state: 'open',
        html_url: 'https://github.com/solnic/obsidian-task-sync/issues/456',
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

    // Verify the issue appears in the UI
    const issueVisible = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll('.issue-item');
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || '';
        if (issueText.includes('#456') && issueText.includes('Add dark mode support')) {
          return true;
        }
      }
      return false;
    });

    expect(issueVisible).toBe(true);

    // Click the import button through UI
    await clickIssueImportButton(context.page, 456);

    // Wait for import to complete
    await waitForIssueImportComplete(context.page, 456);

    // Verify the task was created by checking the file system
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const files = app.vault.getMarkdownFiles();

      for (const file of files) {
        if (file.path.startsWith('Tasks/') && file.name.includes('Add dark mode support')) {
          return file.path;
        }
      }
      return null;
    });

    expect(taskPath).toBeTruthy();
    expect(taskPath).toContain('Tasks/');

    // Verify the task file has correct properties
    const taskContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;

      const content = await app.vault.read(file);
      return content;
    }, taskPath);

    expect(taskContent).toBeTruthy();
    expect(taskContent).toContain('Title: Add dark mode support');
    expect(taskContent).toContain('Type: Task'); // Type is always 'Task' for task entities
    expect(taskContent).toContain('Category: Feature'); // enhancement label should map to Feature category
    expect(taskContent).toContain("- '[[Development]]'"); // Should be assigned to area with note linking
    expect(taskContent).toContain('enhancement'); // Should include original labels as tags

    // Verify context was correctly detected during import
    const contextInfo = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return plugin ? plugin.getCurrentContext() : null;
    });

    expect(contextInfo.type).toBe('area');
    expect(contextInfo.name).toBe('Development');

    console.log('✅ Real GitHub import to area test completed successfully');
  });

  test('should import with no context and fallback task type', async () => {
    console.log('🧪 Starting no context import test');

    await createTestFolders(context.page);

    // Create a regular note file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const noteContent = `# Regular Note

This is just a regular note, not in a project or area folder.
`;
      await app.vault.create('Notes/Regular Note.md', noteContent);
    });

    // Open the regular note file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath('Notes/Regular Note.md');
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Wait for context to be set
    await context.page.waitForTimeout(500);

    // Stub GitHub API responses with test data
    const mockIssues = [
      {
        id: 789012,
        number: 789,
        title: 'Update documentation',
        body: 'The documentation needs to be updated with latest changes.',
        labels: [{ name: 'documentation' }, { name: 'help-wanted' }],
        assignee: null as any,
        state: 'open',
        html_url: 'https://github.com/solnic/obsidian-task-sync/issues/789',
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

    // Verify the issue appears in the UI
    const issueVisible = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll('.issue-item');
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || '';
        if (issueText.includes('#789') && issueText.includes('Update documentation')) {
          return true;
        }
      }
      return false;
    });

    expect(issueVisible).toBe(true);

    // Click the import button through UI
    await clickIssueImportButton(context.page, 789);

    // Wait for import to complete
    await waitForIssueImportComplete(context.page, 789);

    // Verify the task was created by checking the file system
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const files = app.vault.getMarkdownFiles();

      for (const file of files) {
        if (file.path.startsWith('Tasks/') && file.name.includes('Update documentation')) {
          return file.path;
        }
      }
      return null;
    });

    expect(taskPath).toBeTruthy();
    expect(taskPath).toContain('Tasks/');

    // Verify the task file has correct properties
    const taskContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;

      const content = await app.vault.read(file);
      return content;
    }, taskPath);

    expect(taskContent).toBeTruthy();
    expect(taskContent).toContain('Title: Update documentation');
    expect(taskContent).toContain('Type: Task'); // Type is always 'Task' for task entities
    // Should fallback to first available task category since 'documentation' doesn't map to anything
    expect(taskContent).toMatch(/Category: (Task|Bug|Feature|Improvement|Chore)/);
    expect(taskContent).toContain('documentation'); // Should include original labels as tags

    // Verify context was correctly detected during import (should be none)
    const contextInfo = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return plugin ? plugin.getCurrentContext() : null;
    });

    expect(contextInfo.type).toBe('none');
    expect(contextInfo.name).toBeUndefined();

    console.log('✅ No context import test completed successfully');
  });
});
