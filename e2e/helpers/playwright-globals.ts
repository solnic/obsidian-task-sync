/**
 * Global helpers for Playwright tests
 * This file makes all helper functions available globally in Playwright tests
 * without requiring explicit imports
 */

import { test as base, expect } from "@playwright/test";
import type { PlaywrightTestContext } from "./setup";
import { setupPlaywrightTest, cleanupPlaywrightTest } from "./setup";

// Note: We don't re-export global.ts here to avoid vitest import issues
// Helper functions will be imported directly in test files as needed

// Create the extended test with context fixture
export const test = base.extend<{
  context: PlaywrightTestContext;
}>({
  context: async ({}, use, testInfo) => {
    const context = await setupPlaywrightTest(testInfo);
    await use(context);
    await cleanupPlaywrightTest(context, testInfo);
  },
});

// Re-export expect
export { expect };

// Make test and expect available globally
declare global {
  const test: typeof import("./playwright-globals").test;
  const expect: typeof import("./playwright-globals").expect;
}

// Assign to global object
(globalThis as any).test = test;
(globalThis as any).expect = expect;
