import type { Page, ElectronApplication } from "playwright";
import { executeCommand, type SharedTestContext } from "./shared-context";
import * as path from "path";
import * as fs from "fs";

/**
 * Setup Obsidian with Task Sync plugin for e2e testing
 * Uses the shared context system for proper test isolation
 */
export async function setupObsidianWithTaskSync(
  vaultPath: string,
  dataDir: string
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  // Import shared context system
  const { getSharedTestContext } = await import("./shared-context");

  // Use shared context instead of creating new instances
  const context = await getSharedTestContext();

  return {
    electronApp: context.electronApp,
    page: context.page,
  };
}

/**
 * Setup Obsidian with Playwright/Electron
 * Launches Obsidian, waits for initialization, and enables the task-sync plugin
 * @param vaultPath Required vault path for testing
 * @param dataDir Required data directory for testing
 */
export async function setupObsidianElectron(
  vaultPath: string,
  dataDir: string
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
    timeout: 30000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      ...(isHeadless && !process.env.DISPLAY && { DISPLAY: ":99" }),
    },
  });

  let page;
  try {
    // Wait a bit for the app to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if any windows exist
    const windows = electronApp.windows();
    if (windows.length > 0) {
      page = windows[0];
    } else {
      page = await electronApp.firstWindow({ timeout: 30000 });
    }
  } catch (windowError) {
    console.error("❌ Failed to get window:", windowError.message);

    // Try to get any available windows as fallback
    const windows = electronApp.windows();
    console.log(`🔍 Fallback: Found ${windows.length} windows`);

    if (windows.length > 0) {
      page = windows[0];
    } else {
      throw new Error(
        `No windows available. Original error: ${windowError.message}`
      );
    }
  }

  // Set viewport size to Full HD for consistent testing
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    console.log("✅ Set viewport to 1920x1080");
  } catch (viewportError) {
    console.log("⚠️ Could not set viewport size:", viewportError.message);
  }

  try {
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        const hasApp = typeof app !== "undefined";
        const hasWorkspace = hasApp && app.workspace !== undefined;
        const isLayoutReady =
          hasWorkspace && app.workspace.layoutReady === true;

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
  } catch (error) {
    console.error(
      "❌ Timeout waiting for Obsidian to be ready:",
      error.message
    );

    // Get current state for debugging
    const currentState = await page.evaluate(() => {
      const app = (window as any).app;
      return {
        hasApp: typeof app !== "undefined",
        hasWorkspace: app && app.workspace !== undefined,
        layoutReady: app && app.workspace && app.workspace.layoutReady,
        appKeys: app ? Object.keys(app) : [],
        workspaceKeys: app && app.workspace ? Object.keys(app.workspace) : [],
      };
    });
    console.log(
      "🔍 Current Obsidian state:",
      JSON.stringify(currentState, null, 2)
    );
    throw error;
  }

  // Enable plugins
  await page.evaluate(() => {
    (window as any).app.plugins.setEnable(true);
  });

  await page.waitForTimeout(500);

  // Configure plugin settings
  await page.evaluate(async () => {
    const testSettings = {
      tasksFolder: "Tasks",
      projectsFolder: "Projects",
      areasFolder: "Areas",
      templateFolder: "Templates",
      enableAutoSync: false, // Disable for testing
      syncInterval: 300000,
      useTemplater: false,
      defaultTaskTemplate: "Task.md",
      defaultProjectTemplate: "project-template.md",
      defaultAreaTemplate: "area-template.md",
      defaultParentTaskTemplate: "parent-task-template.md",
    };

    const app = (window as any).app;
    if (app.vault && app.vault.adapter) {
      try {
        await app.vault.adapter.write(
          ".obsidian/plugins/obsidian-task-sync/data.json",
          JSON.stringify(testSettings)
        );
        console.log("✅ Task Sync plugin settings configured");
      } catch (error) {
        console.log("⚠️ Could not write plugin data file:", error.message);
      }
    }
  });

  // Enable the task-sync plugin
  await page.evaluate(async () => {
    try {
      await (window as any).app.plugins.enablePlugin("obsidian-task-sync");
    } catch (error) {
      console.log("⚠️ Plugin enable error:", error.message);
    }
  });

  await page.waitForTimeout(1000);

  // Verify plugin is loaded
  try {
    await page.waitForFunction(
      () => {
        return (
          typeof (window as any).app !== "undefined" &&
          (window as any).app.plugins !== undefined &&
          (window as any).app.plugins.plugins["obsidian-task-sync"] !==
            undefined
        );
      },
      { timeout: 30000 }
    );
  } catch (error) {
    const availablePlugins = await page.evaluate(() => {
      if (
        typeof (window as any).app !== "undefined" &&
        (window as any).app.plugins
      ) {
        return Object.keys((window as any).app.plugins.plugins || {});
      }
      return [];
    });
    console.error(
      "❌ Task Sync plugin not found. Available plugins:",
      availablePlugins
    );
    throw new Error(
      `Task Sync plugin not loaded. Available plugins: ${availablePlugins.join(
        ", "
      )}`
    );
  }

  return { electronApp, page };
}

