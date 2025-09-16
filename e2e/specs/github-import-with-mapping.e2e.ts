/**
 * E2E tests for GitHub import functionality with organization/repository mapping
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("GitHub Import with Organization/Repository Mapping", () => {
  const context = setupE2ETestHooks();

  test("should enhance import configuration with organization mapping", async () => {
    // Configure GitHub integration with organization mapping
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        // Store current settings as previous settings before making changes
        plugin.previousSettings = JSON.parse(JSON.stringify(plugin.settings));

        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken =
          "ghp_test_token_1234567890abcdef";

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
      }
    });

    // Test import configuration enhancement
    const enhancedConfig = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin && plugin.githubService) {
        const baseConfig = {
          targetArea: "",
          targetProject: "",
          taskType: "Task",
        };

        const mapper = plugin.githubService.getOrgRepoMapper();
        return mapper.enhanceImportConfig("microsoft/any-repo", baseConfig);
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
