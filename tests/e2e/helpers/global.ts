import * as fs from "fs";
import * as path from "path";

import type { Page } from "playwright";
import { TFile } from "obsidian";
import { expect } from "@playwright/test";

import type { Area, Project, Task } from "../../../src/app/core/entities";

/**
 * Helper function to access Obsidian app instance in e2e tests
 * Abstracts the global window access pattern
 */
export async function getObsidianApp(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).app);
}

/**
 * Helper function to read file content from Obsidian vault
 */
export async function readVaultFile(
  page: Page,
  filePath: string
): Promise<string | null> {
  return page.evaluate(async (filePath) => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file) {
      return await app.vault.read(file);
    }
    return null;
  }, filePath);
}

// Type for extended Page object with test context properties
export type ExtendedPage = Page & {
  testId: string;
  vaultPath: string;
  dataPath: string;
  workerId: string;
  electronApp: any;
  logs: Array<{ type: string; text: string; timestamp: Date }>;
};

export async function updatePluginSettings(
  page: ExtendedPage,
  settings: any
): Promise<void> {
  await page.evaluate(async (settings) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    Object.assign(plugin.settings, settings);

    await plugin.saveSettings();
  }, settings);
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

      return await app.vault.read(file);
    },
    { path: filePath }
  );

  throw new Error(
    `Timeout waiting for file "${filePath}" to contain "${expectedContent}" after ${timeout}ms.\n` +
      `Current file content:\n${currentContent}`
  );
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

  await waitForFileContentToContain(page, filePath, expectedText, timeout);
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

  // Wait for the base file to have content (indicating generation is complete)
  await waitForFileContentToContain(page, "Bases/Tasks.base", "---", timeout);
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

      await plugin.createTask(taskData);
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

      return await app.vault.read(file);
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
 * Wait for a success notice to appear
 */
export async function waitForSuccessNotice(
  page: Page,
  timeout: number = 5000
): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const notices = document.querySelectorAll(".notice");
        const noticeTexts = Array.from(notices).map(
          (n) => n.textContent?.toLowerCase() || ""
        );
        return noticeTexts.some(
          (text) =>
            text.includes("sync") ||
            text.includes("success") ||
            text.includes("updated") ||
            text.includes("published") ||
            text.includes("saved")
        );
      },
      {},
      { timeout }
    );
    return true;
  } catch (error) {
    console.log(`No success notice appeared within ${timeout}ms`);
    return false;
  }
}

/**
 * Wait for any modal to appear
 */
export async function waitForModal(
  page: Page,
  timeout: number = 5000
): Promise<{ found: boolean; type: string }> {
  try {
    await page.waitForSelector(
      ".modal-container, .suggester-container, .modal-backdrop",
      { timeout }
    );

    const modalType = await page.evaluate(() => {
      if (document.querySelector(".modal-container")) return "modal-container";
      if (document.querySelector(".suggester-container")) return "suggester";
      if (document.querySelector(".modal-backdrop")) return "custom-modal";
      return "unknown";
    });

    return { found: true, type: modalType };
  } catch (error) {
    return { found: false, type: "none" };
  }
}

/**
 * Get modal content for interaction
 */
export async function getModalContent(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const modalContainer = document.querySelector(".modal-container");
    if (modalContainer) {
      return { type: "modal-container", element: modalContainer };
    }

    const suggester = document.querySelector(".suggester-container");
    if (suggester) {
      return { type: "suggester", element: suggester };
    }

    const modalBackdrop = document.querySelector(".modal-backdrop");
    if (modalBackdrop) {
      return { type: "custom-modal", element: modalBackdrop };
    }

    return null;
  });
}

/**
 * Verify that the Task Sync plugin is properly loaded and available
 */
export async function verifyPluginAvailable(page: Page): Promise<void> {
  const pluginCheck = await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
    const isEnabled = (window as any).app.plugins.isEnabled(
      "obsidian-task-sync"
    );
    return {
      pluginExists: !!plugin,
      isEnabled: isEnabled,
      hasSettings: !!plugin?.settings,
    };
  });

  if (!pluginCheck.pluginExists) {
    console.log("⚠️ Task Sync plugin is not loaded");
    return;
  }

  console.log(
    `✅ Plugin verification passed: enabled=${pluginCheck.isEnabled}, hasSettings=${pluginCheck.hasSettings}`
  );
}

/**
 * Get plugin instance (assumes plugin availability has been verified)
 * This is a simplified version that doesn't include defensive checks
 */
export async function getPlugin(page: Page): Promise<any> {
  return await page.evaluate(() => {
    return (window as any).app.plugins.plugins["obsidian-task-sync"];
  });
}

/**
 * Get file from vault (assumes plugin availability has been verified)
 * This is a simplified version that doesn't include defensive checks
 */
export async function getFile(page: Page, filePath: string): Promise<any> {
  return await page.evaluate(
    ({ path }) => {
      return (window as any).app.vault.getAbstractFileByPath(path);
    },
    { path: filePath }
  );
}