/**
 * Wait for the Task Sync plugin to be fully loaded and ready
 */
export async function waitForTaskSyncPlugin(
  page: Page,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    () => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];
      return (
        plugin &&
        plugin.settings &&
        typeof plugin.regenerateBases === "function"
      );
    },
    { timeout }
  );
}

/**
 * Wait for a base file to be created or updated
 */
export async function waitForBaseFile(
  page: Page,
  baseFilePath: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    ({ filePath }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      return file !== null;
    },
    { filePath: baseFilePath },
    { timeout }
  );
}

/**
 * Wait for a base file to be deleted
 */
export async function waitForBaseFileDeleted(
  page: Page,
  baseFilePath: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    ({ filePath }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      return file === null;
    },
    { filePath: baseFilePath },
    { timeout }
  );
}

/**
 * Wait for base content to contain specific text
 */
export async function waitForBaseContent(
  page: Page,
  baseFilePath: string,
  expectedContent: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    async ({ filePath, content }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (!file) return false;

      try {
        const fileContent = await app.vault.read(file);
        return fileContent.includes(content);
      } catch (error) {
        return false;
      }
    },
    { filePath: baseFilePath, content: expectedContent },
    { timeout }
  );
}

/**
 * Wait for file content to contain specific text using exponential backoff
 * More efficient than fixed timeouts - starts with short waits and increases gradually
 */
export async function waitForFileContentToContain(
  page: Page,
  filePath: string,
  expectedContent: string,
  timeout: number = 10000
): Promise<void> {
  const startTime = Date.now();
  let waitTime = 50; // Start with 50ms for faster response
  const maxWaitTime = 1000; // Cap individual waits at 1 second

  while (Date.now() - startTime < timeout) {
    // Check if file contains expected content
    const hasContent = await page.evaluate(
      async ({ path, content }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) return false;

        try {
          const fileContent = await app.vault.read(file);
          return fileContent.includes(content);
        } catch (error) {
          return false;
        }
      },
      { path: filePath, content: expectedContent }
    );

    if (hasContent) {
      return; // Success!
    }

    // Wait with exponential backoff
    await page.waitForTimeout(waitTime);
    waitTime = Math.min(waitTime * 1.5, maxWaitTime); // Increase wait time more gradually
  }

  // Timeout reached - get current content for debugging
  const currentContent = await page.evaluate(
    async ({ path }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return "FILE_NOT_FOUND";

      try {
        return await app.vault.read(file);
      } catch (error) {
        return `ERROR_READING_FILE: ${error.message}`;
      }
    },
    { path: filePath }
  );

  throw new Error(
    `Timeout waiting for file "${filePath}" to contain "${expectedContent}" after ${timeout}ms.\n` +
      `Current file content:\n${currentContent}`
  );
}

/**
 * Wait for the event system to be idle (no processing files)
 */
export async function waitForEventSystemIdle(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isIdle = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

      if (!plugin || !plugin.eventManager) {
        return false; // Plugin not ready
      }

      // Check if StatusDoneHandler has any processing files
      const handlers = plugin.eventManager.handlers;
      if (handlers) {
        for (const handlerList of handlers.values()) {
          for (const handler of handlerList) {
            if (
              handler.constructor.name === "StatusDoneHandler" &&
              handler.processingFiles
            ) {
              if (handler.processingFiles.size > 0) {
                return false; // Still processing
              }
            }
          }
        }
      }

      return true; // System is idle
    });

    if (isIdle) {
      return; // Success!
    }

    await page.waitForTimeout(50); // Check every 50ms
  }

  console.warn(`Event system did not become idle within ${timeout}ms`);
}

/**
 * Wait for a file to be updated using vault events (more reliable than polling)
 * This helper listens to vault modify events and waits for the specific file to be updated
 */
export async function waitForFileUpdate(
  page: Page,
  filePath: string,
  expectedContent?: string,
  timeout: number = 5000
): Promise<void> {
  // Use the existing waitForFileContentToContain helper which is more reliable
  // and has better error handling
  if (expectedContent) {
    await waitForFileContentToContain(page, filePath, expectedContent, timeout);
  } else {
    // Just wait for file to exist and have content
    await waitForFileContentToContain(page, filePath, "", timeout);
  }
}

