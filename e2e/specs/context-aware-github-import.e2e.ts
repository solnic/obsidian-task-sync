/**
 * E2E tests for context-aware GitHub importing
 * Tests that GitHub issues are actually imported to the correct area/project with proper label mapping
 */

import { test, expect, describe } from "vitest";
import { createTestFolders } from "../helpers/task-sync-setup";
import { setupE2ETestHooks, openFile } from "../helpers/shared-context";
import { toggleSidebar } from "../helpers/plugin-setup";
import { createProject, createArea } from "../helpers/entity-helpers";
import {
  configureGitHubIntegration,
  openGitHubIssuesView,
  waitForGitHubViewContent,
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../helpers/github-integration-helpers";

describe("Context-Aware GitHub Import", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await createTestFolders(context.page);
    await toggleSidebar(context.page, "right", true);
  });

  test("should import GitHub issue to project with correct label mapping", async () => {
    const project = await createProject(context, {
      name: "Test Project",
      description: "This is a test project for context-aware importing.",
    });

    await openFile(context, project.filePath);

    // Use fixture-based stubbing for better maintainability
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-bug",
    });

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    // Open GitHub Issues view through UI
    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 15000);

    // Verify the issue appears in the UI
    const issueVisible = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll(
        '[data-testid="issue-item"]',
      );
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || "";
        if (
          issueText.includes("#123") &&
          issueText.includes("Fix login error when user has special characters")
        ) {
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
        if (
          file.path.startsWith("Tasks/") &&
          file.name.includes("Fix login error")
        ) {
          return file.path;
        }
      }
      return null;
    });

    expect(taskPath).toBeTruthy();
    expect(taskPath).toContain("Tasks/");

    // Verify the task file has correct properties
    const taskContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;

      const content = await app.vault.read(file);
      return content;
    }, taskPath);

    expect(taskContent).toBeTruthy();
    expect(taskContent).toContain(
      "Title: Fix login error when user has special characters",
    );
    expect(taskContent).toContain("Type: Task"); // Type is always 'Task' for task entities
    expect(taskContent).toContain("Category: Bug"); // Label mapping should work for Category
    expect(taskContent).toContain("Project: '[[Test Project]]'"); // Should be assigned to project with note linking
    expect(taskContent).toContain("bug"); // Should include original labels as tags

    // Verify context was correctly detected during import
    const contextInfo = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCurrentContext();
    });

    expect(contextInfo.type).toBe("project");
    expect(contextInfo.name).toBe("Test Project");
  });

  test("should import GitHub issue to area with enhancement label mapping", async () => {
    await createTestFolders(context.page);

    const area = await createArea(context, {
      name: "Development",
      description: "This is a test area for context-aware importing.",
    });

    await openFile(context, area.filePath);

    // Wait for context to be set
    await context.page.waitForTimeout(500);

    // Use fixture-based stubbing for better maintainability
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-enhancement",
    });

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    // Open GitHub Issues view through UI
    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 15000);

    // Verify the issue appears in the UI
    const issueVisible = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll(
        '[data-testid="issue-item"]',
      );
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || "";
        if (
          issueText.includes("#456") &&
          issueText.includes("Add dark mode support")
        ) {
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
        if (
          file.path.startsWith("Tasks/") &&
          file.name.includes("Add dark mode support")
        ) {
          return file.path;
        }
      }
      return null;
    });

    expect(taskPath).toBeTruthy();
    expect(taskPath).toContain("Tasks/");

    // Verify the task file has correct properties
    const taskContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;

      const content = await app.vault.read(file);
      return content;
    }, taskPath);

    expect(taskContent).toBeTruthy();
    expect(taskContent).toContain("Title: Add dark mode support");
    expect(taskContent).toContain("Type: Task"); // Type is always 'Task' for task entities
    expect(taskContent).toContain("Category: Feature"); // enhancement label should map to Feature category
    expect(taskContent).toContain("- '[[Development]]'"); // Should be assigned to area with note linking
    expect(taskContent).toContain("enhancement"); // Should include original labels as tags

    // Verify context was correctly detected during import
    const contextInfo = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCurrentContext();
    });

    expect(contextInfo.type).toBe("area");
    expect(contextInfo.name).toBe("Development");
  });

  test("should import with no context and fallback task type", async () => {
    await createTestFolders(context.page);

    // Create a regular note file
    const noteContent = `This is just a regular note, not in a project or area folder.`;

    await context.page.evaluate(async (content: string) => {
      const app = (window as any).app;
      await app.vault.create("Notes/Regular Note.md", content);
    }, noteContent);

    await openFile(context, "Notes/Regular Note.md");

    // Wait for context to be set
    await context.page.waitForTimeout(500);

    // Use fixture-based stubbing for better maintainability
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-documentation",
    });

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });

    // Open GitHub Issues view through UI
    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page, 15000);

    // Verify the issue appears in the UI
    const issueVisible = await context.page.evaluate(() => {
      const issueItems = document.querySelectorAll(
        '[data-testid="issue-item"]',
      );
      for (let i = 0; i < issueItems.length; i++) {
        const item = issueItems[i];
        const issueText = item.textContent || "";
        if (
          issueText.includes("#789") &&
          issueText.includes("Update documentation")
        ) {
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
        if (
          file.path.startsWith("Tasks/") &&
          file.name.includes("Update documentation")
        ) {
          return file.path;
        }
      }
      return null;
    });

    expect(taskPath).toBeTruthy();
    expect(taskPath).toContain("Tasks/");

    // Verify the task file has correct properties
    const taskContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;

      const content = await app.vault.read(file);
      return content;
    }, taskPath);

    expect(taskContent).toBeTruthy();
    expect(taskContent).toContain("Title: Update documentation");
    expect(taskContent).toContain("Type: Task"); // Type is always 'Task' for task entities
    // Should fallback to first available task category since 'documentation' doesn't map to anything
    expect(taskContent).toMatch(
      /Category: (Task|Bug|Feature|Improvement|Chore)/,
    );
    expect(taskContent).toContain("documentation"); // Should include original labels as tags

    // Verify context was correctly detected during import (should be none)
    const contextInfo = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCurrentContext();
    });

    expect(contextInfo.type).toBe("none");
    expect(contextInfo.name).toBeUndefined();
  });
});