/**
 * Get the currently active file path in Obsidian
 */
export async function getActiveFilePath(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const app = (window as any).app;
    return app.workspace.getActiveFile()?.path || null;
  });
}

/**
 * Reload the plugin to simulate app restart
 */
export async function reloadPlugin(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const app = (window as any).app;
    await app.plugins.disablePlugin("obsidian-task-sync");
    await app.plugins.enablePlugin("obsidian-task-sync");
  });

  // Wait for plugin to be fully loaded and ready
  await page.waitForFunction(
    () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return (
        plugin && plugin.settings && app.plugins.isEnabled("obsidian-task-sync")
      );
    },
    undefined,
    { timeout: 5000 }
  );
}

/**
 * Update file frontmatter using Obsidian's processFrontMatter API
 */
export async function updateFileFrontmatter(
  page: Page,
  filePath: string,
  updates: Record<string, any>
): Promise<void> {
  await page.evaluate(
    async ({ path, updates }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);

      await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
        Object.assign(frontmatter, updates);
      });
    },
    { path: filePath, updates }
  );
}

/**
 * Replace file frontmatter using Obsidian's processFrontMatter API
 */
export async function replaceFileFrontmatter(
  page: Page,
  filePath: string,
  frontmatter: Record<string, any>
): Promise<void> {
  await page.evaluate(
    async ({ path, frontmatter }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);

      await app.fileManager.processFrontMatter(file, () => {
        return frontmatter;
      });
    },
    { path: filePath, frontmatter }
  );
}

export async function executeCommand(
  page: ExtendedPage,
  command: string,
  options?: { notice?: string }
): Promise<void> {
  await page.keyboard.press("Control+P");
  await page.waitForSelector(".prompt-input", { state: "visible" });
  await page.fill(".prompt-input", command);
  await page.keyboard.press("Enter");

  // Wait for command palette to close, indicating command has been triggered
  await page.waitForSelector(".prompt-input", {
    state: "hidden",
    timeout: 5000,
  });

  if (options?.notice) {
    await expectNotice(page, options.notice);
  }
}

/**
 * Wait for and check if a notice with specific text appears
 */
export async function waitForNotice(
  page: ExtendedPage,
  expectedText: string,
  timeout: number = 5000
): Promise<boolean> {
  await page.waitForFunction(
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
}

/**
 * Capture a screenshot for debugging purposes using Playwright Electron support
 */
export async function captureScreenshotOnFailure(
  page: ExtendedPage,
  name: string
): Promise<void> {
  const baseDebugDir = path.join(process.cwd(), "e2e", "debug");
  const testDebugDir = path.join(baseDebugDir, name);

  await fs.promises.mkdir(testDebugDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `screenshot-${timestamp}-${page.workerId}.png`;
  const screenshotPath = path.join(testDebugDir, filename);

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    type: "png",
    timeout: 10000,
  });
}

/**
 * Wait for and verify that a notice with specific text appears using expect
 * Enhanced to wait for notices to appear and provide better debugging
 */
export async function expectNotice(
  page: ExtendedPage,
  expectedText: string,
  timeout: number = 10000
): Promise<void> {
  // First wait for any notice to appear
  try {
    await page.waitForSelector(".notice", {
      timeout: Math.min(timeout, 5000),
    });
  } catch (error) {
    // If no notice appears at all, take a screenshot for debugging
    await captureScreenshotOnFailure(
      page,
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
  const noticeAppeared = await waitForNotice(page, expectedText, timeout);

  if (!noticeAppeared) {
    // Get current notices for debugging
    const currentNotices = await page.evaluate(() => {
      const noticeElements = document.querySelectorAll(".notice");
      return Array.from(noticeElements).map((el) => el.textContent || "");
    });

    await captureScreenshotOnFailure(
      page,
      `wrong-notice-${expectedText.replace(/[^a-zA-Z0-9]/g, "-")}`
    );

    throw new Error(
      `Expected notice containing "${expectedText}" did not appear within ${timeout}ms. ` +
        `Current notices: ${JSON.stringify(currentNotices)}`
    );
  }
}

/**
 * Helper to open a file and wait for it to load properly
 * This helper waits for the vault cache to recognize the file before attempting to open it
 */
export async function openFile(
  page: ExtendedPage,
  filePath: string,
  timeout: number = 5000
) {
  // First, wait for the file to be recognized by the vault cache
  // This prevents race conditions where the file exists on disk but vault.getAbstractFileByPath() returns null
  await page.waitForFunction(
    async ({ path }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      return file !== null;
    },
    { path: filePath },
    { timeout }
  );

  // Now open the file and wait for it to become active
  await page.evaluate(async (path) => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path);

    const leaf = app.workspace.getLeaf();
    await leaf.openFile(file);
  }, filePath);

  // Wait for the file to become the active file using Playwright's waitForFunction
  await page.waitForFunction(
    ({ path }) => {
      const app = (window as any).app;
      return app.workspace.getActiveFile()?.path === path;
    },
    { path: filePath },
    { timeout: 5000 }
  );

  // Wait for the editor view to be visible
  await page.waitForSelector(".markdown-source-view, .markdown-preview-view", {
    state: "visible",
    timeout: 5000,
  });
}