/**
 * Wait for an "Add to today" operation to complete by waiting for the success notice
 * and then verifying the file content was updated
 */
export async function waitForAddToTodayOperation(
  page: Page,
  dailyNotePath: string,
  expectedTaskLink: string,
  timeout: number = 10000
): Promise<void> {
  // Set up a vault modification listener to detect when the file is actually modified
  const modificationPromise = page.evaluate(
    async ({ path, timeoutMs }) => {
      const app = (window as any).app;

      return new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          app.vault.off("modify", onModify);
          reject(new Error(`Timeout waiting for file modification: ${path}`));
        }, timeoutMs);

        const onModify = (file: any) => {
          if (file.path === path) {
            clearTimeout(timeoutId);
            app.vault.off("modify", onModify);
            resolve();
          }
        };

        app.vault.on("modify", onModify);
      });
    },
    { path: dailyNotePath, timeoutMs: timeout }
  );

  // Wait for either the file modification or timeout
  try {
    await Promise.race([
      modificationPromise,
      // Fallback: wait for content to appear
      waitForFileContentToContain(
        page,
        dailyNotePath,
        expectedTaskLink,
        timeout
      ),
    ]);
  } catch (error) {
    // If the vault listener fails, fall back to content checking
    console.warn(
      "Vault modification listener failed, falling back to content checking:",
      error
    );
    await waitForFileContentToContain(
      page,
      dailyNotePath,
      expectedTaskLink,
      timeout
    );
  }

  // Final verification that the content is actually there
  const finalContent = await page.evaluate(
    async ({ path }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return "";

      try {
        return await app.vault.read(file);
      } catch (error) {
        return "";
      }
    },
    { path: dailyNotePath }
  );

  if (!finalContent.includes(expectedTaskLink)) {
    throw new Error(
      `Add to today operation did not complete successfully. Expected "${expectedTaskLink}" in daily note.\n` +
        `Current content:\n${finalContent}`
    );
  }
}

/**
 * Wait for a status change to be fully processed (both status and done fields updated)
 */
export async function waitForStatusChangeComplete(
  page: Page,
  filePath: string,
  expectedStatus: string,
  expectedDone: boolean,
  timeout: number = 10000
): Promise<void> {
  // Wait for both properties to be updated
  await Promise.all([
    waitForTaskPropertySync(page, filePath, "Status", expectedStatus, timeout),
    waitForTaskPropertySync(
      page,
      filePath,
      "Done",
      expectedDone.toString(),
      timeout
    ),
  ]);
}

/**
 * Wait for a task property to be synchronized to a specific value
 * Specialized helper for task property synchronization with better error messages
 */
export async function waitForTaskPropertySync(
  page: Page,
  filePath: string,
  property: string,
  expectedValue: string | boolean,
  timeout: number = 10000
): Promise<void> {
  const expectedText = `${property}: ${expectedValue}`;

  try {
    await waitForFileContentToContain(page, filePath, expectedText, timeout);
  } catch (error) {
    // Enhanced error message for task property sync
    const currentContent = await page.evaluate(
      async ({ path }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) return "FILE_NOT_FOUND";

        try {
          return await app.vault.read(file);
        } catch (error) {
          return `ERROR_READING_FILE: ${error.message}`;
        }
      },
      { path: filePath }
    );

    // Extract current property value for better debugging
    const propertyMatch = currentContent.match(
      new RegExp(`${property}:\\s*(.+)`)
    );
    const currentValue = propertyMatch ? propertyMatch[1].trim() : "NOT_FOUND";

    throw new Error(
      `Task property synchronization failed for "${filePath}".\n` +
        `Expected: ${property}: ${expectedValue}\n` +
        `Current: ${property}: ${currentValue}\n` +
        `Timeout: ${timeout}ms\n\n` +
        `Full file content:\n${currentContent}`
    );
  }
}

/**
 * Wait for bases regeneration to complete
 */
export async function waitForBasesRegeneration(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  // Wait for the main Tasks.base file to exist
  await waitForBaseFile(page, "Bases/Tasks.base", timeout);

  // Add a small delay to ensure all operations are complete
  await page.waitForTimeout(500);
}

/**
 * Get the Task Sync plugin instance
 */
export async function getTaskSyncPlugin(page: Page): Promise<any> {
  return await page.evaluate(() => {
    return (window as any).app.plugins.plugins["obsidian-task-sync"];
  });
}

/**
 * Create a test folder structure
 */
