import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { dasherize } from "inflection";

import type { Page, ElectronApplication } from "playwright";
import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";

import { toggleSidebar } from "./global";

/**
 * Shared context for all e2e tests
 * Provides access to the global Electron instance with worker isolation
 */
export interface SharedTestContext {
  page: Page;
  electronApp: ElectronApplication;
  testId: string;
  vaultPath: string;
  dataPath: string;
  workerId: string;
  logs: Array<{ type: string; text: string; timestamp: Date }>;
}

// Map of worker-specific contexts for parallel execution
const workerContexts = new Map<string, SharedTestContext>();

/**
 * Get the current worker ID for test isolation
 * Uses process.env.VITEST_WORKER_ID or falls back to process.pid
 */
function getWorkerId(): string {
  // Vitest sets VITEST_WORKER_ID for each worker process
  const workerId =
    process.env.VITEST_WORKER_ID ||
    process.env.VITEST_POOL_ID ||
    process.pid.toString();
  return `worker-${workerId}`;
}

/**
 * Sets up common e2e test hooks and returns a context proxy
 * This eliminates duplication of beforeAll/beforeEach/afterEach/afterAll setup across test files
 * Includes automatic plugin settings reset and screenshot capture on test failure
 *
 * Usage:
 * ```typescript
 * describe("My Test", () => {
 *   const context = setupE2ETestHooks();
 *
 *   test("my test", async () => {
 *     await context.page.click(...);
 *   });
 * });
 * ```
 */
export function setupE2ETestHooks(): SharedTestContext {
  let context: SharedTestContext;
  let currentTestName = "unknown-test";

  beforeEach(async (testContext) => {
    currentTestName = testContext.task.name;
    console.log(`🧪 Setting up test: ${currentTestName}`);

    // Create a fresh isolated context for each test
    context = await createFreshTestContext();
    console.log(`📁 Using fresh vault: ${context.vaultPath}`);

    // Create test folders in the fresh environment
    await createTestFolders(context.page);

    // Reset UI state
    await resetObsidianUI(context.page);

    // Reload plugin settings to ensure clean state
    await reloadPluginSettings(context.page);

    console.log(`✅ Test setup complete for: ${currentTestName}`);
  });

  afterEach(async (testContext) => {
    if (!context) return;

    if (testContext.task?.result?.state === "fail") {
      await captureFullDebugInfo(
        context,
        `test-failure-${dasherize(currentTestName)}`
      );
    }

    // Clean up the test context completely
    await cleanupTestContext(context);
  });

  afterAll(async () => {
    // Note: Global cleanup is handled by vitest.playwright.config.mjs globalTeardown
    // Individual worker contexts are cleaned up there to avoid race conditions
  });

  // Return a Proxy that delegates to the context once it's available
  return new Proxy({} as SharedTestContext, {
    get(_target, prop) {
      if (!context) {
        throw new Error(
          `Context not yet initialized. Make sure you're accessing context properties inside test functions, not at the top level.`
        );
      }

      return context[prop as keyof SharedTestContext];
    },

    set(_target, prop, value) {
      if (!context) {
        throw new Error(
          `Context not yet initialized. Make sure you're accessing context properties inside test functions, not at the top level.`
        );
      }
      (context as any)[prop] = value;
      return true;
    },
  });
}

/**
 * Create a test folder structure
 */
export async function createTestFolders(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const folders = ["Tasks", "Projects", "Areas", "Templates", "Notes", "Bases"];

    for (const folder of folders) {
      const exists = await app.vault.adapter.exists(folder);
      if (!exists) {
        await app.vault.createFolder(folder);
      } else {
      }
    }
  });
}

/**
 * Setup Obsidian with Playwright/Electron
 * Launches Obsidian, waits for initialization, and enables the task-sync plugin
 * @param vaultPath Required vault path for testing
 * @param dataDir Required data directory for testing
 */
