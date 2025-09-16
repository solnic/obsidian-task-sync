/**
 * End-to-End Tests for GitHub Mapping Precedence
 * Tests that GitHub org/repo mappings take precedence over current context when importing tasks
 */

import { test, expect, describe, beforeAll } from "vitest";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
  verifyTaskProperties,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, openFile } from "../helpers/shared-context";
// GitHub integration helpers no longer needed - using direct API calls
import { createProject } from "../helpers/entity-helpers";

describe("GitHub Mapping Precedence", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);
  });

  test(
    "should apply GitHub org mapping over current context",
    { timeout: 30000 },
    async () => {
      // Create a project to set current context
      const currentProject = await createProject(context, {
        name: "Current Project",
        description: "This is the current project context.",
      });

      // Open the project file to set context
      await openFile(context, currentProject.filePath);

      // Configure GitHub integration with organization mapping
      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Store current settings as previous settings before making changes
        plugin.previousSettings = JSON.parse(JSON.stringify(plugin.settings));

        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken =
          "ghp_test_token_1234567890abcdef";
        plugin.settings.githubIntegration.defaultRepository =
          "solnic/obsidian-task-sync";

        // Set up organization mapping
        plugin.settings.githubIntegration.orgRepoMappings = [
          {
            organization: "microsoft",
            repository: "",
            targetArea: "Microsoft Projects",
            targetProject: "",
            priority: 1,
          },
        ];

        await plugin.saveSettings();
      });

      // Import GitHub issue directly using the service API
      const result = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Mock GitHub issue data
        const mockIssue = {
          id: 123456,
          number: 123,
          title: "Microsoft Issue",
          body: "This issue should use GitHub mapping, not current context",
          state: "open",
          html_url: "https://github.com/solnic/obsidian-task-sync/issues/123",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          assignee: null,
          assignees: [],
          labels: [],
          user: {
            login: "testuser",
            id: 5678,
            avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
            html_url: "https://github.com/testuser",
          },
        };

        try {
          // Import the issue using the GitHub service
          const importResult = await plugin.githubService.importIssueAsTask(
            mockIssue,
            {
              importLabelsAsTags: true,
              preserveAssignee: true,
            },
            "microsoft/vscode" // Repository that should match our mapping
          );

          return {
            success: true,
            taskPath: importResult.taskPath,
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.taskPath).toBeTruthy();

      const taskPath = result.taskPath;

      // Verify that the GitHub mapping was applied (should override current context)
      await verifyTaskProperties(context.page, taskPath, {
        Title: "Microsoft Issue",
        Type: "Task",
        Areas: ["[[Microsoft Projects]]"], // Should come from GitHub mapping, not current context
      });
    }
  );

  test(
    "should apply repository-specific mapping over organization mapping",
    { timeout: 30000 },
    async () => {
      // Create a project to set current context
      const currentProject = await createProject(context, {
        name: "VSCode Test Project",
        description: "This is the current project context for VSCode test.",
      });

      // Open the project file to set context
      await openFile(context, currentProject.filePath);

      // Configure GitHub integration with both org and repo mappings
      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Store current settings as previous settings before making changes
        plugin.previousSettings = JSON.parse(JSON.stringify(plugin.settings));

        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken =
          "ghp_test_token_1234567890abcdef";
        plugin.settings.githubIntegration.defaultRepository =
          "solnic/obsidian-task-sync";

        // Set up both organization and repository mappings
        plugin.settings.githubIntegration.orgRepoMappings = [
          {
            organization: "microsoft",
            repository: "",
            targetArea: "Microsoft Projects",
            targetProject: "",
            priority: 1,
          },
          {
            organization: "microsoft",
            repository: "microsoft/vscode", // Full repository format
            targetArea: "VSCode Development",
            targetProject: "VSCode Core",
            priority: 2, // Higher priority
          },
        ];

        await plugin.saveSettings();
      });

      // Import GitHub issue directly using the service API
      const result = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Mock GitHub issue data from VSCode repository
        const mockIssue = {
          id: 456789,
          number: 456,
          title: "VSCode Issue",
          body: "This issue should use repository-specific mapping",
          state: "open",
          html_url: "https://github.com/microsoft/vscode/issues/456",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          assignee: null,
          assignees: [],
          labels: [],
          user: {
            login: "testuser",
            id: 5678,
            avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
            html_url: "https://github.com/testuser",
          },
        };

        try {
          // Import the issue using the GitHub service
          const importResult = await plugin.githubService.importIssueAsTask(
            mockIssue,
            {
              importLabelsAsTags: true,
              preserveAssignee: true,
            },
            "microsoft/vscode" // Repository that should match our repo-specific mapping
          );

          return {
            success: true,
            taskPath: importResult.taskPath,
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.taskPath).toBeTruthy();

      const taskPath = result.taskPath;

      // Verify that the repository-specific mapping was applied (higher priority)
      await verifyTaskProperties(context.page, taskPath, {
        Title: "VSCode Issue",
        Type: "Task",
        Areas: ["[[VSCode Development]]"], // Should come from repo-specific mapping
        Project: "[[VSCode Core]]", // Should come from repo-specific mapping
      });
    }
  );

  test(
    "should use current context when no GitHub mapping exists",
    { timeout: 30000 },
    async () => {
      // Create a project to set current context
      const currentProject = await createProject(context, {
        name: "Generic Test Project",
        description: "This is the current project context for generic test.",
      });

      // Open the project file to set context
      await openFile(context, currentProject.filePath);

      // Configure GitHub integration without any mappings
      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Store current settings as previous settings before making changes
        plugin.previousSettings = JSON.parse(JSON.stringify(plugin.settings));

        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken =
          "ghp_test_token_1234567890abcdef";
        plugin.settings.githubIntegration.defaultRepository =
          "solnic/obsidian-task-sync";

        // No mappings configured
        plugin.settings.githubIntegration.orgRepoMappings = [];

        await plugin.saveSettings();
      });

      // Import GitHub issue directly using the service API
      const result = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Mock GitHub issue data from a repository with no mapping
        const mockIssue = {
          id: 789012,
          number: 789,
          title: "Generic Issue",
          body: "This issue should use current context (no GitHub mapping)",
          state: "open",
          html_url: "https://github.com/someorg/somerepo/issues/789",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          assignee: null,
          assignees: [],
          labels: [],
          user: {
            login: "testuser",
            id: 5678,
            avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
            html_url: "https://github.com/testuser",
          },
        };

        try {
          // Get default import config which includes current context
          const defaultConfig = plugin.getDefaultImportConfig();

          // Import the issue using the GitHub service with context-aware config
          const importResult = await plugin.githubService.importIssueAsTask(
            mockIssue,
            defaultConfig,
            "someorg/somerepo" // Repository that has no mapping
          );

          return {
            success: true,
            taskPath: importResult.taskPath,
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.taskPath).toBeTruthy();

      const taskPath = result.taskPath;

      // Verify that current context was used (no GitHub mapping)
      await verifyTaskProperties(context.page, taskPath, {
        Title: "Generic Issue",
        Type: "Task",
        Project: "[[Generic Test Project]]", // Should come from current context
      });
    }
  );

  test(
    "should apply GitHub mapping even when config already has values",
    { timeout: 30000 },
    async () => {
      // Create a project to set current context
      const currentProject = await createProject(context, {
        name: "GitHub Test Project",
        description: "This is the current project context for GitHub test.",
      });

      // Open the project file to set context
      await openFile(context, currentProject.filePath);

      // Configure GitHub integration with organization mapping
      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Store current settings as previous settings before making changes
        plugin.previousSettings = JSON.parse(JSON.stringify(plugin.settings));

        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken =
          "ghp_test_token_1234567890abcdef";
        plugin.settings.githubIntegration.defaultRepository =
          "solnic/obsidian-task-sync";

        // Set up organization mapping
        plugin.settings.githubIntegration.orgRepoMappings = [
          {
            organization: "github",
            repository: "",
            targetArea: "GitHub Projects",
            targetProject: "GitHub Core",
            priority: 1,
          },
        ];

        await plugin.saveSettings();
      });

      // Import GitHub issue directly using the service API
      const result = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Mock GitHub issue data from GitHub organization
        const mockIssue = {
          id: 999123,
          number: 999,
          title: "GitHub Issue",
          body: "This issue should use GitHub mapping, overriding current context",
          state: "open",
          html_url: "https://github.com/github/somerepo/issues/999",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          assignee: null,
          assignees: [],
          labels: [],
          user: {
            login: "testuser",
            id: 5678,
            avatar_url: "https://avatars.githubusercontent.com/u/5678?v=4",
            html_url: "https://github.com/testuser",
          },
        };

        try {
          // Import the issue using the GitHub service
          const importResult = await plugin.githubService.importIssueAsTask(
            mockIssue,
            {
              importLabelsAsTags: true,
              preserveAssignee: true,
            },
            "github/somerepo" // Repository that should match our GitHub org mapping
          );

          return {
            success: true,
            taskPath: importResult.taskPath,
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.taskPath).toBeTruthy();

      const taskPath = result.taskPath;

      // Verify that GitHub mapping overrode current context
      await verifyTaskProperties(context.page, taskPath, {
        Title: "GitHub Issue",
        Type: "Task",
        Areas: ["[[GitHub Projects]]"], // Should come from GitHub mapping
        Project: "[[GitHub Core]]", // Should come from GitHub mapping
      });
    }
  );
});