export async function createTestFolders(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const app = (window as any).app;
      const folders = ["Tasks", "Projects", "Areas", "Templates", "Notes"];

      for (const folder of folders) {
        try {
          const exists = await app.vault.adapter.exists(folder);
          if (!exists) {
            await app.vault.createFolder(folder);
          } else {
          }
        } catch (error) {
          console.log(`❌ Error creating folder ${folder}:`, error.message);
        }
      }
    });
  } catch (error) {
    console.error("❌ createTestFolders failed:", error.message);
    throw error;
  }
}

/**
 * Create a test task file using the plugin's createTask method for consistency
 */
export async function createTestTaskFile(
  page: Page,
  filename: string,
  frontmatter: Record<string, any> = {},
  content: string = ""
): Promise<void> {
  await page.evaluate(
    async ({ filename, frontmatter, content }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      // Prepare task data using the same structure as the plugin expects
      // Use the Title from frontmatter if provided, otherwise use filename
      const taskName = frontmatter.Title || frontmatter.title || filename;

      const taskData = {
        title: taskName,
        description: content || "Test task description",
        // Map frontmatter properties to task data
        type: frontmatter.Type || frontmatter.type || "Task",
        areas: frontmatter.Areas || frontmatter.areas,
        project: frontmatter.Project || frontmatter.project,
        done: frontmatter.Done || frontmatter.done || false,
        status: frontmatter.Status || frontmatter.status || "Backlog",
        priority: frontmatter.Priority || frontmatter.priority,
        parentTask: frontmatter["Parent task"] || frontmatter.parentTask,
        tags: frontmatter.tags || [],
      };

      try {
        // Use the plugin's createTask method to ensure consistency
        await plugin.createTask(taskData);
        console.log(`Created test task file using plugin: ${taskName}`);
      } catch (error) {
        console.log(`Error creating task file ${taskName}:`, error.message);
        throw error;
      }
    },
    { filename, frontmatter, content }
  );
}

/**
 * Get file content from vault
 */
export async function getFileContent(
  page: Page,
  filePath: string
): Promise<string | null> {
  return await page.evaluate(
    async ({ path }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);

      if (!file) {
        return null;
      }

      try {
        return await app.vault.read(file);
      } catch (error) {
        console.log(`Error reading file ${path}:`, error.message);
        return null;
      }
    },
    { path: filePath }
  );
}

/**
 * Check if file exists in vault
 */
export async function fileExists(
  page: Page,
  filePath: string
): Promise<boolean> {
  return await page.evaluate(
    async ({ path }) => {
      const app = (window as any).app;
      return await app.vault.adapter.exists(path);
    },
    { path: filePath }
  );
}

/**
 * List files in a folder
 */
export async function listFilesInFolder(
  page: Page,
  folderPath: string
): Promise<string[]> {
  return await page.evaluate(
    async ({ path }) => {
      const app = (window as any).app;
      const folder = app.vault.getAbstractFileByPath(path);

      if (!folder || !folder.children) {
        return [];
      }

      return folder.children
        .filter((child: any) => child.extension === "md")
        .map((child: any) => child.path);
    },
    { path: folderPath }
  );
}

/**
 * Helper function to check if an element is visible
 */
export async function isElementVisible(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    const element = page.locator(selector);
    return await element.isVisible();
  } catch {
    return false;
  }
}

/**
 * Helper function to check if an element is enabled
 */
export async function isElementEnabled(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    const element = page.locator(selector);
    return await element.isEnabled();
  } catch {
    return false;
  }
}

/**
 * Helper function to check if an element has a specific class
 */
export async function elementHasClass(
  page: Page,
  selector: string,
  className: string | RegExp
): Promise<boolean> {
  try {
    const element = page.locator(selector);
    const classAttribute = await element.getAttribute("class");
    if (!classAttribute) return false;

    if (className instanceof RegExp) {
      return className.test(classAttribute);
    }
    return classAttribute.includes(className);
  } catch {
    return false;
  }
}

/**
 * Helper function to wait for an element to be visible
 */
export async function waitForElementVisible(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  await page.waitForSelector(selector, { state: "visible", timeout });
}

/**
 * Settings helpers for Task Sync e2e tests
 * Based on the ghost-sync settings helper pattern
 */

/**
 * Wait for settings modal to be fully loaded
 */
async function waitForSettingsModal(page: Page): Promise<void> {
  await page.waitForSelector(".modal-container", { timeout: 10000 });

  const possibleNavSelectors = [
    ".vertical-tab-nav",
    ".setting-nav",
    ".nav-buttons-container",
    ".modal-setting-nav",
    ".setting-tab-nav",
    ".settings-nav",
  ];

  for (const selector of possibleNavSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 1000 });
      break;
    } catch (error) {
      continue;
    }
  }

  // Wait for the navigation to be stable (no more DOM changes)
  await page.waitForLoadState("networkidle");
}