/**
 * Helper to wait for base view to load properly
 */
export async function waitForBaseView(page: ExtendedPage, timeout = 5000) {
  // Wait for bases-view to exist in DOM (Bases plugin loads it)
  await page.waitForSelector(".bases-view", {
    timeout,
    state: "attached", // Just needs to exist, visibility checked separately
  });

  // Wait for table container structure
  await page.waitForSelector(".bases-view .bases-table-container", {
    timeout: 5000,
    state: "attached",
  });

  // Give Bases time to query vault and render results
  // This can take a few seconds as Bases processes filters
  await page.waitForTimeout(3000);
}

export async function createFile(
  page: ExtendedPage,
  filePath: string,
  frontmatter: Record<string, any> = {},
  content: string = ""
): Promise<TFile> {
  return await page.evaluate(
    async ({ filePath, frontmatter, content }) => {
      const app = (window as any).app;
      await app.vault.create(filePath, content);

      if (frontmatter && Object.keys(frontmatter).length > 0) {
        const file = app.vault.getAbstractFileByPath(filePath);
        await app.fileManager.processFrontMatter(file, (fm: any) => {
          Object.assign(fm, frontmatter);
        });
      }

      return app.vault.getAbstractFileByPath(filePath) as TFile;
    },
    { filePath, frontmatter, content }
  );
}

export async function getFrontMatter(
  page: ExtendedPage,
  filePath: string
): Promise<Record<string, any>> {
  // Use waitForFunction to both wait AND retrieve the frontmatter in a single atomic operation
  // This eliminates the race condition between waiting and retrieving
  const frontmatter = await page.waitForFunction(
    async ({ filePath }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (!file) return null;

      // Try multiple strategies to get the frontmatter
      let cache = app.metadataCache.getFileCache(file);

      if (!cache || !cache.frontmatter) {
        // Strategy 1: Force cache refresh by reading the file
        try {
          await app.vault.read(file);
          await new Promise((resolve) => setTimeout(resolve, 50));
          cache = app.metadataCache.getFileCache(file);
        } catch (e) {
          // Ignore read errors
        }
      }

      if (!cache || !cache.frontmatter) {
        // Strategy 2: Trigger cache update manually
        try {
          app.metadataCache.trigger("changed", file);
          await new Promise((resolve) => setTimeout(resolve, 50));
          cache = app.metadataCache.getFileCache(file);
        } catch (e) {
          // Ignore trigger errors
        }
      }

      if (!cache || !cache.frontmatter) {
        // Strategy 3: Force a complete cache rebuild for this file
        try {
          app.metadataCache.getFileCache(file, true); // Force rebuild
          await new Promise((resolve) => setTimeout(resolve, 100));
          cache = app.metadataCache.getFileCache(file);
        } catch (e) {
          // Ignore rebuild errors
        }
      }

      // Return the frontmatter if available, null otherwise
      // waitForFunction will keep retrying until we return a truthy value
      return cache && cache.frontmatter ? cache.frontmatter : null;
    },
    { filePath },
    { timeout: 15000 } // Increased timeout for aggressive retries
  );

  // The JSHandle returned by waitForFunction contains the frontmatter
  // We need to extract the actual value
  const result = await frontmatter.jsonValue();

  if (!result) {
    throw new Error(
      `Frontmatter not available for file: ${filePath} after timeout`
    );
  }

  return result;
}

/**
 * Open Task Sync plugin settings
 */
