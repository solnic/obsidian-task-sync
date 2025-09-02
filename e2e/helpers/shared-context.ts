import type { Page, ElectronApplication } from 'playwright';
import { resetObsidianUI } from './plugin-setup';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest';

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
  const workerId = process.env.VITEST_WORKER_ID ||
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

  console.log(`🔧 Creating test environment for ${workerId}`);

  // Create isolated environment for this worker
  const { testId, vaultPath, dataPath } = await createIsolatedTestEnvironment(workerId);

  // Create Electron instance using simplified setup
  const { setupObsidianElectron } = await import('./task-sync-setup');
  const { electronApp, page } = await setupObsidianElectron(vaultPath, dataPath);

  const context: SharedTestContext = {
    electronApp,
    page,
    testId,
    vaultPath,
    dataPath,
    workerId
  };

  // Store context for this worker
  workerContexts.set(workerId, context);
  console.log(`✅ Test environment ready for ${workerId}`);

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
 */
export async function cleanupTestState(): Promise<void> {
  const context = await getSharedTestContext();
  await resetObsidianUI(context.page);

  // Clear any test files from the worker's isolated directories
  const testDirs = ['Tasks', 'Projects', 'Areas', 'Templates'];
  for (const dir of testDirs) {
    const dirPath = path.join(context.vaultPath, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        if (file.includes('test-') && file.endsWith('.md')) {
          try {
            fs.unlinkSync(path.join(dirPath, file));
          } catch (error) {
            console.log(`⚠️ Could not remove test file ${file}:`, error.message);
          }
        }
      }
    }
  }
}

/**
 * Clean up all worker contexts and isolated environments
 * This should be called during global teardown
 */
export async function cleanupAllWorkerContexts(): Promise<void> {
  console.log('🧹 Cleaning up all worker contexts...');

  for (const [workerId, context] of workerContexts.entries()) {
    try {
      console.log(`🧹 Cleaning up ${workerId}...`);

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
          console.log(`✅ Gracefully closed Electron app for ${workerId}`);

          // If we have a PID and the process is still running, force kill it
          if (pid) {
            try {
              process.kill(pid, 0); // Check if process still exists
              console.log(`🔪 Force killing remaining process ${pid} for ${workerId}`);
              process.kill(pid, 'SIGTERM');

              // Give it a moment to terminate
              await new Promise(resolve => setTimeout(resolve, 500));

              // Check if it's still running and force kill if needed
              try {
                process.kill(pid, 0);
                process.kill(pid, 'SIGKILL');
                console.log(`💀 Force killed process ${pid} for ${workerId}`);
              } catch {
                // Process already terminated
              }
            } catch {
              // Process already terminated or doesn't exist
            }
          }
        } catch (error) {
          console.log(`⚠️ Error closing Electron app for ${workerId}:`, error.message);
        }
      }

      // Clean up isolated environment
      await cleanupIsolatedTestEnvironment(context.testId);

    } catch (error) {
      console.log(`⚠️ Error cleaning up ${workerId}:`, error.message);
    }
  }

  workerContexts.clear();
  console.log('✅ All worker contexts cleaned up');
}

/**
 * Capture a screenshot for debugging purposes
 */