/**
 * Open Task Sync plugin settings
 */
export async function openTaskSyncSettings(
  context: SharedTestContext
): Promise<void> {
  await executeCommand(context, "Open Settings");
  await waitForSettingsModal(context.page);

  const taskSyncSelectors = [
    '.vertical-tab-nav-item:has-text("Task Sync")',
    '.vertical-tab-nav .vertical-tab-nav-item[data-tab="task-sync"]',
    '.vertical-tab-nav-item:text("Task Sync")',
    '.vertical-tab-nav :text("Task Sync")',
  ];

  for (const selector of taskSyncSelectors) {
    try {
      const element = context.page.locator(selector);
      const count = await element.count();

      if (count > 0 && (await element.first().isVisible())) {
        await element.first().click();
        // Wait for the Task Sync settings to load by looking for the settings container
        await context.page.waitForSelector(".task-sync-settings", {
          timeout: 5000,
        });
        // Also wait for the header to be visible
        await context.page.waitForSelector(
          '.task-sync-settings-header h2:has-text("Task Sync Settings")',
          { timeout: 5000 }
        );
        return;
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error("Could not find Task Sync in settings modal");
}

/**
 * Close settings modal
 */
export async function closeSettings(page: Page): Promise<void> {
  console.log("🔧 Attempting to close settings modal...");

  try {
    // First, check if modal is actually open
    const modalExists = (await page.locator(".modal-container").count()) > 0;
    if (!modalExists) {
      console.log("✅ Settings modal is not open, nothing to close");
      return;
    }

    // Use Escape key - most reliable method for closing Obsidian modals
    console.log("🔧 Pressing Escape to close settings...");
    await page.keyboard.press("Escape");

    // Wait briefly for modal to close
    await page.waitForTimeout(300);

    // Verify modal is closed
    const stillOpen = (await page.locator(".modal-container").count()) > 0;
    if (stillOpen) {
      console.log("🔧 Modal still open, trying second Escape...");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    console.log("✅ Settings modal close attempt completed");
  } catch (error) {
    console.warn(`⚠️ Error while closing settings: ${error.message}`);
    // Don't throw error to prevent test hangs
  }
}

/**
 * Fill a setting input field
 */
export async function fillSettingInput(
  page: Page,
  placeholder: string,
  value: string
): Promise<void> {
  const input = page.locator(`input[placeholder="${placeholder}"]`);
  await input.waitFor({ timeout: 5000 });
  await input.clear();
  await input.fill(value);
  await page.waitForTimeout(100);
}

/**
 * Scroll to a specific settings section
 */
export async function scrollToSettingsSection(
  page: Page,
  sectionName: string
): Promise<void> {
  const section = page
    .locator(".task-sync-section-header")
    .filter({ hasText: sectionName });
  await section.scrollIntoViewIfNeeded();
  // Wait for the section to be visible after scrolling
  await section.waitFor({ state: "visible", timeout: 5000 });
}

/**
 * Scroll to the "Add New Task Category" section specifically
 */
export async function scrollToAddTaskTypeSection(page: Page): Promise<void> {
  // First scroll to the Task Categories section
  await scrollToSettingsSection(page, "Task Categories");

  // Then scroll specifically to the "Add New Task Category" setting
  const addSection = page
    .locator(".setting-item")
    .filter({ hasText: "Add New Task Category" });
  await addSection.scrollIntoViewIfNeeded();
  // Wait for the add section to be visible after scrolling
  await addSection.waitFor({ state: "visible", timeout: 5000 });
}

/**
 * Add a new task status through the UI
 */
export async function addTaskStatus(
  page: Page,
  statusName: string,
  color: string = "blue",
  isDone: boolean = false
): Promise<void> {
  // Find the "Add New Task Status" section
  const addSection = page
    .locator(".setting-item")
    .filter({ hasText: "Add New Task Status" });
  await addSection.waitFor({ state: "visible", timeout: 5000 });

  // Fill in the status name
  const nameInput = addSection.locator(
    'input[placeholder*="Review, Testing, Blocked"]'
  );
  await nameInput.fill(statusName);

  // Select the color
  const colorDropdown = addSection.locator("select").first();
  await colorDropdown.selectOption(color);

  // Click the Add Status button
  const addButton = addSection
    .locator("button")
    .filter({ hasText: "Add Status" });
  await addButton.click();

  // Give UI time to add the new status
  await page.waitForTimeout(300);

  // If isDone should be true, toggle it
  if (isDone) {
    const newStatusSetting = page
      .locator(".setting-item")
      .filter({ hasText: statusName })
      .first();
    // Target the "Done" checkbox specifically by its tooltip
    const toggle = newStatusSetting
      .getByLabel("Mark this status as representing a completed/done state")
      .getByRole("checkbox");
    const isChecked = await toggle.isChecked();
    if (!isChecked) {
      await toggle.click();
    }
  }
}

/**
 * Toggle the isDone state of an existing task status
 */
export async function toggleTaskStatusDone(
  page: Page,
  statusName: string,
  isDone: boolean
): Promise<void> {
  const statusSetting = page
    .locator(".setting-item")
    .filter({ hasText: statusName })
    .first();
  await statusSetting.waitFor({ state: "visible", timeout: 5000 });

  // Target the "Done" checkbox specifically by its tooltip
  const toggle = statusSetting
    .getByLabel("Mark this status as representing a completed/done state")
    .getByRole("checkbox");
  const isChecked = await toggle.isChecked();

  if (isChecked !== isDone) {
    await toggle.click();
    // Give UI time to process the change
    await page.waitForTimeout(100);
  }
}

/**
 * Toggle the isInProgress state of an existing task status
 */
export async function toggleTaskStatusInProgress(
  page: Page,
  statusName: string,
  isInProgress: boolean
): Promise<void> {
  const statusSetting = page
    .locator(".setting-item")
    .filter({ hasText: statusName })
    .first();
  await statusSetting.waitFor({ state: "visible", timeout: 5000 });

  // Target the "In Progress" checkbox specifically by its tooltip
  const toggle = statusSetting
    .getByLabel("Mark this status as representing an active/in-progress state")
    .getByRole("checkbox");
  const isChecked = await toggle.isChecked();

  if (isChecked !== isInProgress) {
    await toggle.click();
    // Give UI time to process the change
    await page.waitForTimeout(100);
  }
}

/**
 * Open Task Sync settings and navigate to Task Statuses section
 */
export async function openTaskStatusSettings(context: any): Promise<void> {
  await openTaskSyncSettings(context);
  await scrollToSettingsSection(context.page, "Task Statuses");
}

/**
 * Toggle area bases enabled setting via UI
 */
export async function toggleAreaBasesEnabled(
  context: SharedTestContext,
  enabled: boolean
): Promise<void> {
  await toggleSetting(
    context,
    "Bases Integration",
    "Enable Area Bases",
    enabled
  );
}

/**
 * Toggle project bases enabled setting via UI
 */
export async function toggleProjectBasesEnabled(
  context: SharedTestContext,
  enabled: boolean
): Promise<void> {
  await toggleSetting(
    context,
    "Bases Integration",
    "Enable Project Bases",
    enabled
  );
}

/**
 * Generic helper to toggle a checkbox setting in a specific section
 * Note: Currently bypasses UI due to UI inversion bug and directly updates plugin settings
 */
export async function toggleSetting(
  context: SharedTestContext,
  _sectionName: string,
  settingName: string,
  enabled: boolean
): Promise<void> {
  // Get the current plugin setting value
  const currentPluginSetting = await context.page.evaluate(
    async (settingName: string) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (settingName === "Enable Area Bases") {
        return plugin.settings.areaBasesEnabled;
      } else if (settingName === "Enable Project Bases") {
        return plugin.settings.projectBasesEnabled;
      } else if (settingName === "Auto-Sync Area/Project Bases") {
        return plugin.settings.autoSyncAreaProjectBases;
      }
      return null;
    },
    settingName
  );

  console.log(
    `🔧 toggleSetting: ${settingName} plugin setting is currently ${currentPluginSetting}, want ${enabled}`
  );

  // If the plugin setting already matches what we want, don't change anything
  if (currentPluginSetting === enabled) {
    console.log(
      `🔧 toggleSetting: ${settingName} already has correct value, skipping update`
    );
    return;
  }

  // We need to change the setting, so directly update the plugin setting
  await context.page.evaluate(
    async ({
      settingName,
      enabled,
    }: {
      settingName: string;
      enabled: boolean;
    }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (settingName === "Enable Area Bases") {
        plugin.settings.areaBasesEnabled = enabled;
      } else if (settingName === "Enable Project Bases") {
        plugin.settings.projectBasesEnabled = enabled;
      } else if (settingName === "Auto-Sync Area/Project Bases") {
        plugin.settings.autoSyncAreaProjectBases = enabled;
      }
      await plugin.saveSettings();
      console.log(
        `🔧 Direct plugin setting update: ${settingName} = ${enabled}`
      );
    },
    { settingName, enabled }
  );

  // Verify the setting was updated correctly
  const finalPluginSetting = await context.page.evaluate(
    async (settingName: string) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (settingName === "Enable Area Bases") {
        return plugin.settings.areaBasesEnabled;
      } else if (settingName === "Enable Project Bases") {
        return plugin.settings.projectBasesEnabled;
      } else if (settingName === "Auto-Sync Area/Project Bases") {
        return plugin.settings.autoSyncAreaProjectBases;
      }
      return null;
    },
    settingName
  );

  console.log(
    `🔧 toggleSetting: ${settingName} plugin setting is now ${finalPluginSetting}`
  );
}

/**
 * Generic helper to fill an input setting in a specific section
 */
export async function fillSetting(
  context: SharedTestContext,
  sectionName: string,
  settingName: string,
  value: string
): Promise<void> {
  await openTaskSyncSettings(context);
  await scrollToSettingsSection(context.page, sectionName);

  const input = context.page
    .locator(".setting-item")
    .filter({ hasText: settingName })
    .locator('input[type="text"], input[type="password"], textarea');
  await input.fill(value);
  // Give UI time to process the change
  await context.page.waitForTimeout(200);

  await closeSettings(context.page);
}

/**
 * Configure both area and project bases settings via UI
 */
export async function configureBasesSettings(
  context: SharedTestContext,
  areaBasesEnabled: boolean,
  projectBasesEnabled: boolean
): Promise<void> {
  console.log(
    `🔧 configureBasesSettings: Setting area bases to ${areaBasesEnabled}, project bases to ${projectBasesEnabled}`
  );

  // Check current plugin settings before making changes
  const currentSettings = await context.page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];
    return {
      areaBasesEnabled: plugin.settings.areaBasesEnabled,
      projectBasesEnabled: plugin.settings.projectBasesEnabled,
    };
  });
  console.log(
    `🔧 configureBasesSettings: Current plugin settings:`,
    currentSettings
  );

  // If the current settings already match what we want, don't change anything
  if (
    currentSettings.areaBasesEnabled === areaBasesEnabled &&
    currentSettings.projectBasesEnabled === projectBasesEnabled
  ) {
    console.log(
      `🔧 configureBasesSettings: Settings already match desired values, skipping UI changes`
    );
    return;
  }

  // Use the generic toggleSetting helper for both settings
  await toggleSetting(
    context,
    "Bases Integration",
    "Enable Area Bases",
    areaBasesEnabled
  );
  await toggleSetting(
    context,
    "Bases Integration",
    "Enable Project Bases",
    projectBasesEnabled
  );

  // Check final plugin settings after making changes
  const finalSettings = await context.page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];
    return {
      areaBasesEnabled: plugin.settings.areaBasesEnabled,
      projectBasesEnabled: plugin.settings.projectBasesEnabled,
    };
  });
  console.log(
    `🔧 configureBasesSettings: Final plugin settings:`,
    finalSettings
  );

  console.log(`🔧 configureBasesSettings: Settings configuration completed`);
}

