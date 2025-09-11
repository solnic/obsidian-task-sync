/**
 * E2E tests for GitHub Integration
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createTestFolders } from "../helpers/task-sync-setup";
import { toggleSidebar } from "../helpers/plugin-setup";
import {
  openGitHubSettings,
  toggleGitHubIntegration,
  configureGitHubToken,
} from "../helpers/github-integration-helpers";

describe("GitHub Integration", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
  });

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test("should configure GitHub token via settings input", async () => {
    await openGitHubSettings(context);
    await toggleGitHubIntegration(context.page, true);
    await configureGitHubToken(context.page, "test-token-123");

    const tokenConfigured = await context.page.evaluate(() => {
      const settingsContainer = document.querySelector(".vertical-tab-content");
      if (!settingsContainer) return false;

      const settings = Array.from(
        settingsContainer.querySelectorAll(".setting-item")
      );
      for (const setting of settings) {
        const nameEl = setting.querySelector(".setting-item-name");
        if (
          nameEl &&
          nameEl.textContent?.includes("GitHub Personal Access Token")
        ) {
          const input = setting.querySelector(
            'input[type="password"]'
          ) as HTMLInputElement;
          return input && input.value === "test-token-123";
        }
      }
      return false;
    });

    expect(tokenConfigured).toBe(true);
  });
});