export async function setupObsidianElectron(
  vaultPath: string,
  dataDir: string,
  logs: Array<{ type: string; text: string; timestamp: Date }>
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const { _electron: electron } = await import("playwright");

  // Check for different possible Obsidian structures
  const mainJsPath = path.resolve("./.obsidian-unpacked/main.js");
  const appExtractedMainJs = path.resolve(
    "./.obsidian-unpacked/app-extracted/main.js"
  );
  const obsidianBinaryPath = path.resolve("./.obsidian-unpacked/obsidian");
  const appAsarPath = path.resolve("./.obsidian-unpacked/resources/app.asar");

  let appPath: string;
  if (fs.existsSync(appExtractedMainJs)) {
    appPath = appExtractedMainJs;
  } else if (fs.existsSync(mainJsPath)) {
    appPath = mainJsPath;
  } else if (fs.existsSync(appAsarPath)) {
    appPath = obsidianBinaryPath;
  } else if (fs.existsSync(obsidianBinaryPath)) {
    // Fallback to binary
    appPath = obsidianBinaryPath;
  } else {
    throw new Error(
      `Unpacked Obsidian not found. Checked: ${appExtractedMainJs}, ${mainJsPath}, ${appAsarPath}, ${obsidianBinaryPath}. ` +
        "Please run: npm run setup:obsidian-playwright"
    );
  }

  const resolvedVaultPath = path.resolve(vaultPath);
  const userDataDir = path.resolve(dataDir);

  // Determine if we should run in headless mode
  const isHeadless =
    process.env.E2E_HEADLESS === "false"
      ? false
      : process.env.CI === "true" ||
        process.env.E2E_HEADLESS === "true" ||
        process.env.DISPLAY === undefined ||
        process.env.DISPLAY === "";

  // Prepare launch arguments for Electron
  const launchArgs = [
    appPath,
    "--user-data-dir=" + userDataDir,
    "open",
    `obsidian://open?path=${encodeURIComponent(resolvedVaultPath)}`,
    // Add window size arguments
    "--window-size=1920,1080",
    "--force-device-scale-factor=1",
  ];

  // Add sandbox and headless arguments
  const needsSandboxDisabled =
    isHeadless ||
    process.env.CI === "true" ||
    process.env.DISPLAY?.startsWith(":") ||
    !process.env.DISPLAY;

  if (needsSandboxDisabled) {
    launchArgs.push(
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    );
  }

  if (isHeadless) {
    launchArgs.push(
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--disable-web-security",
      "--allow-running-insecure-content",
      "--disable-features=VizDisplayCompositor",
      "--disable-dbus",
      "--disable-default-apps",
      "--disable-component-update"
    );
  }

  // Launch Electron
  const electronApp = await electron.launch({
    args: launchArgs,
    timeout: isHeadless ? 60000 : 30000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      // Additional environment variables for headless stability
      ...(isHeadless && {
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
        ELECTRON_ENABLE_LOGGING: "false",
        // Don't override DISPLAY if it's already set by xvfb-run
        // Only set a fallback if DISPLAY is completely missing
        ...(!process.env.DISPLAY && { DISPLAY: ":99" }),
      }),
    },
  });

  let page;

  page = await electronApp.firstWindow({ timeout: isHeadless ? 60000 : 30000 });

  page.on("console", (msg) => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date(),
    });

    console.log("[Obsidian]", msg.text());
  });

  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.waitForFunction(
    () => {
      const app = (window as any).app;
      const hasApp = typeof app !== "undefined";
      const hasWorkspace = hasApp && app.workspace !== undefined;
      const isLayoutReady = hasWorkspace && app.workspace.layoutReady === true;

      // Log progress for debugging
      if (!hasApp) {
        console.log("🔍 Waiting for app object...");
      } else if (!hasWorkspace) {
        console.log("🔍 App found, waiting for workspace...");
      } else if (!isLayoutReady) {
        console.log("🔍 Workspace found, waiting for layout to be ready...");
      }

      return isLayoutReady;
    },
    { timeout: 90000 }
  );

  // Enable plugins
  await page.evaluate(() => {
    (window as any).app.plugins.setEnable(true);
  });

  console.log("🔌 Enabling task-sync plugin...");

  await page.evaluate(async () => {
    const app = (window as any).app;

    // Check if plugin is already enabled to prevent double loading
    const isAlreadyEnabled = app.plugins.isEnabled("obsidian-task-sync");
    console.log("Plugin already enabled:", isAlreadyEnabled);

    if (!isAlreadyEnabled) {
      await app.plugins.enablePlugin("obsidian-task-sync");
    } else {
      console.log("Plugin already enabled, skipping enablePlugin call");
    }
  });

  await waitForTaskSyncPlugin(page);

  return { electronApp, page };
}