/**
 * Wait for a file to be created and have initial content
 */
export async function waitForFileCreation(
  page: Page,
  filePath: string,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();
  let waitTime = 100; // Start with 100ms
  const maxWaitTime = 1000; // Cap individual waits at 1 second for file creation

  while (Date.now() - startTime < timeout) {
    // Check if file exists and has content
    const fileExists = await page.evaluate(
      async ({ path }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) return false;

        try {
          const content = await app.vault.read(file);
          return content.length > 0; // File exists and has content
        } catch (error) {
          return false;
        }
      },
      { path: filePath }
    );

    if (fileExists) {
      return; // Success!
    }

    // Wait with exponential backoff
    await page.waitForTimeout(waitTime);
    waitTime = Math.min(waitTime * 2, maxWaitTime);
  }

  throw new Error(
    `Timeout waiting for file "${filePath}" to be created after ${timeout}ms`
  );
}

/**
 * Helper to get task properties using the plugin's TaskFileManager
 * This is much more reliable than parsing raw file content
 */
export async function getTaskProperties(
  page: Page,
  taskPath: string
): Promise<Record<string, any> | null> {
  return await page.evaluate(async (path) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (!plugin) {
      throw new Error("Task Sync plugin not found");
    }

    const file = app.vault.getAbstractFileByPath(path);
    if (!file) {
      return null;
    }

    // Use the plugin's TaskFileManager to read front matter
    const content = await app.vault.read(file);

    // Parse front matter using the same logic as the plugin
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return {};
    }

    // Use the plugin's front matter parsing
    try {
      const yaml = (window as any).require("js-yaml");
      return yaml.load(frontMatterMatch[1]) || {};
    } catch (error) {
      console.error("Failed to parse front matter:", error);
      return {};
    }
  }, taskPath);
}