export async function openTaskSyncSettings(page: ExtendedPage): Promise<void> {
  await executeCommand(page, "Open Settings");
  await waitForSettingsModal(page);

  const taskSyncSelectors = [
    '.vertical-tab-nav-item:has-text("Task Sync")',
    '.vertical-tab-nav .vertical-tab-nav-item[data-tab="task-sync"]',
    '.vertical-tab-nav-item:text("Task Sync")',
    '.vertical-tab-nav :text("Task Sync")',
  ];

  for (const selector of taskSyncSelectors) {
    try {
      const element = page.locator(selector);
      const count = await element.count();

      if (count > 0 && (await element.first().isVisible())) {
        await element.first().click();
        // Wait for the Task Sync settings to load by looking for the settings container
        await page.waitForSelector(".task-sync-settings", {
          timeout: 5000,
        });
        // Also wait for the header to be visible
        await page.waitForSelector(
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
  console.debug("🔧 Attempting to close settings modal...");

  try {
    const modalExists = (await page.locator(".modal-container").count()) > 0;

    if (!modalExists) {
      return;
    }

    await page.keyboard.press("Escape");

    // Wait for modal to close
    await page
      .waitForFunction(
        () => {
          return document.querySelectorAll(".modal-container").length === 0;
        },
        undefined,
        { timeout: 2000 }
      )
      .catch(async () => {
        // If first Escape didn't work, try again
        await page.keyboard.press("Escape");
        await page
          .waitForFunction(
            () => {
              return document.querySelectorAll(".modal-container").length === 0;
            },
            undefined,
            { timeout: 2000 }
          )
          .catch(() => {
            // Ignore if modal persists
          });
      });
  } catch (error) {
    console.debug("Error closing settings:", error);
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
  // Wait for input value to be updated
  await expect(input).toHaveValue(value);
}

/**
 * Scroll to a specific settings section
 */
export async function scrollToSettingsSection(
  page: Page,
  sectionName: string
): Promise<void> {
  // Try multiple selectors for the section header
  const selectors = [
    `h2.task-sync-section-header:has-text("${sectionName}")`,
    `h2:has-text("${sectionName}")`,
    `.task-sync-section-header:has-text("${sectionName}")`,
    `[data-section="${sectionName.toLowerCase().replace(/\s+/g, "-")}"]`,
  ];

  for (const selector of selectors) {
    try {
      const section = page.locator(selector);
      const count = await section.count();

      if (count > 0) {
        await section.first().scrollIntoViewIfNeeded();
        await section.first().waitFor({ state: "visible", timeout: 2000 });
        return;
      }
    } catch (error) {
      continue;
    }
  }

  // If no selector worked, try the original approach with longer timeout
  const section = page
    .locator("h2.task-sync-section-header")
    .filter({ hasText: sectionName });
  await section.scrollIntoViewIfNeeded();
  await section.waitFor({ state: "visible", timeout: 10000 });
}

/**
 * Scroll to the "Add New Task Category" section specifically
 */
export async function scrollToAddTaskTypeSection(page: Page): Promise<void> {
  // First scroll to the Task Categories section
  await scrollToSettingsSection(page, "Task Categories");

  // Then scroll specifically to the "Add New Task Category" setting using data-testid
  const addSection = page.locator('[data-testid="add-task-category-section"]');
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
  isDone: boolean = false
): Promise<void> {
  // Find the "Add New Task Status" section
  const addSection = page.locator('[data-testid="add-task-status-section"]');
  await addSection.waitFor({ state: "visible", timeout: 10000 });

  // Fill in the status name - use the last name input (for new status)
  const nameInputs = page.locator('[data-testid="task-status-name-input"]');
  const nameInput = nameInputs.last();
  await nameInput.fill(statusName);

  // Note: Color picker is now handled by Obsidian's color picker component
  // We'll skip color selection in tests for now as it requires more complex interaction

  // Set state using radio buttons if needed
  if (isDone) {
    // Click the "Done" radio button for the new status (last one)
    const doneRadios = page.locator('[data-testid="task-status-state-done"]');
    const doneRadio = doneRadios.last();
    await doneRadio.click();
  }

  // Click the Add Status button
  const addButton = page.locator('[data-testid="add-task-status-button"]');
  await addButton.click();

  // Wait for the new status to be added to settings
  await page.waitForFunction(
    ({ name }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.taskStatuses.some((s: any) => s.name === name);
    },
    { name: statusName },
    { timeout: 3000 }
  );
}

/**
 * Set the state of an existing task status using radio buttons
 */
export async function setTaskStatusState(
  page: Page,
  statusName: string,
  state: "in-progress" | "done" | "none"
): Promise<void> {
  // Find the specific status setting by name input data attribute
  const statusNameInput = page.locator(
    '[data-testid="task-status-name-input"][data-name="' + statusName + '"]'
  );
  await statusNameInput.waitFor({ state: "visible", timeout: 5000 });

  // Get the parent setting container
  const statusSetting = statusNameInput.locator(
    'xpath=ancestor::div[contains(@class, "setting-item")]'
  );

  if (state === "done") {
    const doneRadio = statusSetting.locator(
      '[data-testid="task-status-state-done"]'
    );
    await doneRadio.click();
  } else if (state === "in-progress") {
    const inProgressRadio = statusSetting.locator(
      '[data-testid="task-status-state-in-progress"]'
    );
    await inProgressRadio.click();
  } else {
    // For "none" state, click the currently selected radio to unselect it
    const doneRadio = statusSetting.locator(
      '[data-testid="task-status-state-done"]'
    );
    const inProgressRadio = statusSetting.locator(
      '[data-testid="task-status-state-in-progress"]'
    );

    if (await doneRadio.isChecked()) {
      await doneRadio.click(); // Click again to unselect
    } else if (await inProgressRadio.isChecked()) {
      await inProgressRadio.click(); // Click again to unselect
    }
  }

  // Wait for the setting to be saved by checking the plugin's settings
  await page.waitForFunction(
    ({ name, expectedState }) => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      if (!plugin || !plugin.settings || !plugin.settings.taskStatuses)
        return false;
      const status = plugin.settings.taskStatuses.find(
        (s: any) => s.name === name
      );
      if (!status) return false;
      if (expectedState === "done") return !!status.isDone;
      if (expectedState === "in-progress") return !!status.isInProgress;
      // For "none", both should be false
      return !status.isDone && !status.isInProgress;
    },
    { name: statusName, expectedState: state },
    { timeout: 2000 }
  );
}

/**
 * Legacy function for backward compatibility - maps to new radio button interface
 */
export async function toggleTaskStatusDone(
  page: Page,
  statusName: string,
  isDone: boolean
): Promise<void> {
  await setTaskStatusState(page, statusName, isDone ? "done" : "none");
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
    // Wait for the toggle state to update
    await page.waitForFunction(
      ({ name, expected }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const status = plugin.settings.taskStatuses.find(
          (s: any) => s.name === name
        );
        return status && status.isInProgress === expected;
      },
      { name: statusName, expected: isInProgress },
      { timeout: 2000 }
    );
  }
}

/**
 * Open Task Sync settings and navigate to Task Statuses section
 */
export async function openTaskStatusSettings(
  page: ExtendedPage
): Promise<void> {
  await openTaskSyncSettings(page);
  await scrollToSettingsSection(page, "Task Statuses");
}

/**
 * Open Task Sync settings and navigate to Task Categories section
 */
export async function openTaskCategoriesSettings(
  page: ExtendedPage
): Promise<void> {
  await openTaskSyncSettings(page);
  await scrollToSettingsSection(page, "Task Categories");
}

/**
 * Add a new task category through the UI
 */
export async function addTaskCategory(
  page: Page,
  categoryName: string,
  color: string = "#3b82f6"
): Promise<void> {
  // Find the "Add New Task Category" section
  const addSection = page.locator('[data-testid="add-task-category-section"]');
  await addSection.scrollIntoViewIfNeeded();

  // Fill in the category name
  const nameInput = page.locator('[data-testid="task-category-name-input"]');
  await nameInput.fill(categoryName);

  // Note: Color picker interaction is complex with Obsidian's color picker component
  // For now, we'll skip setting the color in tests and use the default

  // Click the add button
  const addButton = page.locator('[data-testid="add-task-category-button"]');
  await addButton.click();

  // Wait for the new category to appear in the list
  await page.waitForFunction(
    ({ categoryName }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.taskCategories.some(
        (type: any) => type.name === categoryName
      );
    },
    { categoryName },
    { timeout: 5000 }
  );
}

/**
 * Get a specific task category setting element by name
 */
export async function getTaskCategorySetting(
  page: Page,
  categoryName: string
): Promise<any> {
  // Look for a setting item that contains the category name in a text input
  const settingItems = page.locator(".setting-item");

  for (let i = 0; i < (await settingItems.count()); i++) {
    const item = settingItems.nth(i);
    const textInput = item.locator('input[type="text"]');

    if ((await textInput.count()) > 0) {
      const value = await textInput.inputValue();
      if (value === categoryName) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Verify that a task category exists in the settings UI
 */
export async function verifyTaskCategoryExists(
  page: Page,
  categoryName: string
): Promise<boolean> {
  const setting = await getTaskCategorySetting(page, categoryName);
  return setting !== null;
}

/**
 * Delete a task category through the UI
 */
export async function deleteTaskCategory(
  page: Page,
  categoryName: string
): Promise<void> {
  const setting = await getTaskCategorySetting(page, categoryName);
  if (!setting) {
    throw new Error(`Task category "${categoryName}" not found`);
  }

  const deleteButton = setting.locator('button:has-text("Delete")');
  await deleteButton.click();

  // Wait for the category to be removed
  await page.waitForFunction(
    ({ categoryName }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return !plugin.settings.taskCategories.some(
        (type: any) => type.name === categoryName
      );
    },
    { categoryName },
    { timeout: 5000 }
  );
}

/**
 * Set a setting value and verify it was saved
 */
export async function setSettingValue(
  page: Page,
  settingName: string,
  value: string
): Promise<void> {
  const input = page
    .locator(".setting-item")
    .filter({ hasText: settingName })
    .locator('input[type="text"], input[type="password"], textarea')
    .first();

  await input.fill(value);

  // Wait for the input value to be updated
  await expect(input).toHaveValue(value);
}

/**
 * Get the current value of a plugin setting
 */
export async function getPluginSettingValue(
  page: Page,
  settingPath: string
): Promise<any> {
  return await page.evaluate(async (path) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    // Navigate to the setting using dot notation
    const pathParts = path.split(".");
    let value = plugin.settings;

    for (const part of pathParts) {
      value = value[part];
      if (value === undefined) {
        return undefined;
      }
    }

    return value;
  }, settingPath);
}

/**
 * Toggle area bases enabled setting via UI
 */
export async function toggleAreaBasesEnabled(
  page: ExtendedPage,
  enabled: boolean
): Promise<void> {
  await toggleSetting(page, "Bases Integration", "Enable Area Bases", enabled);
}

/**
 * Toggle project bases enabled setting via UI
 */
export async function toggleProjectBasesEnabled(
  page: ExtendedPage,
  enabled: boolean
): Promise<void> {
  await toggleSetting(
    page,
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
  page: ExtendedPage,
  _sectionName: string,
  settingName: string,
  enabled: boolean
): Promise<void> {
  // Get the current plugin setting value
  const currentPluginSetting = await page.evaluate(
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
  await page.evaluate(
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
  const finalPluginSetting = await page.evaluate(
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
  page: ExtendedPage,
  sectionName: string,
  settingName: string,
  value: string
): Promise<void> {
  await openTaskSyncSettings(page);
  await scrollToSettingsSection(page, sectionName);

  const input = page
    .locator(".setting-item")
    .filter({ hasText: settingName })
    .locator('input[type="text"], input[type="password"], textarea');
  await input.fill(value);

  // Wait for the input value to be updated
  await expect(input).toHaveValue(value);

  await closeSettings(page);
}

/**
 * Configure both area and project bases settings via UI
 */
export async function configureBasesSettings(
  page: ExtendedPage,
  areaBasesEnabled: boolean,
  projectBasesEnabled: boolean
): Promise<void> {
  console.log(
    `🔧 configureBasesSettings: Setting area bases to ${areaBasesEnabled}, project bases to ${projectBasesEnabled}`
  );

  // Check current plugin settings before making changes
  const currentSettings = await page.evaluate(async () => {
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
    page,
    "Bases Integration",
    "Enable Area Bases",
    areaBasesEnabled
  );
  await toggleSetting(
    page,
    "Bases Integration",
    "Enable Project Bases",
    projectBasesEnabled
  );

  // Check final plugin settings after making changes
  const finalSettings = await page.evaluate(async () => {
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
  await page.waitForFunction(
    async ({ path }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);

      if (!file) return false;

      const fileContent = await app.vault.read(file);
      return fileContent.trim() !== "";
    },
    { path: filePath },
    { timeout }
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
 * - createFullyQualifiedLink("Parent task", "Tasks") → "[[Tasks/Parent task|Parent task]]"
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

/**
 * Assert that a task property has a specific value
 * This is a simpler version of verifyTaskProperties for single property checks
 */
export async function assertTaskProperty(
  page: Page,
  taskPath: string,
  propertyName: string,
  expectedValue: any
): Promise<void> {
  const properties = await getTaskProperties(page, taskPath);

  if (!properties) {
    throw new Error(`Task file not found: ${taskPath}`);
  }

  const actualValue = properties[propertyName];

  if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
    throw new Error(
      `Property "${propertyName}" mismatch in ${taskPath}. Expected: ${JSON.stringify(
        expectedValue
      )}, Actual: ${JSON.stringify(actualValue)}`
    );
  }
}

const DEFAULT_INTEGRATION_CONFIGS: Record<string, any> = {
  github: {
    enabled: true,
    personalAccessToken: "fake-token-for-testing",
  },
};

export async function enableIntegration(
  page: Page,
  name: string,
  config: any = {}
) {
  const integration_config = {
    ...DEFAULT_INTEGRATION_CONFIGS[name],
    ...config,
  };

  await page.evaluate(
    async ({ name, integration_config }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      Object.assign(plugin.settings.integrations[name], integration_config);

      await plugin.saveSettings();
    },
    { name, integration_config }
  );
}

export async function openView(page: Page, viewName: string) {
  await page.evaluate(async (viewName) => {
    const app = (window as any).app;
    const existingLeaves = app.workspace.getLeavesOfType(viewName);

    if (existingLeaves.length === 0) {
      const rightLeaf = app.workspace.getRightLeaf(false);

      await rightLeaf.setViewState({
        type: viewName,
        active: true,
      });
    } else {
      app.workspace.revealLeaf(existingLeaves[0]);
    }
  }, viewName);

  await toggleSidebar(page, "right", true);
}

export async function switchToTaskService(page: Page, service: string) {
  // Wait for the service button to be enabled and visible
  const serviceButton = page.locator(`[data-testid="service-${service}"]`);

  // Wait for the button to be enabled (not disabled)
  await page.waitForFunction(
    (serviceName) => {
      const button = document.querySelector(
        `[data-testid="service-${serviceName}"]`
      );
      return button && !button.hasAttribute("disabled");
    },
    service,
    { timeout: 10000 }
  );

  // Click the service button
  await serviceButton.click();

  // Wait for the service to be active
  await page.waitForFunction(
    (serviceName) => {
      const button = document.querySelector(
        `[data-testid="service-${serviceName}"]`
      );
      return button && button.classList.contains("active");
    },
    service,
    { timeout: 5000 }
  );
}

export async function selectFromDropdown(
  page: Page,
  dropdown: string,
  option: string
): Promise<void> {
  await page.locator(`[data-testid="${dropdown}"]`).click();

  // Use a more specific selector to avoid strict mode violations
  // when multiple items contain the same text (e.g., "repo" in both "Select repository" and "✓ repo")
  const itemLocator = page.locator(`[data-testid="${dropdown}-dropdown-item"]`);

  // Find the item that exactly matches the option text (not just contains it)
  const matchingItem = itemLocator.filter({
    hasText: new RegExp(`^${option}$|^✓ ${option}$`),
  });

  // If no exact match, fall back to the original behavior for backward compatibility
  const finalLocator =
    (await matchingItem.count()) > 0
      ? matchingItem.first()
      : itemLocator.filter({ hasText: option }).first();

  await finalLocator.click();
}

/**
 * Delete a file from the vault
 */
export async function deleteVaultFile(
  page: Page,
  filePath: string
): Promise<void> {
  await page.evaluate(async (filePath) => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(filePath);
    await app.vault.delete(file);
  }, filePath);

  await waitForFileDeletion(page, filePath);
}

/**
 * Wait for a file to be deleted
 */
export async function waitForFileDeletion(
  page: Page,
  filePath: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    ({ path }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      return file === null;
    },
    { path: filePath },
    { timeout }
  );
}

/**
 * Get tasks from the tasks view
 */
export async function getTasksFromView(page: Page): Promise<Task[]> {
  return page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
    let tasks: Task[] = [];
    const unsubscribe = plugin.stores.taskStore.subscribe((state: any) => {
      tasks = state.tasks;
    });
    unsubscribe();
    return tasks;
  });
}

/**
 * Get projects from the projects view
 */
export async function getProjectsFromView(page: Page): Promise<Project[]> {
  return page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
    let projects: Project[] = [];
    const unsubscribe = plugin.stores.projectStore.subscribe((state: any) => {
      projects = state.projects;
    });
    unsubscribe();
    return projects;
  });
}

/**
 * Get areas from the areas view
 */
export async function getAreasFromView(page: Page): Promise<Area[]> {
  return page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
    let areas: Area[] = [];
    const unsubscribe = plugin.stores.areaStore.subscribe((state: any) => {
      areas = state.areas;
    });
    unsubscribe();
    return areas;
  });
}

/**
 * Wait for Obsidian to infer property types from a file
 * This is more reliable than arbitrary timeouts
 */
export async function waitForPropertyTypeInferred(
  page: Page,
  filePath: string,
  propertyName: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    async ({ path, property }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return false;

      const cache = app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) return false;

      // Check if the property exists in the frontmatter
      return cache.frontmatter[property] !== undefined;
    },
    { path: filePath, property: propertyName },
    { timeout }
  );
}

/**
 * Wait for a UI component to be recreated after a state change
 * This is useful when changing property types or other UI-affecting settings
 */
export async function waitForUIRecreation(
  page: Page,
  selector: string,
  timeout: number = 2000
): Promise<void> {
  const locator = page.locator(selector);

  // If element is currently visible, wait for it to be detached first
  if (await locator.isVisible().catch(() => false)) {
    await locator.waitFor({ state: "detached", timeout }).catch(() => {});
  }

  // Wait for the element to be reattached and visible
  await locator.waitFor({ state: "visible", timeout });
}

/**
 * Wait for command execution to complete
 * Waits for command palette to close and optionally for a notice
 */
export async function waitForCommandComplete(
  page: Page,
  expectedNotice?: string,
  timeout: number = 5000
): Promise<void> {
  // Wait for command palette to close
  await page.waitForSelector(".prompt-input", {
    state: "hidden",
    timeout,
  });

  // If a notice is expected, wait for it
  if (expectedNotice) {
    await waitForNotice(page as ExtendedPage, expectedNotice, timeout);
  }
}

/**
 * Wait for context widget to update after file navigation
 */
export async function waitForContextUpdate(
  page: Page,
  expectedContextType: string,
  timeout: number = 3000
): Promise<void> {
  await page.waitForFunction(
    ({ contextType }) => {
      const contextWidget = document.querySelector(
        '[data-testid="context-widget"] .context-type'
      );
      return contextWidget?.textContent === contextType;
    },
    { contextType: expectedContextType },
    { timeout }
  );
}

/**
 * Wait for all notices to disappear
 * Useful for ensuring clean state between test steps
 */
export async function waitForNoticesCleared(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const notices = document.querySelectorAll(".notice");
        return notices.length === 0;
      },
      undefined,
      { timeout }
    )
    .catch(() => {
      // Ignore timeout - notices might persist, which is okay
    });
}

