import type { Page, ElectronApplication } from "playwright";
import { resetObsidianUI } from "./plugin-setup";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";

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
 * Get the shared test context with worker isolation
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

  // Create Electron instance using simplified setup
  const { setupObsidianElectron } = await import("./task-sync-setup");
  let electronApp: any, page: any;

  try {
    const result = await setupObsidianElectron(vaultPath, dataPath);
    electronApp = result.electronApp;
    page = result.page;
  } catch (setupError) {
    console.error(
      `❌ Failed to setup Obsidian for ${workerId}:`,
      setupError.message
    );

    // Try to capture any available debug information
    try {
      // If we have a partial setup, try to capture what we can
      if (setupError.electronApp) {
        const tempContext = {
          electronApp: setupError.electronApp,
          page: setupError.page,
          testId,
          vaultPath,
          dataPath,
          workerId,
        };
        await captureFullDebugInfo(tempContext, `setup-failure-${workerId}`);
      }
    } catch (debugError) {
      console.warn(
        `⚠️ Could not capture debug info for setup failure: ${debugError.message}`
      );
    }

    throw setupError;
  }

  const context: SharedTestContext = {
    electronApp,
    page,
    testId,
    vaultPath,
    dataPath,
    workerId,
  };

  // Store context for this worker
  workerContexts.set(workerId, context);

  return context;
}

/**
 * Reset UI state for the next test
 * This should be called in beforeEach hooks
 */
export async function resetSharedTestContext(): Promise<void> {
  const context = await getSharedTestContext();
  await resetObsidianUI(context.page);
}

/**
 * Clean up test-specific state
 * This should be called in afterEach hooks
 * Resets the entire vault to pristine state for complete test isolation
 */
export async function cleanupTestState(): Promise<void> {
  const context = await getSharedTestContext();

  await resetObsidianUI(context.page);
  await resetVaultToPristineState(context.vaultPath, context.dataPath);
}

/**
 * Reset vault and data directories to pristine state
 * Preserves plugin files to avoid rebuilding
 */
async function resetVaultToPristineState(
  vaultPath: string,
  dataPath: string
): Promise<void> {
  // Step 1: Preserve plugin files before vault reset
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

  let pluginFilesExist = false;
  if (fs.existsSync(pluginDir)) {
    await copyDirectory(pluginDir, tempPluginDir);
    pluginFilesExist = true;
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
      try {
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
      } catch (error) {
        console.warn(`⚠️ Failed to update obsidian.json: ${error.message}`);
      }
    }
  }

  // Step 5: Restore plugin files
  if (pluginFilesExist) {
    await fs.promises.mkdir(pluginDir, { recursive: true });
    await copyDirectoryContents(tempPluginDir, pluginDir);
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
    try {
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
        } catch (error) {
          console.log(
            `⚠️ Error closing Electron app for ${workerId}:`,
            error.message
          );
        }
      }

      // Clean up isolated environment
      await cleanupIsolatedTestEnvironment(context.testId);
    } catch (error) {
      console.log(`⚠️ Error cleaning up ${workerId}:`, error.message);
    }
  }

  workerContexts.clear();
}

/**
 * Clean up old debug artifacts for a specific test to avoid accumulation
 * Note: Global setup now cleans entire debug directory, but this provides per-test cleanup
 */