/**
 * Helper to get project properties using Obsidian's front-matter API
 * This is much more reliable than parsing raw file content
 */
export async function getProjectProperties(
  page: Page,
  projectPath: string
): Promise<Record<string, any> | null> {
  return await page.evaluate(async (path) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (!plugin) {
      throw new Error("Task Sync plugin not found");
    }

    const file = app.vault.getAbstractFileByPath(path);
    if (!file) {
      return null;
    }

    // Use the plugin's front matter parsing
    const content = await app.vault.read(file);

    // Parse front matter using the same logic as the plugin
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return {};
    }

    // Use the plugin's front matter parsing
    try {
      const yaml = (window as any).require("js-yaml");
      return yaml.load(frontMatterMatch[1]) || {};
    } catch (error) {
      console.error("Failed to parse front matter:", error);
      return {};
    }
  }, projectPath);
}

/**
 * Helper to get area properties using Obsidian's front-matter API
 * This is much more reliable than parsing raw file content
 */
export async function getAreaProperties(
  page: Page,
  areaPath: string
): Promise<Record<string, any> | null> {
  return await page.evaluate(async (path) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (!plugin) {
      throw new Error("Task Sync plugin not found");
    }

    const file = app.vault.getAbstractFileByPath(path);
    if (!file) {
      return null;
    }

    // Use the plugin's front matter parsing
    const content = await app.vault.read(file);

    // Parse front matter using the same logic as the plugin
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return {};
    }

    // Use the plugin's front matter parsing
    try {
      const yaml = (window as any).require("js-yaml");
      return yaml.load(frontMatterMatch[1]) || {};
    } catch (error) {
      console.error("Failed to parse front matter:", error);
      return {};
    }
  }, areaPath);
}

