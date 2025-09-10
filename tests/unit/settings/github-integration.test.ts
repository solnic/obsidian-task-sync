/**
 * Tests for GitHub integration settings
 */

import { describe, it, expect } from "vitest";
import { TaskSyncSettings } from "../../../src/components/ui/settings/types";
import { DEFAULT_SETTINGS } from "../../../src/components/ui/settings/defaults";
import { validateGitHubToken } from "../../../src/components/ui/settings/validation";
import { createGitHubIntegrationSection } from "../../../src/components/ui/settings/SettingsTab";

describe("GitHub Integration Settings", () => {
  it("should include GitHub integration settings in TaskSyncSettings interface", () => {
    // Test that the settings interface includes GitHub integration properties
    const settings: TaskSyncSettings = {
      ...DEFAULT_SETTINGS,
      // These properties should exist in the interface
      githubIntegration: {
        enabled: true,
        personalAccessToken: "test-token",
        repositories: ["owner/repo1", "owner/repo2"],
        defaultRepository: "owner/repo1",
        issueFilters: {
          state: "open",
          assignee: "me",
          labels: [],
        },
        labelTypeMapping: {},
      },
    };

    // Should not throw TypeScript errors
    expect(settings.githubIntegration).toBeDefined();
    expect(settings.githubIntegration.enabled).toBe(true);
    expect(settings.githubIntegration.personalAccessToken).toBe("test-token");
    expect(settings.githubIntegration.repositories).toEqual([
      "owner/repo1",
      "owner/repo2",
    ]);
    expect(settings.githubIntegration.defaultRepository).toBe("owner/repo1");
    expect(settings.githubIntegration.issueFilters.state).toBe("open");
  });

  it("should have default GitHub integration settings", () => {
    // Test that DEFAULT_SETTINGS includes GitHub integration defaults
    expect(DEFAULT_SETTINGS.githubIntegration).toBeDefined();
    expect(DEFAULT_SETTINGS.githubIntegration.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.githubIntegration.personalAccessToken).toBe("");
    expect(DEFAULT_SETTINGS.githubIntegration.repositories).toEqual([]);
    expect(DEFAULT_SETTINGS.githubIntegration.defaultRepository).toBe("");
    expect(DEFAULT_SETTINGS.githubIntegration.issueFilters).toBeDefined();
  });

  it("should validate GitHub personal access token format", () => {
    // Test validation for GitHub PAT
    const validTokens = [
      "ghp_1234567890abcdef1234567890abcdef12345678", // Classic PAT
      "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ", // Fine-grained PAT
    ];

    const invalidTokens = [
      "invalid-token", // Wrong format
      "ghp_short", // Too short
      "not-a-token-at-all", // Invalid format
    ];

    // Test that empty token is valid (integration can be disabled)
    const emptyResult = validateGitHubToken("");
    expect(emptyResult.isValid).toBe(true);

    // Test valid tokens
    validTokens.forEach((token) => {
      const result = validateGitHubToken(token);
      expect(result.isValid).toBe(true);
    });

    // Test invalid tokens
    invalidTokens.forEach((token) => {
      const result = validateGitHubToken(token);
      expect(result.isValid).toBe(false);
    });
  });

  it("should include GitHub integration section in settings sections", () => {
    // Test that the settings tab includes a GitHub integration section
    expect(typeof createGitHubIntegrationSection).toBe("function");
  });
});
