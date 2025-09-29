/**
 * Core shared context functions without vitest dependencies
 * This file can be imported by both vitest and Playwright tests
 */

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

import type { Page, ElectronApplication } from "playwright";

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

/**
 * Create a test folder structure
 */
export async function createTestFolders(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    const folders = [
      "Tasks",
      "Projects",
      "Areas",
      "Templates",
      "Notes",
      "Bases",
    ];

    for (const folder of folders) {
      const exists = await app.vault.adapter.exists(folder);
      if (!exists) {
        await app.vault.createFolder(folder);
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

  const obsidianUnpackedPath = path.resolve("./tests/e2e/.obsidian-unpacked");

  // Check for different possible Obsidian structures
  const mainJsPath = path.resolve(obsidianUnpackedPath + "/main.js");
  const appExtractedMainJs = path.resolve(
    obsidianUnpackedPath + "/app-extracted/main.js"
  );
  const obsidianBinaryPath = path.resolve(obsidianUnpackedPath + "/obsidian");
  const appAsarPath = path.resolve(
    obsidianUnpackedPath + "/resources/app.asar"
  );

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
  // Default to headless unless explicitly set to false
  const isHeadless =
    process.env.E2E_HEADLESS === "false"
      ? false
      : process.env.E2E_HEADLESS === "true" ||
        process.env.CI === "true" ||
        !process.env.DISPLAY ||
        process.env.DISPLAY === "" ||
        process.env.DISPLAY === ":0" ||
        true; // Default to headless for safety

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

    if (process.env.DEBUG === "true") {
      console.log("[Obsidian]", msg.text());
    }
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
 * Toggle sidebar open/closed
 */
export async function toggleSidebar(
  page: Page,
  sidebar: "left" | "right",
  open: boolean
): Promise<void> {
  await page.evaluate(
    async ({ sidebar, open }) => {
      const app = (window as any).app;

      if (app?.workspace) {
        if (sidebar === "left") {
          if (open) {
            app.workspace.leftSplit.expand();
          } else {
            app.workspace.leftSplit.collapse();
          }
        } else if (sidebar === "right") {
          if (open) {
            app.workspace.rightSplit.expand();
          } else {
            app.workspace.rightSplit.collapse();
          }
        }
      }
    },
    { sidebar, open }
  );
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
 * Create an isolated test environment with unique vault and data directories
 * @param workerId Optional worker ID for consistent naming across worker processes
 */
export async function createIsolatedTestEnvironment(
  workerId?: string
): Promise<{ testId: string; vaultPath: string; dataPath: string }> {
  const testId = workerId || randomUUID();
  const baseTestDir = path.resolve("./tests/e2e/test-environments");
  const testDir = path.join(baseTestDir, testId);
  const vaultPath = path.join(testDir, "vault");
  const dataPath = path.join(testDir, "data");

  // Ensure base test directory exists
  await fs.promises.mkdir(baseTestDir, { recursive: true });
  await fs.promises.mkdir(testDir, { recursive: true });

  const pristineVaultPath = path.resolve("./tests/vault/Test.pristine");
  await copyDirectory(pristineVaultPath, vaultPath);

  const pristineDataPath = path.resolve("./tests/e2e/obsidian-data.pristine");
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
  const baseTestDir = path.resolve("./tests/e2e/test-environments");
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
 * Capture a full debugging package including screenshot, console logs, and app state
 */
export async function captureFullDebugInfo(
  context: SharedTestContext,
  name: string
): Promise<void> {
  const baseDebugDir = path.join(process.cwd(), "e2e", "debug");

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
  }
}