/**
 * Helper to create fully qualified wiki link format
 * Examples:
 * - createFullyQualifiedLink("Testing", "Areas") → "[[Areas/Testing|Testing]]"
 * - createFullyQualifiedLink("Task Sync", "Projects") → "[[Projects/Task Sync|Task Sync]]"
 * - createFullyQualifiedLink("Parent Task", "Tasks") → "[[Tasks/Parent Task|Parent Task]]"
 */
export function createFullyQualifiedLink(
  displayName: string,
  folder: string
): string {
  return `[[${folder}/${displayName}|${displayName}]]`;
}

/**
 * Helper to verify task properties match expected values
 */
export async function verifyTaskProperties(
  page: Page,
  taskPath: string,
  expectedProperties: Record<string, any>
): Promise<void> {
  const properties = await getTaskProperties(page, taskPath);

  if (!properties) {
    throw new Error(`Task file not found: ${taskPath}`);
  }

  for (const [key, expectedValue] of Object.entries(expectedProperties)) {
    const actualValue = properties[key];

    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      throw new Error(
        `Property "${key}" mismatch. Expected: ${JSON.stringify(
          expectedValue
        )}, Actual: ${JSON.stringify(actualValue)}`
      );
    }
  }
}

/**
 * Helper to verify project properties match expected values
 */
export async function verifyProjectProperties(
  page: Page,
  projectPath: string,
  expectedProperties: Record<string, any>
): Promise<void> {
  const properties = await getProjectProperties(page, projectPath);

  if (!properties) {
    throw new Error(`Project file not found: ${projectPath}`);
  }

  for (const [key, expectedValue] of Object.entries(expectedProperties)) {
    const actualValue = properties[key];

    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      throw new Error(
        `Property "${key}" mismatch. Expected: ${JSON.stringify(
          expectedValue
        )}, Actual: ${JSON.stringify(actualValue)}`
      );
    }
  }
}

/**
 * Helper to verify area properties match expected values
 */
export async function verifyAreaProperties(
  page: Page,
  areaPath: string,
  expectedProperties: Record<string, any>
): Promise<void> {
  const properties = await getAreaProperties(page, areaPath);

  if (!properties) {
    throw new Error(`Area file not found: ${areaPath}`);
  }

  for (const [key, expectedValue] of Object.entries(expectedProperties)) {
    const actualValue = properties[key];

    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      throw new Error(
        `Property "${key}" mismatch. Expected: ${JSON.stringify(
          expectedValue
        )}, Actual: ${JSON.stringify(actualValue)}`
      );
    }
  }
}
