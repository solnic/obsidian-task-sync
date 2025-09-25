/**
 * E2E tests for context-aware GitHub importing
 * Tests that GitHub issues are actually imported to the correct area/project with proper label mapping
 */

import { test, expect, describe, beforeEach } from "vitest";
import {
  verifyTaskProperties,
  openFile,
  enableIntegration,
  openView,
  switchToTaskService,
  toggleSidebar,
} from "../../helpers/global";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import { createProject, createArea } from "../../helpers/entity-helpers";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";

describe("Context-Aware GitHub Import", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test("should import GitHub issue to project with correct label mapping", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    const project = await createProject(context.page, {
      name: "Test Project",
      description: "This is a test project for context-aware importing.",
    });

    await openFile(context.page, project.filePath);

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-bug",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

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
      Status: "Backlog", // Verify correct default status mapping
    });
  });

  test("should import GitHub issue to area with enhancement label mapping", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    const area = await createArea(context.page, {
      name: "Development",
      description: "This is a test area for context-aware importing.",
    });

    await openFile(context.page, area.filePath);

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-enhancement",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

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
      Status: "Backlog", // Verify correct default status mapping
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

    await openFile(context.page, "Notes/Regular Note.md");

    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "context-aware-documentation",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

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
      Status: "Backlog", // Verify correct default status mapping
    });
  });
});
