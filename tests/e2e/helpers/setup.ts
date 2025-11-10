/**
 * Playwright-specific setup helpers for e2e tests
 * Reuses existing functions from shared-context.ts but leverages Playwright test runner API
 */

import { randomUUID } from "crypto";
import { dasherize } from "inflection";
import { test as base, type TestInfo } from "@playwright/test";

import { type SharedTestContext } from "./shared-context";
import type { Page, ElectronApplication } from "@playwright/test";

import {
  setupObsidianElectron,
  createTestFolders,
  resetObsidianUI,
  createIsolatedTestEnvironment,
  cleanupIsolatedTestEnvironment,
  captureFullDebugInfo,
} from "./shared-context";

/**
 * Playwright-specific test context that extends SharedTestContext
 * with Playwright test info
 */
export interface PlaywrightTestContext extends SharedTestContext {
  testInfo: TestInfo;
}

/**
 * Setup a fresh test environment for Playwright tests
 * This function should be called in test.beforeEach() hooks
 */
export async function setupPlaywrightTest(
  testInfo: TestInfo
): Promise<PlaywrightTestContext> {
  const testId = randomUUID();
  const workerId = `playwright-${testInfo.workerIndex}`;

  // Create isolated environment for this test
  const {
    testId: envTestId,
    vaultPath,
    dataPath,
  } = await createIsolatedTestEnvironment(testId);

  let electronApp: ElectronApplication;
  let page: Page;
  let logs: Array<{ type: string; text: string; timestamp: Date }> = [];

  const result = await setupObsidianElectron(vaultPath, dataPath, logs);
  electronApp = result.electronApp;
  page = result.page;

  // Create test folders in the fresh environment
  await createTestFolders(page);

  // Reset UI state
  await resetObsidianUI(page);

  // Reload plugin settings to ensure clean state
  await reloadPluginSettings(page);

  const context: PlaywrightTestContext = {
    electronApp,
    page,
    testId: envTestId,
    vaultPath,
    dataPath,
    workerId,
    logs,
    testInfo,
  };

  return context;
}

/**
 * Cleanup a Playwright test environment
 * This function should be called in test.afterEach() hooks
 */
export async function cleanupPlaywrightTest(
  context: PlaywrightTestContext,
  testInfo: TestInfo
): Promise<void> {
  // Reset UI state before cleanup to ensure clean state for next test
  try {
    await resetObsidianUI(context.page);
  } catch (error) {
    // Ignore errors during cleanup - page might already be closing
    console.debug("Error resetting UI during cleanup:", error);
  }

  if (testInfo.status !== "passed") {
    await captureFullDebugInfo(
      context,
      `test-failure-${dasherize(testInfo.title)}`
    );
  }

  await context.page.close();
  await context.electronApp.close();

  await cleanupIsolatedTestEnvironment(context.testId);
}

/**
 * Reload plugin settings from disk to ensure clean state between tests
 */
async function reloadPluginSettings(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    await plugin.loadSettings();
  });
}

/**
 * Standard Playwright test with extended page fixture
 * Usage in test files:
 *
 * ```typescript
 * import { test, expect } from './helpers/setup';
 *
 * test('my test', async ({ page }) => {
 *   await page.click(...);
 *   // page now has extended properties: page.testId, page.vaultPath, etc.
 * });
 * ```
 */
export const test = base.extend<{
  page: Page & {
    testId: string;
    vaultPath: string;
    dataPath: string;
    workerId: string;
    electronApp: ElectronApplication;
    logs: Array<{ type: string; text: string; timestamp: Date }>;
  };
}>({
  page: async ({}, use, testInfo: TestInfo) => {
    // Setup before each test
    const context = await setupPlaywrightTest(testInfo);

    // Extend the page with context properties
    const extendedPage = context.page as any;
    extendedPage.testId = context.testId;
    extendedPage.vaultPath = context.vaultPath;
    extendedPage.dataPath = context.dataPath;
    extendedPage.workerId = context.workerId;
    extendedPage.electronApp = context.electronApp;
    extendedPage.logs = context.logs;

    await use(extendedPage);

    // Cleanup after each test
    await cleanupPlaywrightTest(context, testInfo);
  },
});

export { expect } from "@playwright/test";
