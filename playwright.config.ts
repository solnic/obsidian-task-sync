import { defineConfig, devices } from "@playwright/test";
import * as os from "os";

/**
 * Playwright configuration for e2e tests
 * Provides proper configuration for Electron testing with debug artifacts
 *
 * Note on headless mode:
 * - Electron apps on Linux require an X server even in "headless" mode
 * - We use xvfb-maybe (configured in package.json test:e2e script) which automatically:
 *   - Runs xvfb on Linux when no display is available (CI/headless environments)
 *   - Skips xvfb on macOS/Windows or when a display is already available
 * - The viewport size is set to 1920x1080 (Full HD) for consistent test rendering
 */

const isCI = process.env.CI === "true";

export default defineConfig({
  // Test directory
  testDir: "./tests/e2e/specs",

  // Test file patterns
  testMatch: "**/*.e2e.ts",

  // Global setup and teardown
  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),
  globalTeardown: require.resolve("./tests/e2e/global-teardown.ts"),

  // Timeout configuration
  timeout: isCI ? 30000 : 15000,
  expect: {
    timeout: 5000,
  },

  // Test execution configuration
  fullyParallel: false,
  forbidOnly: !!isCI,
  retries: 3,
  workers: isCI
    ? os.cpus().length
    : Math.max(2, Math.floor(os.cpus().length * 0.75)),

  // Reporter configuration
  reporter: [["list"], ["json", { outputFile: "./tests/e2e/results.json" }]],

  // Global test configuration
  use: {
    // Base URL (not applicable for Electron apps)
    // baseURL: undefined,

    // Trace configuration for debugging
    trace: "off",

    // Screenshot configuration
    screenshot: "off",

    // Video configuration
    video: "off",

    // Action timeout
    actionTimeout: 5000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Note: Playwright doesn't have setupFiles like Vitest
  // Global helpers are imported directly in test files

  // Output directory for test artifacts
  outputDir: undefined,

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