/**
 * Wait for the Task Sync plugin to be fully loaded and ready
 */
export async function waitForTaskSyncPlugin(
  page: Page,
  timeout: number = 2000
): Promise<void> {
  await page.waitForFunction(
    () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return plugin && plugin.settings;
    },
    { timeout }
  );
}

/**
 * Create a fresh test context for each test (proper isolation)
 */
export async function createFreshTestContext(): Promise<SharedTestContext> {
  // Create a unique test ID for this specific test
  const testId = randomUUID();
  const workerId = getWorkerId();

  // Create isolated environment for this test
  const {
    testId: envTestId,
    vaultPath,
    dataPath,
  } = await createIsolatedTestEnvironment(testId);

  let electronApp: any, page: any;
  let logs = [] as Array<{ type: string; text: string; timestamp: Date }>;

  const result = await setupObsidianElectron(vaultPath, dataPath, logs);

  electronApp = result.electronApp;
  page = result.page;

  const context: SharedTestContext = {
    electronApp,
    page,
    testId: envTestId,
    vaultPath,
    dataPath,
    workerId,
    logs: logs,
  };

  return context;
}

/**
 * Clean up a test context completely
 */
export async function cleanupTestContext(
  context: SharedTestContext
): Promise<void> {
  try {
    // Close the page first
    if (context.page && !context.page.isClosed()) {
      await context.page.close();
    }

    // Close the Electron app
    if (context.electronApp) {
      await context.electronApp.close();
    }

    // Clean up the isolated environment
    await cleanupIsolatedTestEnvironment(context.testId);
  } catch (error) {
    console.warn(`⚠️ Error cleaning up test context:`, error);
  }
}

/**
 * Get the shared test context with worker isolation (legacy - kept for compatibility)
 */
export async function getSharedTestContext(): Promise<SharedTestContext> {
  const workerId = getWorkerId();

  // Check if we already have a context for this worker
  const existingContext = workerContexts.get(workerId);
  if (existingContext) {
    return existingContext;
  }

  // Create isolated environment for this worker
  const { testId, vaultPath, dataPath } = await createIsolatedTestEnvironment(
    workerId
  );

  let electronApp: any, page: any;
  let logs = [] as Array<{ type: string; text: string; timestamp: Date }>;

  const result = await setupObsidianElectron(vaultPath, dataPath, logs);

  electronApp = result.electronApp;
  page = result.page;

  const context: SharedTestContext = {
    electronApp,
    page,
    testId,
    vaultPath,
    dataPath,
    workerId,
    logs: logs,
  };

  workerContexts.set(workerId, context);

  return context;
}

/**
 * Reset the test environment for the next test
 * This cleans up test state while reusing the Electron instance
 */
export async function resetTestEnvironment(
  context: SharedTestContext
): Promise<void> {
  try {
    // Clear vault files (except .obsidian directory)
    await clearVaultFiles(context.vaultPath);

    // Reset plugin data to clean state
    await resetPluginData(context.page);

    // Clear any cached data in the plugin
    await clearPluginCaches(context.page);
  } catch (error) {
    console.error("❌ Error during test environment reset:", error);
    throw error;
  }
}

/**
 * Clear vault files while preserving essential directories
 */