async function cleanupOldTestArtifacts(testName: string): Promise<void> {
  try {
    const baseDebugDir = path.join(process.cwd(), "e2e", "debug");

    // Clean up old debug directories for this test
    if (fs.existsSync(baseDebugDir)) {
      const entries = await fs.promises.readdir(baseDebugDir, {
        withFileTypes: true,
      });
      const testDebugDirs = entries.filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith(`test-failure-${testName}`)
      );

      for (const dir of testDebugDirs) {
        try {
          await fs.promises.rm(path.join(baseDebugDir, dir.name), {
            recursive: true,
            force: true,
          });
        } catch (error) {
          console.warn(
            `⚠️ Could not remove old debug directory ${dir.name}: ${error.message}`
          );
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not clean up old test artifacts: ${error.message}`);
  }
}

/**
 * Capture a screenshot for debugging purposes using Playwright Electron support
 */
export async function captureScreenshotOnFailure(
  context: SharedTestContext,
  name: string
): Promise<void> {
  try {
    // Create test-specific directory structure in debug folder
    const baseDebugDir = path.join(process.cwd(), "e2e", "debug");
    const testDebugDir = path.join(baseDebugDir, name);
    await fs.promises.mkdir(testDebugDir, { recursive: true });

    // Clean up old artifacts for this test first
    await cleanupOldTestArtifacts(name.replace("test-failure-", ""));

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `screenshot-${timestamp}-${context.workerId}.png`;
    const screenshotPath = path.join(testDebugDir, filename);

    // Check if page is still available
    if (!context.page || context.page.isClosed()) {
      console.warn(
        `⚠️ Page is not available or closed, trying Electron windows`
      );

      try {
        const windows = context.electronApp.windows();
        if (windows.length > 0) {
          const appScreenshotPath = screenshotPath.replace(
            ".png",
            "-electron.png"
          );
          await windows[0].screenshot({
            path: appScreenshotPath,
            type: "png",
            timeout: 10000,
          });
          return;
        }
      } catch (electronError) {
        console.warn(
          `⚠️ Electron window screenshot failed: ${electronError.message}`
        );
      }
    } else {
      // Try to capture page screenshot first (most detailed)
      try {
        // Wait a moment for any animations to settle
        await context.page.waitForTimeout(500);

        await context.page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: "png",
          timeout: 10000,
        });
        return;
      } catch (pageError) {
        console.warn(`⚠️ Page screenshot failed: ${pageError.message}`);

        // Fallback: try to get all windows and screenshot them
        try {
          const windows = context.electronApp.windows();
          if (windows.length > 0) {
            const appScreenshotPath = screenshotPath.replace(
              ".png",
              "-app.png"
            );
            await windows[0].screenshot({
              path: appScreenshotPath,
              type: "png",
              timeout: 10000,
            });
            return;
          } else {
            console.warn(`⚠️ No Electron windows available for screenshot`);
          }
        } catch (appError) {
          console.warn(
            `⚠️ Electron window screenshot also failed: ${appError.message}`
          );
        }
      }
    }

    // Last resort: capture basic info about the state
    try {
      let debugInfo: any = {
        timestamp: new Date().toISOString(),
        error: "Could not capture screenshot",
        electronAppClosed:
          !context.electronApp || context.electronApp.process()?.killed,
        pageClosed: !context.page || context.page.isClosed(),
      };

      // Try to get page info if available
      if (context.page && !context.page.isClosed()) {
        try {
          const pageInfo = await context.page.evaluate(() => ({
            url: window.location.href,
            title: document.title,
            readyState: document.readyState,
            hasApp: typeof (window as any).app !== "undefined",
            hasObsidian: typeof (window as any).app?.vault !== "undefined",
          }));
          debugInfo = { ...debugInfo, ...pageInfo };
        } catch (evalError) {
          debugInfo.pageEvalError = evalError.message;
        }
      }

      const debugPath = screenshotPath.replace(".png", "-debug.json");
      await fs.promises.writeFile(
        debugPath,
        JSON.stringify(debugInfo, null, 2)
      );
    } catch (debugError) {
      console.warn(`⚠️ Debug info capture failed: ${debugError.message}`);
    }
  } catch (error) {
    console.warn(`⚠️ Screenshot capture completely failed: ${error.message}`);
  }
}

/**
 * Copy vault state for debugging failed tests
 */
async function copyVaultForDebug(
  context: SharedTestContext,
  debugDir: string
): Promise<void> {
  try {
    const vaultDebugPath = path.join(debugDir, "vault");

    // Copy the entire vault directory
    await copyDirectory(context.vaultPath, vaultDebugPath);

    // Also copy the Obsidian data directory for complete state
    const dataDebugPath = path.join(debugDir, "obsidian-data");
    await copyDirectory(context.dataPath, dataDebugPath);
  } catch (error) {
    console.warn(`⚠️ Failed to copy vault state: ${error.message}`);
  }
}

/**
 * Capture a full debugging package including screenshot, console logs, and app state
 */
export async function captureFullDebugInfo(
  context: SharedTestContext,
  name: string,
  consoleLogs?: Array<{ type: string; text: string; timestamp: Date }>
): Promise<void> {
  try {
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

    await copyVaultForDebug(context, debugDir);

    try {
      let logs = consoleLogs || [];

      // If no console logs provided, try to get them from the context if it has the getConsoleLogs method
      if (
        logs.length === 0 &&
        typeof (context as any).getConsoleLogs === "function"
      ) {
        logs = (context as any).getConsoleLogs();
      }

      const logsPath = path.join(debugDir, `console-logs-${timestamp}.json`);
      await fs.promises.writeFile(logsPath, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.warn(`⚠️ Console logs capture failed: ${error.message}`);
    }

    // Capture Obsidian app state
    try {
      const appState = await context.page.evaluate(() => {
        const app = (window as any).app;
        return {
          hasApp: typeof app !== "undefined",
          hasWorkspace: app && typeof app.workspace !== "undefined",
          layoutReady: app && app.workspace && app.workspace.layoutReady,
          plugins:
            app && app.plugins ? Object.keys(app.plugins.plugins || {}) : [],
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
                  path: app.vault.adapter?.path,
                }
              : null,
        };
      });

      const statePath = path.join(debugDir, `app-state-${timestamp}.json`);
      await fs.promises.writeFile(statePath, JSON.stringify(appState, null, 2));
    } catch (error) {
      console.warn(`⚠️ App state capture failed: ${error.message}`);
    }

    // Capture complete HTML structure of the Obsidian electron app
    try {
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
              modals: document.querySelectorAll(
                ".modal-container, .modal-backdrop"
              ).length,
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
        const htmlPath = path.join(
          debugDir,
          `html-structure-${timestamp}.html`
        );
        await fs.promises.writeFile(
          htmlPath,
          htmlStructure.htmlContent,
          "utf8"
        );

        // Save the metadata separately for easier analysis
        const metadataPath = path.join(
          debugDir,
          `html-metadata-${timestamp}.json`
        );
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
      }
    } catch (error) {
      console.warn(`⚠️ HTML structure capture failed: ${error.message}`);
    }
  } catch (error) {
    console.warn(`⚠️ Full debug info capture failed: ${error.message}`);
  }
}

export async function executeCommand(
  context: SharedTestContext,
  command: string
): Promise<void> {
  await context.page.keyboard.press("Control+P");
  await context.page.waitForSelector(".prompt-input");
  await context.page.fill(".prompt-input", command);
  await context.page.keyboard.press("Enter");
}

/**
 * Wait for and check if a notice with specific text appears
 */
export async function waitForNotice(
  context: SharedTestContext,
  expectedText: string,
  timeout: number = 5000
): Promise<boolean> {
  try {
    await context.page.waitForFunction(
      ({ text }) => {
        const noticeElements = document.querySelectorAll(".notice");
        const notices = Array.from(noticeElements).map(
          (el) => el.textContent || ""
        );
        return notices.some((notice) => notice.includes(text));
      },
      { text: expectedText },
      { timeout }
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for and verify that a notice with specific text appears using expect
 * Enhanced to wait for notices to appear and provide better debugging
 */
export async function expectNotice(
  context: SharedTestContext,
  expectedText: string,
  timeout: number = 10000
): Promise<void> {
  // First wait for any notice to appear
  try {
    await context.page.waitForSelector(".notice", {
      timeout: Math.min(timeout, 5000),
    });
  } catch (error) {
    // If no notice appears at all, take a screenshot for debugging
    await captureScreenshotOnFailure(
      context,
      `no-notice-appeared-${expectedText.replace(/[^a-zA-Z0-9]/g, "-")}`
    );
    throw new Error(
      `No notice appeared within ${Math.min(
        timeout,
        5000
      )}ms. Expected notice containing: "${expectedText}"`
    );
  }

  // Then wait for the specific notice text
  const noticeAppeared = await waitForNotice(context, expectedText, timeout);

  if (!noticeAppeared) {
    // Get current notices for debugging
    const currentNotices = await context.page.evaluate(() => {
      const noticeElements = document.querySelectorAll(".notice");
      return Array.from(noticeElements).map((el) => el.textContent || "");
    });

    await captureScreenshotOnFailure(
      context,
      `wrong-notice-${expectedText.replace(/[^a-zA-Z0-9]/g, "-")}`
    );

    throw new Error(
      `Expected notice containing "${expectedText}" did not appear within ${timeout}ms. ` +
        `Current notices: ${JSON.stringify(currentNotices)}`
    );
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

  // Copy pristine vault to isolated vault
  const pristineVaultPath = path.resolve("./tests/vault/Test.pristine");
  if (fs.existsSync(pristineVaultPath)) {
    await copyDirectory(pristineVaultPath, vaultPath);
  } else {
    // Create minimal vault if pristine doesn't exist
    await fs.promises.mkdir(vaultPath, { recursive: true });
    console.log(
      `⚠️ Pristine vault not found at ${pristineVaultPath}, created empty vault`
    );
  }

  // Copy pristine data directory to isolated data directory
  const pristineDataPath = path.resolve("./e2e/obsidian-data.pristine");
  if (fs.existsSync(pristineDataPath)) {
    await copyDirectory(pristineDataPath, dataPath);

    // Update obsidian.json to point to the isolated vault path
    const obsidianJsonPath = path.join(dataPath, "obsidian.json");
    if (fs.existsSync(obsidianJsonPath)) {
      try {
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
      } catch (error) {
        console.warn(
          `⚠️ Failed to update obsidian.json vault path: ${error.message}`
        );
      }
    }
  } else {
    // Create minimal data directory if pristine doesn't exist
    await fs.promises.mkdir(dataPath, { recursive: true });
    console.log(
      `⚠️ Pristine data not found at ${pristineDataPath}, created empty data directory`
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
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.log(
        `⚠️ Failed to cleanup test environment ${testId}:`,
        error.message
      );
    }
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

  try {
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
  } catch (error) {
    console.error(
      `❌ Failed to copy built plugin to test environment: ${error.message}`
    );
    throw error;
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
      await fs.promises.copyFile(srcPath, destPath);
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
    // Skip preserved paths
    if (preservePaths.includes(entry.name)) {
      continue;
    }

    const entryPath = path.join(dirPath, entry.name);

    try {
      if (entry.isDirectory()) {
        await fs.promises.rm(entryPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(entryPath);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to remove ${entryPath}: ${error.message}`);
    }
  }
}

