/**
 * E2E tests for GitHub Organization/Repository Mapping functionality
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("GitHub Organization/Repository Mapping", () => {
  const context = setupE2ETestHooks();

  test("should configure organization/repository mappings via plugin settings", async () => {
    // Configure GitHub integration and organization/repository mappings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        // Store current settings as previous settings before making changes
        plugin.previousSettings = JSON.parse(JSON.stringify(plugin.settings));

        // Enable GitHub integration
        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken =
          "ghp_test_token_1234567890abcdef";

        // Add organization/repository mappings
        plugin.settings.githubIntegration.orgRepoMappings = [
          {
            organization: "microsoft",
            repository: "",
            targetArea: "Microsoft Projects",
            targetProject: "",
            priority: 2,
          },
          {
            organization: "microsoft",
            repository: "microsoft/vscode",
            targetArea: "Microsoft Projects",
            targetProject: "VSCode",
            priority: 1,
          },
        ];

        await plugin.saveSettings();
      }
    });

    // Verify the mappings were saved correctly
    const mappings = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin?.settings.githubIntegration.orgRepoMappings || [];
    });

    expect(mappings).toHaveLength(2);
    expect(mappings[0]).toMatchObject({
      organization: "microsoft",
      repository: "",
      targetArea: "Microsoft Projects",
      targetProject: "",
      priority: 2,
    });
    expect(mappings[1]).toMatchObject({
      organization: "microsoft",
      repository: "microsoft/vscode",
      targetArea: "Microsoft Projects",
      targetProject: "VSCode",
      priority: 1,
    });
  });

  test("should resolve organization mapping correctly", async () => {
    // Configure GitHub integration and organization mapping
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

    // Test organization mapping resolution
    const mapping = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin && plugin.githubService) {
        const mapper = plugin.githubService.getOrgRepoMapper();
        return mapper.resolveMapping("microsoft/any-repo");
      }
      return null;
    });

    expect(mapping).toMatchObject({
      targetArea: "Microsoft Projects",
      targetProject: "",
      matchType: "organization",
    });
  });

  test("should resolve repository mapping with higher priority", async () => {
    // Configure GitHub integration with both organization and repository mappings
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
          {
            organization: "microsoft",
            repository: "microsoft/vscode",
            targetArea: "Development",
            targetProject: "VSCode",
            priority: 2,
          },
        ];

        await plugin.saveSettings();
      }
    });

    // Test repository mapping resolution (should take priority over organization mapping)
    const mapping = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin && plugin.githubService) {
        const mapper = plugin.githubService.getOrgRepoMapper();
        return mapper.resolveMapping("microsoft/vscode");
      }
      return null;
    });

    expect(mapping).toMatchObject({
      targetArea: "Development",
      targetProject: "VSCode",
      matchType: "repository",
    });
  });

  test("should return null for unmapped organization/repository", async () => {
    // Configure GitHub integration with no mappings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        // Store current settings as previous settings before making changes
        plugin.previousSettings = JSON.parse(JSON.stringify(plugin.settings));

        plugin.settings.githubIntegration.enabled = true;
        plugin.settings.githubIntegration.personalAccessToken =
          "ghp_test_token_1234567890abcdef";
        plugin.settings.githubIntegration.orgRepoMappings = [];
        await plugin.saveSettings();
      }
    });

    // Test unmapped organization/repository
    const mapping = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin && plugin.githubService) {
        const mapper = plugin.githubService.getOrgRepoMapper();
        return mapper.resolveMapping("unknown-org/unknown-repo");
      }
      return null;
    });

    expect(mapping).toMatchObject({
      matchType: "none",
    });
  });
});
