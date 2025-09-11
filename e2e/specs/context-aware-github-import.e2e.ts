/**
 * E2E tests for context-aware GitHub importing
 * Tests that GitHub issues are actually imported to the correct area/project with proper label mapping
 */

import { test, expect, describe } from "vitest";
import {
  createTestFolders,
  verifyTaskProperties,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, openFile } from "../helpers/shared-context";
import { toggleSidebar } from "../helpers/plugin-setup";
import { createProject, createArea } from "../helpers/entity-helpers";
import {
  configureGitHubIntegration,
  openGitHubIssuesView,
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../helpers/github-integration-helpers";

describe("Context-Aware GitHub Import", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
  });

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: "solnic/obsidian-task-sync",
      token: "fake-token-for-testing",
    });
  });

  test("should import GitHub issue to project with correct label mapping", async () => {
    const project = await createProject(context, {
      name: "Test Project",
      description: "This is a test project for context-aware importing.",
    });

    await openFile(context, project.filePath);

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-bug",
    });

    await openGitHubIssuesView(context.page);

    await clickIssueImportButton(context.page, 123);
    await waitForIssueImportComplete(context.page, 123);

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

    await verifyTaskProperties(context.page, taskPath, {
      Title: "Fix login error when user has special characters",
      Type: "Task",
      Category: "Bug",
      Project: "[[Test Project]]",
    });
  });

  test("should import GitHub issue to area with enhancement label mapping", async () => {
    const area = await createArea(context, {
      name: "Development",
      description: "This is a test area for context-aware importing.",
    });

    await openFile(context, area.filePath);

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-enhancement",
    });

    await openGitHubIssuesView(context.page);

    await clickIssueImportButton(context.page, 456);
    await waitForIssueImportComplete(context.page, 456);

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

    await verifyTaskProperties(context.page, taskPath, {
      Title: "Add dark mode support",
      Type: "Task",
      Category: "Feature",
      Areas: ["[[Development]]"],
    });
  });

  test("should import with no context and fallback task type", async () => {
    const noteContent = `This is just a regular note, not in a project or area folder.`;

    await context.page.evaluate(async (content: string) => {
      const app = (window as any).app;
      // Ensure Notes folder exists
      if (!(await app.vault.adapter.exists("Notes"))) {
        await app.vault.createFolder("Notes");
      }
      await app.vault.create("Notes/Regular Note.md", content);
    }, noteContent);

    await openFile(context, "Notes/Regular Note.md");

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-documentation",
    });

    await openGitHubIssuesView(context.page);

    await clickIssueImportButton(context.page, 789);
    await waitForIssueImportComplete(context.page, 789);

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

    await verifyTaskProperties(context.page, taskPath, {
      Title: "Update documentation",
      Type: "Task",
    });
  });
});