/**
 * Reset plugin settings to pristine state
 * This ensures each test starts with clean, default settings
 */
async function resetPluginSettings(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin) {
        // Reset to default settings structure
        plugin.settings = {
          tasksFolder: "Tasks",
          projectsFolder: "Projects",
          areasFolder: "Areas",
          templateFolder: "Templates",
          useTemplater: false,
          defaultTaskTemplate: "Task.md",
          defaultProjectTemplate: "project-template.md",
          defaultAreaTemplate: "area-template.md",
          defaultParentTaskTemplate: "parent-task-template.md",
          // Base-related defaults
          basesFolder: "Bases",
          tasksBaseFile: "Tasks.base",
          autoGenerateBases: true,
          autoUpdateBaseViews: true,
          // Task types defaults
          taskTypes: [
            { name: "Task", color: "blue" },
            { name: "Bug", color: "red" },
            { name: "Feature", color: "green" },
            { name: "Improvement", color: "purple" },
            { name: "Chore", color: "gray" },
          ],
          // Task priorities defaults
          taskPriorities: [
            { name: "Low", color: "green" },
            { name: "Medium", color: "yellow" },
            { name: "High", color: "orange" },
            { name: "Urgent", color: "red" },
          ],
          // Task statuses defaults
          taskStatuses: [
            { name: "Backlog", color: "gray", isDone: false },
            { name: "In Progress", color: "blue", isDone: false },
            { name: "Done", color: "green", isDone: true },
          ],
          // Individual area/project bases defaults
          areaBasesEnabled: true,
          projectBasesEnabled: true,
          autoSyncAreaProjectBases: true,
          // Task property ordering defaults
          taskPropertyOrder: [
            "TITLE",
            "TYPE",
            "PRIORITY",
            "AREAS",
            "PROJECT",
            "DONE",
            "STATUS",
            "PARENT_TASK",
            "TAGS",
          ],
          // GitHub integration defaults
          githubIntegration: {
            enabled: false,
            personalAccessToken: "",
            repositories: [],
            defaultRepository: "",
            issueFilters: {
              state: "open",
              assignee: "",
              labels: [],
            },
          },
          // Apple Reminders integration defaults
          appleRemindersIntegration: {
            enabled: false,
            includeCompletedReminders: false,
            reminderLists: [],
            syncInterval: 60,
            excludeAllDayReminders: false,
            defaultTaskType: "Task",
            importNotesAsDescription: true,
            preservePriority: true,
          },
          // Apple Calendar integration defaults
          appleCalendarIntegration: {
            enabled: false,
            username: "",
            appSpecificPassword: "",
            selectedCalendars: [],
            includeAllDayEvents: true,
            includeBusyEvents: true,
            includeFreeEvents: false,
            daysAhead: 1,
            daysBehind: 0,
            includeLocation: true,
            includeNotes: false,
            timeFormat: "24h" as const,
            defaultArea: "",
            startHour: 8,
            endHour: 18,
            timeIncrement: 15,
            schedulingEnabled: false,
            defaultSchedulingCalendar: "",
            defaultEventDuration: 60,
            defaultReminders: [15],
            includeTaskDetailsInEvent: true,
          },
        };

        await plugin.saveSettings();

        // Force reset of any existing Tasks view to ensure clean state
        const tasksLeaves = app.workspace.getLeavesOfType("tasks");
        for (const leaf of tasksLeaves) {
          const view = leaf.view;
          if (view && view.onClose) {
            await view.onClose();
          }
          if (view && view.onOpen) {
            await view.onOpen();
          }
        }
      } else {
        console.warn("⚠️ Plugin not found during settings reset");
      }
    });
  } catch (error) {
    console.error(`❌ Failed to reset plugin settings: ${error.message}`);
    // Don't throw - this is a cleanup operation that shouldn't fail tests
  }
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
  let consoleLogs: Array<{ type: string; text: string; timestamp: Date }> = [];
  let currentTestName = "unknown-test";

  beforeAll(async () => {
    try {
      context = await getSharedTestContext();
    } catch (error) {
      console.error("❌ beforeAll hook failed:", error.message);
      throw error;
    }

    // Set up console log capture from the Electron app
    context.page.on("console", (msg) => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date(),
      };
      consoleLogs.push(logEntry);

      // Also log to test output for immediate visibility
      console.log(`[Electron ${logEntry.type.toUpperCase()}] ${logEntry.text}`);
    });
  });

  beforeEach(async (testContext) => {
    // Clear console logs for each test
    consoleLogs = [];

    // Get current test name for potential failure capture
    if ((testContext as any)?.task?.name) {
      currentTestName = (testContext as any).task.name;
    } else if ((testContext as any)?.name) {
      currentTestName = (testContext as any).name;
    }

    await resetSharedTestContext();

    // Reset plugin settings to pristine state for each test
    await resetPluginSettings(context.page);
  });

  afterEach(async (testContext) => {
    const context = await getSharedTestContext();

    // Use the test name we captured in beforeEach
    let testName = currentTestName;

    // Clean up test name for file system
    testName = testName.replace(/[^a-zA-Z0-9\s]/g, "-").replace(/\s+/g, "-");

    // Check if test failed by looking at the test context state
    const testFailed =
      (testContext as any)?.state === "fail" ||
      (testContext as any)?.result?.state === "fail" ||
      (testContext as any)?.task?.result?.state === "fail";

    if (testFailed) {
      try {
        // Capture all debug info BEFORE cleanup
        await captureFullDebugInfo(
          context,
          `test-failure-${testName}`,
          consoleLogs
        );
      } catch (captureError) {
        console.error(
          `❌ Failed to capture debug info: ${captureError.message}`
        );

        // Try a simpler screenshot capture as fallback
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const fallbackPath = `e2e/debug/fallback-${testName}-${timestamp}.png`;

          await context.page.screenshot({ path: fallbackPath, fullPage: true });
        } catch (fallbackError) {
          console.error(
            `❌ Even fallback screenshot failed: ${fallbackError.message}`
          );
        }
      }
    }

    await resetVaultToPristineState(context.vaultPath, context.dataPath);
  });

  afterAll(async () => {
    // Force cleanup of any remaining processes
    try {
      if (context?.electronApp) {
        await context.electronApp.close();
      }
    } catch (error) {
      console.log("⚠️ Error during afterAll cleanup:", error.message);
    }
  });

  // Return a Proxy that delegates to the context once it's available
  return new Proxy(
    {} as SharedTestContext & { getConsoleLogs: () => typeof consoleLogs },
    {
      get(_target, prop) {
        if (!context) {
          throw new Error(
            `Context not yet initialized. Make sure you're accessing context properties inside test functions, not at the top level.`
          );
        }

        // Add special method to access console logs
        if (prop === "getConsoleLogs") {
          return () => [...consoleLogs]; // Return a copy to prevent mutation
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
    }
  );
}

/**
 * Helper to open a file and wait for it to load properly
 */
export async function openFile(context: SharedTestContext, filePath: string) {
  await context.page.evaluate(async (path) => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path);

    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    const leaf = app.workspace.getLeaf();
    await leaf.openFile(file);

    await new Promise((resolve) => {
      const checkActive = () => {
        if (app.workspace.getActiveFile()?.path === path) {
          resolve(true);
        } else {
          setTimeout(checkActive, 50);
        }
      };
      checkActive();
    });
  }, filePath);

  await context.page.waitForSelector(
    ".markdown-source-view, .markdown-preview-view",
    { timeout: 5000 }
  );
}

/**
 * Helper to wait for base view to load properly
 */
export async function waitForBaseView(
  context: SharedTestContext,
  timeout = 5000
) {
  await context.page.waitForSelector(".bases-view", { timeout });
  await context.page.waitForSelector(".bases-table-container", {
    timeout: 5000,
  });
}