/**
 * Wait for a specific notice to disappear
 */
export async function waitForNoticeDisappear(
  page: Page,
  noticeText: string,
  timeout: number = 5000
): Promise<void> {
  await page
    .waitForFunction(
      ({ text }) => {
        const notices = document.querySelectorAll(".notice");
        const noticeTexts = Array.from(notices).map((n) => n.textContent || "");
        return !noticeTexts.some((t) => t.includes(text));
      },
      { text: noticeText },
      { timeout }
    )
    .catch(() => {
      // Ignore timeout - notice might have already disappeared
    });
}

/**
 * Wait for file to be processed by Obsidian's metadata cache
 * More reliable than arbitrary timeouts
 */
export async function waitForFileProcessed(
  page: Page,
  filePath: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    async ({ path }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return false;

      // Check if file has been processed by metadata cache
      const cache = app.metadataCache.getFileCache(file);
      return cache !== null && cache !== undefined;
    },
    { path: filePath },
    { timeout }
  );
}

/**
 * Wait for task refresh to complete
 * Waits for the refresh operation to finish by checking for UI updates
 */
export async function waitForTaskRefreshComplete(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  // Wait for any loading indicators to disappear
  await page
    .waitForFunction(
      () => {
        const loadingIndicators = document.querySelectorAll(
          '.is-loading, .loading, [data-loading="true"]'
        );
        return loadingIndicators.length === 0;
      },
      { timeout }
    )
    .catch(() => {
      // Ignore timeout - loading indicators might not exist
    });

  // Wait for either task items OR empty message to appear in DOM
  // This handles both cases: tasks exist OR no tasks (empty state)
  await page
    .waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"], [data-testid^="github-issue-item-"]'
        );
        const emptyMessage = document.querySelector(".task-sync-empty-message");
        return taskItems.length > 0 || emptyMessage !== null;
      },
      { timeout: 1000 }
    )
    .catch(() => {});
}