export async function captureScreenshotOnFailure(context: SharedTestContext, name: string): Promise<void> {
  try {
    const screenshotsDir = path.join(process.cwd(), 'e2e', 'screenshots');
    await fs.promises.mkdir(screenshotsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}-${context.workerId}.png`;
    const screenshotPath = path.join(screenshotsDir, filename);

    await context.page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    });

    console.log(`📸 Screenshot captured: ${screenshotPath}`);
  } catch (error) {
    console.warn(`⚠️ Failed to capture screenshot: ${error.message}`);
  }
}

export async function executeCommand(context: SharedTestContext, command: string): Promise<void> {
  await context.page.keyboard.press('Control+P');
  await context.page.waitForSelector('.prompt-input');
  await context.page.fill('.prompt-input', command);
  await context.page.keyboard.press('Enter');
}

/**
 * Wait for and check if a notice with specific text appears
 */
export async function waitForNotice(context: SharedTestContext, expectedText: string, timeout: number = 5000): Promise<boolean> {
  try {
    await context.page.waitForFunction(
      ({ text }) => {
        const noticeElements = document.querySelectorAll('.notice');
        const notices = Array.from(noticeElements).map(el => el.textContent || '');
        return notices.some(notice => notice.includes(text));
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
export async function expectNotice(context: SharedTestContext, expectedText: string, timeout: number = 10000): Promise<void> {

  // First wait for any notice to appear
  try {
    await context.page.waitForSelector('.notice', { timeout: Math.min(timeout, 5000) });
  } catch (error) {
    // If no notice appears at all, take a screenshot for debugging
    await captureScreenshotOnFailure(context, `no-notice-appeared-${expectedText.replace(/[^a-zA-Z0-9]/g, '-')}`);
    throw new Error(`No notice appeared within ${Math.min(timeout, 5000)}ms. Expected notice containing: "${expectedText}"`);
  }

  // Then wait for the specific notice text
  const noticeAppeared = await waitForNotice(context, expectedText, timeout);

  if (!noticeAppeared) {
    // Get current notices for debugging
    const currentNotices = await context.page.evaluate(() => {
      const noticeElements = document.querySelectorAll('.notice');
      return Array.from(noticeElements).map(el => el.textContent || '');
    });

    await captureScreenshotOnFailure(context, `wrong-notice-${expectedText.replace(/[^a-zA-Z0-9]/g, '-')}`);

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
export async function createIsolatedTestEnvironment(workerId?: string): Promise<{ testId: string; vaultPath: string; dataPath: string }> {
  const testId = workerId || randomUUID();
  const baseTestDir = path.resolve('./e2e/test-environments');
  const testDir = path.join(baseTestDir, testId);
  const vaultPath = path.join(testDir, 'vault');
  const dataPath = path.join(testDir, 'data');

  // Ensure base test directory exists
  await fs.promises.mkdir(baseTestDir, { recursive: true });
  await fs.promises.mkdir(testDir, { recursive: true });

  // Copy pristine vault to isolated vault
  const pristineVaultPath = path.resolve('./tests/vault/Test.pristine');
  if (fs.existsSync(pristineVaultPath)) {
    await copyDirectory(pristineVaultPath, vaultPath);
  } else {
    // Create minimal vault if pristine doesn't exist
    await fs.promises.mkdir(vaultPath, { recursive: true });
    console.log(`⚠️ Pristine vault not found at ${pristineVaultPath}, created empty vault`);
  }

  // Copy pristine data directory to isolated data directory
  const pristineDataPath = path.resolve('./e2e/obsidian-data.pristine');
  if (fs.existsSync(pristineDataPath)) {
    await copyDirectory(pristineDataPath, dataPath);

    // Update obsidian.json to point to the isolated vault path
    const obsidianJsonPath = path.join(dataPath, 'obsidian.json');
    if (fs.existsSync(obsidianJsonPath)) {
      try {
        const obsidianConfig = JSON.parse(await fs.promises.readFile(obsidianJsonPath, 'utf8'));

        // Update all vault paths to point to the isolated vault
        if (obsidianConfig.vaults) {
          for (const vaultId in obsidianConfig.vaults) {
            obsidianConfig.vaults[vaultId].path = vaultPath;
          }
        }

        await fs.promises.writeFile(obsidianJsonPath, JSON.stringify(obsidianConfig, null, 2));
        console.log(`📝 Updated obsidian.json vault path to: ${vaultPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to update obsidian.json vault path: ${error.message}`);
      }
    }
  } else {
    // Create minimal data directory if pristine doesn't exist
    await fs.promises.mkdir(dataPath, { recursive: true });
    console.log(`⚠️ Pristine data not found at ${pristineDataPath}, created empty data directory`);
  }

  // Copy the freshly built plugin files to the test environment
  await copyBuiltPluginToTestEnvironment(vaultPath);

  return { testId, vaultPath, dataPath };
}

/**
 * Clean up isolated test environment
 */
export async function cleanupIsolatedTestEnvironment(testId: string): Promise<void> {
  const baseTestDir = path.resolve('./e2e/test-environments');
  const testDir = path.join(baseTestDir, testId);

  if (fs.existsSync(testDir)) {
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.log(`⚠️ Failed to cleanup test environment ${testId}:`, error.message);
    }
  }
}

/**
 * Copy the freshly built plugin files to the test environment
 */
async function copyBuiltPluginToTestEnvironment(vaultPath: string): Promise<void> {
  const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-task-sync');

  try {
    // Ensure plugin directory exists
    await fs.promises.mkdir(pluginDir, { recursive: true });

    // Copy the freshly built files from the project root
    const projectRoot = path.resolve('.');
    const filesToCopy = ['main.js', 'manifest.json', 'styles.css'];

    for (const file of filesToCopy) {
      const srcPath = path.join(projectRoot, file);
      const destPath = path.join(pluginDir, file);

      if (fs.existsSync(srcPath)) {
        await fs.promises.copyFile(srcPath, destPath);
        console.log(`📋 Copied ${file} to test environment`);
      } else {
        console.warn(`⚠️ Built file ${file} not found at ${srcPath}`);
      }
    }

  } catch (error) {
    console.error(`❌ Failed to copy built plugin to test environment: ${error.message}`);
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
 * Sets up common e2e test hooks and returns a context proxy
 * This eliminates duplication of beforeAll/beforeEach/afterEach/afterAll setup across test files
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

  beforeAll(async () => {
    context = await getSharedTestContext();

    // Set up console log capture from the Electron app
    context.page.on('console', (msg) => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date()
      };
      consoleLogs.push(logEntry);

      // Also log to test output for immediate visibility
      console.log(`[Electron ${logEntry.type.toUpperCase()}] ${logEntry.text}`);
    });
  });

  beforeEach(async () => {
    // Clear console logs for each test
    consoleLogs = [];
    await resetSharedTestContext();
  });

  afterEach(async (testContext) => {
    // Capture screenshot on test failure
    if ((testContext as any)?.meta?.result?.state === 'fail') {
      const testName = (testContext as any)?.meta?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'unknown-test';
      await captureScreenshotOnFailure(context, `test-failure-${testName}`);
    }

    await cleanupTestState();
  });

  afterAll(async () => {
    // Force cleanup of any remaining processes
    try {
      if (context?.electronApp) {
        await context.electronApp.close();
      }
    } catch (error) {
      console.log('⚠️ Error during afterAll cleanup:', error.message);
    }
  });

  // Return a Proxy that delegates to the context once it's available
  return new Proxy({} as SharedTestContext & { getConsoleLogs: () => typeof consoleLogs }, {
    get(_target, prop) {
      if (!context) {
        throw new Error(`Context not yet initialized. Make sure you're accessing context properties inside test functions, not at the top level.`);
      }

      // Add special method to access console logs
      if (prop === 'getConsoleLogs') {
        return () => [...consoleLogs]; // Return a copy to prevent mutation
      }

      return context[prop as keyof SharedTestContext];
    },
    set(_target, prop, value) {
      if (!context) {
        throw new Error(`Context not yet initialized. Make sure you're accessing context properties inside test functions, not at the top level.`);
      }
      (context as any)[prop] = value;
      return true;
    }
  });
}