async function clearVaultFiles(vaultPath: string): Promise<void> {
  try {
    const entries = await fs.promises.readdir(vaultPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = path.join(vaultPath, entry.name);

      if (entry.name === ".obsidian") {
        // Skip .obsidian directory completely to preserve plugin configuration
        continue;
      } else if (entry.name === "Templates" || entry.name === "Bases") {
        // Clear contents of Templates and Bases directories but preserve the directories
        if (entry.isDirectory()) {
          await clearDirectoryContents(fullPath, []);
        }
      } else {
        // Remove everything else
        try {
          if (entry.isDirectory()) {
            await fs.promises.rm(fullPath, { recursive: true, force: true });
          } else {
            await fs.promises.unlink(fullPath);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to remove ${fullPath}:`, error.message);
        }
      }
    }

    // Ensure essential directories exist
    const templatesDir = path.join(vaultPath, "Templates");
    const basesDir = path.join(vaultPath, "Bases");
    await fs.promises.mkdir(templatesDir, { recursive: true });
    await fs.promises.mkdir(basesDir, { recursive: true });
  } catch (error) {
    console.error(`❌ Error clearing vault files in ${vaultPath}:`, error);
    throw error;
  }
}

/**
 * Reset plugin data to clean state
 */
async function resetPluginData(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (plugin) {
      // Clear stores
      if (plugin.taskStore) plugin.taskStore.clear();
      if (plugin.projectStore) plugin.projectStore.clear();
      if (plugin.areaStore) plugin.areaStore.clear();
      if (plugin.taskMentionStore) plugin.taskMentionStore.clear();

      // Reset settings to defaults
      plugin.settings = { ...plugin.defaultSettings };
    }
  });
}

/**
 * Clear plugin caches
 */
async function clearPluginCaches(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (plugin) {
      // Clear individual caches if they exist
      if (
        plugin.cacheManager &&
        typeof plugin.cacheManager.clear === "function"
      ) {
        plugin.cacheManager.clear();
      }

      // Clear any other cache-like structures
      if (
        plugin.githubService &&
        typeof plugin.githubService.clearCache === "function"
      ) {
        plugin.githubService.clearCache();
      }

      if (
        plugin.appleRemindersService &&
        typeof plugin.appleRemindersService.clearCache === "function"
      ) {
        plugin.appleRemindersService.clearCache();
      }
    }
  });
}

/**
 * Reset Obsidian UI state by closing modals and dialogs
 * Improved for headless mode stability
 */
export async function resetObsidianUI(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Force close any open modals
  await page.evaluate(() => {
    const modals = document.querySelectorAll(
      ".modal-container, .modal-backdrop, .suggester-container, .prompt, .modal"
    );

    modals.forEach((modal) => {
      try {
        const closeButton = modal.querySelector(
          '.modal-close-button, .modal-close, .close, [aria-label="Close"]'
        );
        if (closeButton) {
          (closeButton as HTMLElement).click();
        } else {
          modal.remove();
        }
      } catch (error) {
        console.warn("Error closing modal:", error);
      }
    });
  });

  // Wait briefly for modals to close
  await page.waitForTimeout(500);

  // Final cleanup
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Force remove any remaining modals and reset focus
  await page.evaluate(() => {
    try {
      const modals = document.querySelectorAll(
        ".modal-container, .modal-backdrop, .suggester-container, .prompt"
      );
      modals.forEach((modal) => {
        try {
          modal.remove();
        } catch (error) {
          console.warn("Error removing modal:", error);
        }
      });

      if (document.activeElement && document.activeElement !== document.body) {
        try {
          (document.activeElement as HTMLElement).blur();
        } catch (error) {
          console.warn("Error blurring active element:", error);
        }
      }

      if (window.getSelection) {
        try {
          window.getSelection()?.removeAllRanges();
        } catch (error) {
          console.warn("Error clearing selection:", error);
        }
      }
    } catch (error) {
      console.warn("Error in final UI cleanup:", error);
    }
  });

  await toggleSidebar(page, "left", false);
  await toggleSidebar(page, "right", false);

  // Close any open daily planning views and task planning views
  await page.evaluate(() => {
    try {
      const app = (window as any).app;
      if (app?.workspace) {
        // Close daily planning views
        app.workspace.detachLeavesOfType("daily-planning");

        // Also close task planning views to ensure clean state
        app.workspace.detachLeavesOfType("task-planning");

        // Force close any remaining planning-related views
        const allLeaves = app.workspace.getLeavesOfType("daily-planning");
        allLeaves.forEach((leaf: any) => {
          try {
            leaf.detach();
          } catch (e) {
            console.warn("Error detaching daily planning leaf:", e);
          }
        });

        const taskPlanningLeaves =
          app.workspace.getLeavesOfType("task-planning");
        taskPlanningLeaves.forEach((leaf: any) => {
          try {
            leaf.detach();
          } catch (e) {
            console.warn("Error detaching task planning leaf:", e);
          }
        });
      }

      // Additional cleanup: wait a bit for view destruction to complete
      // The onDestroy lifecycle of DailyPlanningView should handle store cleanup
      setTimeout(() => {
        // Force a small delay to ensure cleanup completes
      }, 100);
    } catch (error) {
      console.warn("Error closing planning views:", error);
    }
  });
}

/**
 * Reload plugin settings from disk to ensure clean state between tests
 */
async function reloadPluginSettings(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (plugin && plugin.loadSettings) {
      console.log("🔄 Reloading plugin settings from disk for test isolation");
      await plugin.loadSettings();
    }
  });
}

/**
 * Reset UI state for the next test
 * This should be called in beforeEach hooks
 * Note: This is now simplified since we use fresh environments per test
 */
export async function resetSharedTestContext(): Promise<void> {
  const context = await getSharedTestContext();
  await resetObsidianUI(context.page);

  // Reload plugin settings from disk to ensure clean state
  await reloadPluginSettings(context.page);
}

/**
 * Reset vault and data directories to pristine state
 * Preserves plugin files to avoid rebuilding
 */
async function resetVaultToPristineState(
  vaultPath: string,
  dataPath: string
): Promise<void> {
  // Step 1: Preserve plugin code files (but not settings) before vault reset
  const pluginDir = path.join(
    vaultPath,
    ".obsidian",
    "plugins",
    "obsidian-task-sync"
  );
  const tempPluginDir = path.join(
    path.dirname(vaultPath),
    "temp-plugin-backup"
  );

  let pluginCodeFilesExist = false;
  if (fs.existsSync(pluginDir)) {
    // Only backup code files, not settings (data.json)
    await fs.promises.mkdir(tempPluginDir, { recursive: true });
    const entries = await fs.promises.readdir(pluginDir);
    for (const entry of entries) {
      if (entry !== "data.json") {
        const srcPath = path.join(pluginDir, entry);
        const destPath = path.join(tempPluginDir, entry);
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
    pluginCodeFilesExist = true;
  }

  // Step 2: Clear vault contents (except .obsidian directory initially)
  await clearDirectoryContents(vaultPath, [".obsidian"]);

  // Step 3: Restore pristine vault contents
  const pristineVaultPath = path.resolve("./tests/vault/Test.pristine");

  if (fs.existsSync(pristineVaultPath)) {
    await copyDirectoryContents(pristineVaultPath, vaultPath);
  } else {
    console.warn(`⚠️ Pristine vault not found at ${pristineVaultPath}`);
  }

  // Step 4: Reset data directory
  await clearDirectoryContents(dataPath);
  const pristineDataPath = path.resolve("./e2e/obsidian-data.pristine");

  if (fs.existsSync(pristineDataPath)) {
    await copyDirectoryContents(pristineDataPath, dataPath);

    // Update obsidian.json to point to the correct vault path
    const obsidianJsonPath = path.join(dataPath, "obsidian.json");

    if (fs.existsSync(obsidianJsonPath)) {
      const obsidianConfig = JSON.parse(
        await fs.promises.readFile(obsidianJsonPath, "utf8")
      );

      if (obsidianConfig.vaults) {
        for (const vaultId in obsidianConfig.vaults) {
          obsidianConfig.vaults[vaultId].path = vaultPath;
        }
      }

      await fs.promises.writeFile(
        obsidianJsonPath,
        JSON.stringify(obsidianConfig, null, 2)
      );
    }
  }

  // Step 5: Restore plugin code files (only if plugin directory doesn't exist)
  // If plugin is already loaded, don't restore files as it will trigger a reload
  if (pluginCodeFilesExist && !fs.existsSync(pluginDir)) {
    await fs.promises.mkdir(pluginDir, { recursive: true });
    // Copy individual files (excluding data.json which should come from pristine vault)
    const entries = await fs.promises.readdir(tempPluginDir);
    for (const entry of entries) {
      const srcPath = path.join(tempPluginDir, entry);
      const destPath = path.join(pluginDir, entry);
      await fs.promises.copyFile(srcPath, destPath);
    }
    await fs.promises.rm(tempPluginDir, { recursive: true, force: true });
  } else if (pluginCodeFilesExist) {
    // Clean up temp directory even if we don't restore
    await fs.promises.rm(tempPluginDir, { recursive: true, force: true });
  }
}

/**
 * Clean up all worker contexts and isolated environments
 * This should be called during global teardown
 */
export async function cleanupAllWorkerContexts(): Promise<void> {
  console.log("🧹 Cleaning up all worker contexts...");

  for (const [workerId, context] of workerContexts.entries()) {
    // Close Electron app for this worker
    if (context.electronApp) {
      try {
        // Get the process PID before closing for force cleanup if needed
        const electronProcess = context.electronApp.process();
        const pid = electronProcess?.pid;

        if (context.page && !context.page.isClosed()) {
          await context.page.close();
        }

        // Try graceful close first
        await context.electronApp.close();

        // If we have a PID and the process is still running, force kill it
        if (pid) {
          try {
            process.kill(pid, 0); // Check if process still exists
            process.kill(pid, "SIGTERM");

            // Give it a moment to terminate
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Check if it's still running and force kill if needed
            try {
              process.kill(pid, 0);
              process.kill(pid, "SIGKILL");
            } catch {
              // Process already terminated
            }
          } catch {
            // Process already terminated or doesn't exist
          }
        }
      } catch (error) {}
    }

    // Clean up isolated environment
    await cleanupIsolatedTestEnvironment(context.testId);
  }

  workerContexts.clear();
}

/**
 * Clean up old debug artifacts for a specific test to avoid accumulation
 * Note: Global setup now cleans entire debug directory, but this provides per-test cleanup
 */
async function cleanupOldTestArtifacts(testName: string): Promise<void> {
  const baseDebugDir = path.join(process.cwd(), "e2e", "debug");

  // Clean up old debug directories for this test
  if (fs.existsSync(baseDebugDir)) {
    const entries = await fs.promises.readdir(baseDebugDir, {
      withFileTypes: true,
    });

    const testDebugDirs = entries.filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith(`test-failure-${testName}`)
    );

    for (const dir of testDebugDirs) {
      await fs.promises.rm(path.join(baseDebugDir, dir.name), {
        recursive: true,
        force: true,
      });
    }
  }
}

/**
 * Capture a screenshot for debugging purposes using Playwright Electron support
 */
export async function captureScreenshotOnFailure(
  context: SharedTestContext,
  name: string
): Promise<void> {
  const baseDebugDir = path.join(process.cwd(), "e2e", "debug");
  const testDebugDir = path.join(baseDebugDir, name);

  await fs.promises.mkdir(testDebugDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `screenshot-${timestamp}-${context.workerId}.png`;
  const screenshotPath = path.join(testDebugDir, filename);

  await context.page.screenshot({
    path: screenshotPath,
    fullPage: true,
    type: "png",
    timeout: 10000,
  });
}

/**
 * Copy vault state for debugging failed tests
 */
async function copyVaultForDebug(
  context: SharedTestContext,
  debugDir: string
): Promise<void> {
  const vaultDebugPath = path.join(debugDir, "vault");

  // Copy the entire vault directory
  await copyDirectory(context.vaultPath, vaultDebugPath);

  // Also copy the Obsidian data directory for complete state
  const dataDebugPath = path.join(debugDir, "obsidian-data");
  await copyDirectory(context.dataPath, dataDebugPath);
}

/**
 * Capture a full debugging package including screenshot, console logs, and app state
 */
export async function captureFullDebugInfo(
  context: SharedTestContext,
  name: string
): Promise<void> {
  const baseDebugDir = path.join(process.cwd(), "e2e", "debug");

  // Clean up old debug info for this test first
  await cleanupOldTestArtifacts(name.replace("test-failure-", ""));

  // Use test name without timestamp for consistent directory structure
  const debugDir = path.join(baseDebugDir, name);
  await fs.promises.mkdir(debugDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const filename = `screenshot-${timestamp}-${context.workerId}.png`;
  const screenshotPath = path.join(debugDir, filename);

  await context.page.screenshot({
    path: screenshotPath,
    fullPage: true,
    timeout: 10000,
  });

  const logsPath = path.join(debugDir, `console-logs-${timestamp}.json`);

  await fs.promises.writeFile(logsPath, JSON.stringify(context.logs, null, 2));

  // Capture Obsidian app state
  const appState = await context.page.evaluate(() => {
    const app = (window as any).app;

    // Helper function to safely extract properties without circular references
    const safeExtract = (obj: any, props: string[]) => {
      if (!obj) return null;
      const result: any = {};
      for (const prop of props) {
        try {
          const value = obj[prop];
          // Only include primitive values and simple objects
          if (value !== null && value !== undefined) {
            if (
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean"
            ) {
              result[prop] = value;
            } else if (typeof value === "function") {
              try {
                const called = value.call(obj);
                if (
                  typeof called === "string" ||
                  typeof called === "number" ||
                  typeof called === "boolean"
                ) {
                  result[prop] = called;
                }
              } catch {
                // Ignore function call errors
              }
            }
          }
        } catch {
          // Ignore property access errors
        }
      }
      return result;
    };

    return {
      hasApp: typeof app !== "undefined",
      hasWorkspace: app && typeof app.workspace !== "undefined",
      layoutReady: app && app.workspace && app.workspace.layoutReady,
      plugins: app && app.plugins ? Object.keys(app.plugins.plugins || {}) : [],
      activeLeaf:
        app && app.workspace && app.workspace.activeLeaf
          ? {
              type: app.workspace.activeLeaf.view?.getViewType?.(),
              title: app.workspace.activeLeaf.view?.getDisplayText?.(),
            }
          : null,
      vault:
        app && app.vault
          ? {
              name: app.vault.getName?.(),
              // Safely extract path without circular references
              adapterType: app.vault.adapter?.constructor?.name || "unknown",
              // Try to get path safely - avoid the full adapter object
              basePath:
                typeof app.vault.adapter?.path === "string"
                  ? app.vault.adapter.path
                  : "unavailable",
            }
          : null,
    };
  });

  const statePath = path.join(debugDir, `app-state-${timestamp}.json`);
  await fs.promises.writeFile(statePath, JSON.stringify(appState, null, 2));

  // Capture complete HTML structure of the Obsidian electron app
  if (!context.page || context.page.isClosed()) {
    console.warn(`⚠️ Page is not available for HTML structure capture`);
  } else {
    const htmlStructure = await context.page.evaluate(() => {
      // Capture the complete DOM structure
      const htmlContent = document.documentElement.outerHTML;

      // Also capture useful metadata about the page state
      const metadata = {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        documentElement: {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
        },
        activeElement: document.activeElement
          ? {
              tagName: document.activeElement.tagName,
              className: document.activeElement.className,
              id: document.activeElement.id,
            }
          : null,
        visibleElements: {
          modals: document.querySelectorAll(".modal-container, .modal-backdrop")
            .length,
          sidebars: document.querySelectorAll(
            ".workspace-ribbon, .side-dock-ribbon"
          ).length,
          leaves: document.querySelectorAll(".workspace-leaf").length,
          views: document.querySelectorAll("[data-type]").length,
        },
      };

      return { htmlContent, metadata };
    });

    // Save the complete HTML structure
    const htmlPath = path.join(debugDir, `html-structure-${timestamp}.html`);
    await fs.promises.writeFile(htmlPath, htmlStructure.htmlContent, "utf8");

    // Save the metadata separately for easier analysis
    const metadataPath = path.join(debugDir, `html-metadata-${timestamp}.json`);
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(htmlStructure.metadata, null, 2)
    );

    console.log(
      `🌐 HTML structure captured: ${htmlPath} (${Math.round(
        htmlStructure.htmlContent.length / 1024
      )}KB)`
    );

    console.log(`📋 HTML metadata captured: ${metadataPath}`);

    await copyVaultForDebug(context, debugDir);
  }
}

/**
 * Create an isolated test environment with unique vault and data directories
 * @param workerId Optional worker ID for consistent naming across worker processes
 */
export async function createIsolatedTestEnvironment(
  workerId?: string
): Promise<{ testId: string; vaultPath: string; dataPath: string }> {
  const testId = workerId || randomUUID();
  const baseTestDir = path.resolve("./e2e/test-environments");
  const testDir = path.join(baseTestDir, testId);
  const vaultPath = path.join(testDir, "vault");
  const dataPath = path.join(testDir, "data");

  // Ensure base test directory exists
  await fs.promises.mkdir(baseTestDir, { recursive: true });
  await fs.promises.mkdir(testDir, { recursive: true });

  const pristineVaultPath = path.resolve("./tests/vault/Test.pristine");
  await copyDirectory(pristineVaultPath, vaultPath);

  const pristineDataPath = path.resolve("./e2e/obsidian-data.pristine");
  await copyDirectory(pristineDataPath, dataPath);

  // Update obsidian.json to point to the isolated vault path
  const obsidianJsonPath = path.join(dataPath, "obsidian.json");
  if (fs.existsSync(obsidianJsonPath)) {
    const obsidianConfig = JSON.parse(
      await fs.promises.readFile(obsidianJsonPath, "utf8")
    );

    // Update all vault paths to point to the isolated vault
    if (obsidianConfig.vaults) {
      for (const vaultId in obsidianConfig.vaults) {
        obsidianConfig.vaults[vaultId].path = vaultPath;
      }
    }

    await fs.promises.writeFile(
      obsidianJsonPath,
      JSON.stringify(obsidianConfig, null, 2)
    );
  }

  // Copy the freshly built plugin files to the test environment
  await copyBuiltPluginToTestEnvironment(vaultPath);

  return { testId, vaultPath, dataPath };
}

/**
 * Clean up isolated test environment
 */
export async function cleanupIsolatedTestEnvironment(
  testId: string
): Promise<void> {
  const baseTestDir = path.resolve("./e2e/test-environments");
  const testDir = path.join(baseTestDir, testId);

  if (fs.existsSync(testDir)) {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  }
}

/**
 * Copy the freshly built plugin files to the test environment
 */
async function copyBuiltPluginToTestEnvironment(
  vaultPath: string
): Promise<void> {
  const pluginDir = path.join(
    vaultPath,
    ".obsidian",
    "plugins",
    "obsidian-task-sync"
  );

  // Ensure plugin directory exists
  await fs.promises.mkdir(pluginDir, { recursive: true });

  // Copy the freshly built files from the project root
  const projectRoot = path.resolve(".");
  const filesToCopy = ["main.js", "manifest.json", "styles.css"];

  for (const file of filesToCopy) {
    const srcPath = path.join(projectRoot, file);
    const destPath = path.join(pluginDir, file);

    if (fs.existsSync(srcPath)) {
      await fs.promises.copyFile(srcPath, destPath);
    } else {
      console.warn(`⚠️ Built file ${file} not found at ${srcPath}`);
    }
  }
}

/**
 * Recursively copy directory
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });

  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      try {
        await fs.promises.copyFile(srcPath, destPath);
      } catch (error) {}
    }
  }
}

/**
 * Copy contents of source directory to destination directory
 * Does not create the destination directory itself, only copies contents
 */
async function copyDirectoryContents(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });

  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Clear all contents of a directory while preserving the directory itself
 * @param dirPath Directory to clear
 * @param preservePaths Optional array of paths to preserve (relative to dirPath)
 */
async function clearDirectoryContents(
  dirPath: string,
  preservePaths: string[] = []
): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (preservePaths.includes(entry.name)) {
      continue;
    }

    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await fs.promises.rm(entryPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(entryPath);
    }
  }
}
