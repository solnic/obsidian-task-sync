/**
 * E2E tests for GitHub import status persistence
 * Tests that import status is preserved across plugin restarts
 */

import { test, expect, describe, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import {
  enableIntegration,
  openView,
  switchToTaskService,
  toggleSidebar,
  verifyTaskProperties,
  getTaskByTitle,
} from "../../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";

describe("GitHub Import Status Persistence", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test("should preserve import status after plugin restart", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "persistence-test",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    await clickIssueImportButton(context.page, 999);
    await waitForIssueImportComplete(context.page, 999);

    const importStatusBeforeRestart = await context.page.evaluate(() => {
      const app = (window as any).app;
      const taskFile = app.vault.getAbstractFileByPath(
        "Tasks/Test import persistence issue.md"
      );
      return taskFile !== null;
    });

    expect(importStatusBeforeRestart).toBe(true);

    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const pluginManager = app.plugins;

      await pluginManager.disablePlugin("obsidian-task-sync");
      await pluginManager.enablePlugin("obsidian-task-sync");
    });

    await context.page.waitForTimeout(3000);

    const importStatusAfterRestart = await context.page.evaluate(() => {
      const app = (window as any).app;
      const taskFile = app.vault.getAbstractFileByPath(
        "Tasks/Test import persistence issue.md"
      );
      return taskFile !== null;
    });

    expect(importStatusAfterRestart).toBe(true);
  });

  test("imported GitHub issue should have all task properties with default values", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "persistence-test",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");
    await clickIssueImportButton(context.page, 999);
    await waitForIssueImportComplete(context.page, 999);

    const task = await getTaskByTitle(
      context.page,
      "Test import persistence issue"
    );

    await verifyTaskProperties(context.page, task.file.path, {
      Title: "Test import persistence issue",
      Type: "Task",
      Done: false,
      Status: "Backlog",
      Areas: [],
      tags: ["test"],
      Reminders: [],
      "Parent task": "",
      Priority: null,
    });
  });
});