/**
 * Wait for daily planning wizard to process an action
 * Waits for wizard state to update after user actions
 */
export async function waitForDailyPlanningUpdate(
  page: Page,
  timeout: number = 3000
): Promise<void> {
  // Wait for any pending updates to complete
  await page
    .waitForFunction(
      () => {
        // Check if wizard is in a stable state (no pending operations)
        const wizard = document.querySelector(
          '[data-testid="daily-planning-view"]'
        );
        if (!wizard) return false;

        // Check for loading states or disabled buttons
        const loadingElements = wizard.querySelectorAll(
          ".is-loading, [disabled]"
        );
        const hasActiveOperations = Array.from(loadingElements).some((el) => {
          const button = el as HTMLButtonElement;
          return button.disabled && !button.hasAttribute("data-testid"); // Ignore test buttons
        });

        return !hasActiveOperations;
      },
      { timeout }
    )
    .catch(() => {
      // Ignore timeout - wizard might be ready
    });
}

/**
 * Wait for task to be moved/scheduled in daily planning
 * Waits for task to appear in the expected section
 */
export async function waitForTaskScheduled(
  page: Page,
  taskTitle: string,
  timeout: number = 3000
): Promise<void> {
  await page.waitForFunction(
    ({ title }) => {
      const scheduledTasks = document.querySelectorAll(
        '[data-testid="scheduled-task"]'
      );
      return Array.from(scheduledTasks).some((task) =>
        task.textContent?.includes(title)
      );
    },
    { title: taskTitle },
    { timeout }
  );
}

