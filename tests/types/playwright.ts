/**
 * Test type definitions for Playwright fixtures and helpers
 * Provides typed interfaces for common Playwright test patterns
 */

import type { Page, ElectronApplication } from "@playwright/test";
import type { ObsidianTestContext } from "./obsidian";

/**
 * Playwright test fixtures
 */
export interface PlaywrightFixtures {
  page: Page;
  electronApp: ElectronApplication;
  obsidianApp: ObsidianTestContext;
}

/**
 * Re-export Playwright types for convenience
 */
export type { Page, ElectronApplication };
