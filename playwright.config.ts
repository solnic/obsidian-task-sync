import { defineConfig, devices } from "@playwright/test";
import * as os from "os";

/**
 * Playwright configuration for e2e tests
 * Provides proper configuration for Electron testing with debug artifacts
 */

const isCI = process.env.CI === "true";

export default defineConfig({
  // Test directory
  testDir: "./tests/e2e/specs/playwright",

  // Test file patterns
  testMatch: "**/*.e2e.ts",

  // Global setup and teardown
  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),
  globalTeardown: require.resolve("./tests/e2e/global-teardown.ts"),

  // Timeout configuration
  timeout: isCI ? 30000 : 10000,
  expect: {
    timeout: 5000,
  },

  // Test execution configuration
  fullyParallel: false,
  forbidOnly: !!isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 6 : Math.max(2, Math.floor(os.cpus().length * 0.75)),

  // Reporter configuration
  reporter: [["list"], ["json", { outputFile: "./tests/e2e/results.json" }]],

  // Global test configuration
  use: {
    // Base URL (not applicable for Electron apps)
    // baseURL: undefined,

    // Trace configuration for debugging
    trace: "retain-on-failure",

    // Screenshot configuration
    screenshot: "only-on-failure",

    // Video configuration
    video: "retain-on-failure",

    // Action timeout
    actionTimeout: 5000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Note: Playwright doesn't have setupFiles like Vitest
  // Global helpers are imported directly in test files

  // Output directory for test artifacts
  outputDir: "./tests/e2e/debug/test-results",

  // Projects configuration (we only need one for Electron)
  projects: [
    {
      name: "electron",
      use: {
        ...devices["Desktop Chrome"],
        // Electron-specific configuration
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  // Web server configuration (not needed for Electron)
  // webServer: undefined,
});
