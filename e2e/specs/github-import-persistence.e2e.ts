/**
 * E2E tests for GitHub import status persistence
 * Tests that import status is preserved across plugin restarts
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import { createTestFolders } from "../helpers/task-sync-setup";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { toggleSidebar } from "../helpers/plugin-setup";
import {
  configureGitHubIntegration,
  openGitHubIssuesView,
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../helpers/github-integration-helpers";

describe("GitHub Import Status Persistence", () => {
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

  test("should preserve import status after plugin restart", async () => {
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "persistence-test",
    });

    await openGitHubIssuesView(context.page);

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
});