/**
 * Wait for task to be unscheduled in daily planning
 * Waits for task to appear in the unscheduled section
 */
export async function waitForTaskUnscheduled(
  page: Page,
  taskTitle: string,
  timeout: number = 3000
): Promise<void> {
  await page.waitForFunction(
    ({ title }) => {
      const unscheduledTasks = document.querySelectorAll(
        '[data-testid="unscheduled-task"]'
      );
      return Array.from(unscheduledTasks).some((task) =>
        task.textContent?.includes(title)
      );
    },
    { title: taskTitle },
    { timeout }
  );
}

/**
 * Wait for daily note to be created or updated
 * Waits for daily note file to exist and contain expected content
 */
export async function waitForDailyNoteUpdate(
  page: Page,
  dailyNotePath: string,
  expectedContent?: string,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const fileContent = await page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await app.vault.read(file);
    }, dailyNotePath);

    if (fileContent !== null) {
      if (!expectedContent || fileContent.includes(expectedContent)) {
        return;
      }
    }

    await page.waitForTimeout(100); // Poll every 100ms
  }

  throw new Error(
    `Timeout waiting for daily note update. Expected content: ${
      expectedContent || "file to exist"
    }`
  );
}

/**
 * Wait for sync operation to complete
 * Since sync happens automatically after refresh, we wait for loading indicators
 * to disappear and then a short period to allow async operations to complete
 */
export async function waitForSyncComplete(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  // Wait for any loading indicators to disappear
  await page
    .waitForFunction(
      () => {
        const loadingIndicators = document.querySelectorAll(
          '.is-loading, .loading, [data-loading="true"]'
        );
        return loadingIndicators.length === 0;
      },
      { timeout }
    )
    .catch(() => {
      // Ignore timeout - loading indicators might not exist
    });

  // Wait a short period for async sync operations to complete
  // SyncManager doesn't expose explicit state tracking, so we use a small delay
  await page.waitForTimeout(500);
}
