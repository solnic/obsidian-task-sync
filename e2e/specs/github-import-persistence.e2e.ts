/**
 * E2E tests for GitHub import status persistence
 * Tests that import status is preserved across plugin restarts
 */

import { test, expect, describe, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import {
  enableIntegration,
  openView,
  switchToTaskService,
  toggleSidebar,
} from "../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../helpers/github-integration-helpers";
import { PROPERTY_SETS } from "../../src/services/base-definitions/BaseConfigurations";
import { PROPERTY_REGISTRY } from "../../src/types/properties";

describe("GitHub Import Status Persistence", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test(
    "should preserve import status after plugin restart",
    { timeout: 15000 },
    async () => {
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
    }
  );

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

    // Read the imported task file and verify all properties are present
    const taskContent = await context.page.evaluate(() => {
      const app = (window as any).app;
      const taskFile = app.vault.getAbstractFileByPath(
        "Tasks/Test import persistence issue.md"
      );
      if (!taskFile) {
        throw new Error("Imported task file not found");
      }
      return app.vault.read(taskFile);
    });

    // Parse front-matter manually (simple key-value parsing)
    const frontMatter = await context.page.evaluate((content) => {
      const lines = content.split("\n");

      if (lines[0] !== "---") {
        return {};
      }

      const endIndex = lines.findIndex(
        (line: string, index: number) => index > 0 && line === "---"
      );
      if (endIndex === -1) {
        return {};
      }

      const yamlLines = lines.slice(1, endIndex);
      const result: Record<string, any> = {};

      for (const line of yamlLines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) continue;

        const key = line.substring(0, colonIndex).trim();
        const valueStr = line.substring(colonIndex + 1).trim();

        // Simple value parsing
        let value: any;
        if (valueStr === "null") {
          value = null;
        } else if (valueStr === "true") {
          value = true;
        } else if (valueStr === "false") {
          value = false;
        } else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
          value = valueStr.slice(1, -1);
        } else if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
          value =
            valueStr === "[]"
              ? []
              : valueStr
                  .slice(1, -1)
                  .split(",")
                  .map((s: string) => {
                    const trimmed = s.trim();
                    // Remove quotes if present
                    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                      return trimmed.slice(1, -1);
                    }
                    return trimmed;
                  });
        } else {
          value = valueStr;
        }

        result[key] = value;
      }

      return result;
    }, taskContent);

    // Verify all front-matter properties with defaults are present
    const frontMatterProperties = PROPERTY_SETS.TASK_FRONTMATTER;

    frontMatterProperties.forEach((propertyKey) => {
      const propertyDef = PROPERTY_REGISTRY[propertyKey];
      if (!propertyDef) return;

      const frontMatterKey = propertyDef.name;

      // Properties with defaults should always be present
      if (propertyDef.default !== undefined) {
        expect(frontMatter).toHaveProperty(frontMatterKey);
      }
    });

    // Verify specific expected values for imported GitHub issue
    expect(frontMatter.Title).toBe("Test import persistence issue");
    expect(frontMatter.Type).toBe("Task");
    expect(frontMatter.Done).toBe(false); // Default from DONE property
    expect(frontMatter.Status).toBe("Backlog"); // Default from STATUS property
    expect(frontMatter.Areas).toEqual([]); // Default from AREAS property
    expect(frontMatter.tags).toEqual(["test"]); // Tags from GitHub issue labels
    expect(frontMatter.Reminders).toEqual([]); // Default from REMINDERS property
    expect(frontMatter["Parent task"]).toBe(""); // Should be empty string for imports
    expect(frontMatter.Priority).toBeNull(); // Default is null for PRIORITY
  });
});
