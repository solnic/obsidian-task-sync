/**
 * E2E tests for GitHub import functionality with organization/repository mapping
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { enableIntegration } from "../helpers/global";

describe("GitHub Import with Organization/Repository Mapping", () => {
  const context = setupE2ETestHooks();

  test("should enhance import configuration with organization mapping", async () => {
    // Configure GitHub integration with organization mapping
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "ghp_1234567890abcdef1234567890abcdef12345678",
      orgRepoMappings: [
        {
          organization: "microsoft",
          repository: "",
          targetArea: "Microsoft Projects",
          targetProject: "",
          priority: 1,
        },
      ],
    });

    // Test import configuration enhancement
    const enhancedConfig = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin && plugin.integrationManager) {
        const githubService = plugin.integrationManager.getGitHubService();
        if (githubService) {
          const baseConfig = {
            targetArea: "",
            targetProject: "",
            taskType: "Task",
          };

          const mapper = githubService.getOrgRepoMapper();
          return mapper.enhanceImportConfig("microsoft/any-repo", baseConfig);
        }
      }
      return null;
    });

    expect(enhancedConfig).toMatchObject({
      targetArea: "Microsoft Projects",
      targetProject: "",
      taskType: "Task",
    });
  });
});
