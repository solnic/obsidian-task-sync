import type { Page, ElectronApplication } from 'playwright';
import { executeCommand, type SharedTestContext } from './shared-context';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Setup Obsidian with Task Sync plugin for e2e testing
 * Uses the shared context system for proper test isolation
 */
export async function setupObsidianWithTaskSync(
  vaultPath: string,
  dataDir: string
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  // Import shared context system
  const { getSharedTestContext } = await import('./shared-context');

  // Use shared context instead of creating new instances
  const context = await getSharedTestContext();

  return {
    electronApp: context.electronApp,
    page: context.page
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
  const { _electron: electron } = await import('playwright');

  // Check for different possible Obsidian structures
  const mainJsPath = path.resolve('./.obsidian-unpacked/main.js');
  const appExtractedMainJs = path.resolve('./.obsidian-unpacked/app-extracted/main.js');
  const obsidianBinaryPath = path.resolve('./.obsidian-unpacked/obsidian');
  const appAsarPath = path.resolve('./.obsidian-unpacked/resources/app.asar');

  let appPath: string;
  if (fs.existsSync(appExtractedMainJs)) {
    // New structure with extracted app - use the extracted main.js with dependencies
    appPath = appExtractedMainJs;
    console.log('🔧 Using extracted app structure with dependencies');
  } else if (fs.existsSync(mainJsPath)) {
    // Old structure with main.js
    appPath = mainJsPath;
    console.log('🔧 Using legacy main.js structure');
  } else if (fs.existsSync(appAsarPath)) {
    // New structure with app.asar - use the binary with app.asar
    appPath = obsidianBinaryPath;
    console.log('🔧 Using native binary structure');
  } else if (fs.existsSync(obsidianBinaryPath)) {
    // Fallback to binary
    appPath = obsidianBinaryPath;
    console.log('🔧 Using fallback binary');
  } else {
    throw new Error(
      `Unpacked Obsidian not found. Checked: ${appExtractedMainJs}, ${mainJsPath}, ${appAsarPath}, ${obsidianBinaryPath}. ` +
      'Please run: npm run setup:obsidian-playwright'
    );
  }

  const resolvedVaultPath = path.resolve(vaultPath);
  const userDataDir = path.resolve(dataDir);

  console.log("🚀 Launching Obsidian with Task Sync plugin...");

  // Determine if we should run in headless mode
  const isHeadless = process.env.E2E_HEADLESS === 'false' ? false :
    (process.env.CI === 'true' ||
      process.env.E2E_HEADLESS === 'true' ||
      process.env.DISPLAY === undefined ||
      process.env.DISPLAY === '');

  console.log(`🖥️ Running in ${isHeadless ? 'headless' : 'windowed'} mode`);

  // Prepare launch arguments for Electron
  const launchArgs = [
    appPath,
    '--user-data-dir=' + userDataDir,
    'open',
    `obsidian://open?path=${encodeURIComponent(resolvedVaultPath)}`,
  ];

  // Add sandbox and headless arguments
  const needsSandboxDisabled = isHeadless ||
    process.env.CI === 'true' ||
    process.env.DISPLAY?.startsWith(':') ||
    !process.env.DISPLAY;

  if (needsSandboxDisabled) {
    launchArgs.push(
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    );
  }

  if (isHeadless) {
    launchArgs.push(
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=VizDisplayCompositor',
      '--disable-dbus',
      '--disable-default-apps',
      '--disable-component-update'
    );
  }

  // Launch Electron
  const electronApp = await electron.launch({
    args: launchArgs,
    timeout: 30000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ...(isHeadless && !process.env.DISPLAY && { DISPLAY: ':99' })
    }
  });

  console.log("✅ Obsidian launched successfully");

  // Get the first window with increased timeout
  console.log("⏳ Waiting for first window...");

  // Add debugging to see what windows are available
  let page;
  try {
    // Wait a bit for the app to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if any windows exist
    const windows = electronApp.windows();
    console.log(`🔍 Found ${windows.length} windows`);

    if (windows.length > 0) {
      page = windows[0];
      console.log("✅ Using existing window");
    } else {
      console.log("⏳ No windows found, waiting for first window...");
      page = await electronApp.firstWindow({ timeout: 30000 });
    }
  } catch (windowError) {
    console.error("❌ Failed to get window:", windowError.message);

    // Try to get any available windows as fallback
    const windows = electronApp.windows();
    console.log(`🔍 Fallback: Found ${windows.length} windows`);

    if (windows.length > 0) {
      page = windows[0];
      console.log("✅ Using fallback window");
    } else {
      throw new Error(`No windows available. Original error: ${windowError.message}`);
    }
  }
  console.log("📱 Got main window, title:", await page.title());

  // Wait for Obsidian to be fully loaded
  console.log("⏳ Waiting for Obsidian app to be ready...");
  try {
    await page.waitForFunction(() => {
      const app = (window as any).app;
      const hasApp = typeof app !== 'undefined';
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
    }, { timeout: 90000 });
  } catch (error) {
    console.error("❌ Timeout waiting for Obsidian to be ready:", error.message);

    // Get current state for debugging
    const currentState = await page.evaluate(() => {
      const app = (window as any).app;
      return {
        hasApp: typeof app !== 'undefined',
        hasWorkspace: app && app.workspace !== undefined,
        layoutReady: app && app.workspace && app.workspace.layoutReady,
        appKeys: app ? Object.keys(app) : [],
        workspaceKeys: app && app.workspace ? Object.keys(app.workspace) : []
      };
    });
    console.log("🔍 Current Obsidian state:", JSON.stringify(currentState, null, 2));
    throw error;
  }

  console.log("✅ Obsidian app object is ready");

  // Enable plugins
  await page.evaluate(() => {
    (window as any).app.plugins.setEnable(true);
  });

  await waitForAsyncOperation(500);

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
      defaultTaskTemplate: "",
      defaultProjectTemplate: "",
      defaultAreaTemplate: ""
    };

    const app = (window as any).app;
    if (app.vault && app.vault.adapter) {
      try {
        await app.vault.adapter.write('.obsidian/plugins/obsidian-task-sync/data.json', JSON.stringify(testSettings));
        console.log("✅ Task Sync plugin settings configured");
      } catch (error) {
        console.log("⚠️ Could not write plugin data file:", error.message);
      }
    }
  });

  // Enable the task-sync plugin
  await page.evaluate(async () => {
    try {
      await (window as any).app.plugins.enablePlugin('obsidian-task-sync');
      console.log("✅ Task Sync plugin enabled");
    } catch (error) {
      console.log("⚠️ Plugin enable error:", error.message);
    }
  });

  await waitForAsyncOperation(1000);

  // Verify plugin is loaded
  try {
    await page.waitForFunction(() => {
      return typeof (window as any).app !== 'undefined' &&
        (window as any).app.plugins !== undefined &&
        (window as any).app.plugins.plugins['obsidian-task-sync'] !== undefined;
    }, { timeout: 30000 });
    console.log("✅ Task Sync plugin verified as loaded");
  } catch (error) {
    const availablePlugins = await page.evaluate(() => {
      if (typeof (window as any).app !== 'undefined' && (window as any).app.plugins) {
        return Object.keys((window as any).app.plugins.plugins || {});
      }
      return [];
    });
    console.error('❌ Task Sync plugin not found. Available plugins:', availablePlugins);
    throw new Error(`Task Sync plugin not loaded. Available plugins: ${availablePlugins.join(', ')}`);
  }

  return { electronApp, page };
}

/**
 * Wait for async operations to complete
 * @deprecated Use proper Playwright waiting instead of fixed timeouts
 */
export async function waitForAsyncOperation(timeout: number = 1000): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Wait for the Task Sync plugin to be fully loaded and ready
 */
export async function waitForTaskSyncPlugin(page: Page, timeout: number = 10000): Promise<void> {
  await page.waitForFunction(() => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.['obsidian-task-sync'];
    return plugin && plugin.settings && typeof plugin.regenerateBases === 'function';
  }, { timeout });
}

/**
 * Get the Task Sync plugin instance
 */
export async function getTaskSyncPlugin(page: Page): Promise<any> {
  return await page.evaluate(() => {
    return (window as any).app.plugins.plugins['obsidian-task-sync'];
  });
}

/**
 * Create a test folder structure
 */
export async function createTestFolders(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const app = (window as any).app;
      const folders = ['Tasks', 'Projects', 'Areas', 'Templates'];

      console.log('🔧 Starting folder creation...');

      for (const folder of folders) {
        try {
          const exists = await app.vault.adapter.exists(folder);
          if (!exists) {
            await app.vault.createFolder(folder);
            console.log(`✅ Created folder: ${folder}`);
          } else {
            console.log(`📁 Folder already exists: ${folder}`);
          }
        } catch (error) {
          console.log(`❌ Error creating folder ${folder}:`, error.message);
          // Don't throw, continue with other folders
        }
      }

      console.log('✅ Folder creation completed');
    });
  } catch (error) {
    console.error('❌ createTestFolders failed:', error.message);
    throw error;
  }
}

/**
 * Create a test task file
 */
export async function createTestTaskFile(
  page: Page,
  filename: string,
  frontmatter: Record<string, any> = {},
  content: string = ''
): Promise<void> {
  await page.evaluate(
    async ({ filename, frontmatter, content }) => {
      const app = (window as any).app;
      const fullPath = `Tasks/${filename}.md`;

      // Create frontmatter content
      const frontmatterLines = ['---'];
      for (const [key, value] of Object.entries(frontmatter)) {
        frontmatterLines.push(`${key}: ${JSON.stringify(value)}`);
      }
      frontmatterLines.push('---', '');

      const fullContent = frontmatterLines.join('\n') + content;

      try {
        await app.vault.create(fullPath, fullContent);
        console.log(`Created test task file: ${fullPath}`);
      } catch (error) {
        console.log(`Error creating task file ${fullPath}:`, error.message);
      }
    },
    { filename, frontmatter, content }
  );
}

/**
 * Get file content from vault
 */
export async function getFileContent(page: Page, filePath: string): Promise<string | null> {
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
export async function fileExists(page: Page, filePath: string): Promise<boolean> {
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
export async function listFilesInFolder(page: Page, folderPath: string): Promise<string[]> {
  return await page.evaluate(
    async ({ path }) => {
      const app = (window as any).app;
      const folder = app.vault.getAbstractFileByPath(path);

      if (!folder || !folder.children) {
        return [];
      }

      return folder.children
        .filter((child: any) => child.extension === 'md')
        .map((child: any) => child.path);
    },
    { path: folderPath }
  );
}

/**
 * Helper function to check if an element is visible
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
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
export async function isElementEnabled(page: Page, selector: string): Promise<boolean> {
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
export async function elementHasClass(page: Page, selector: string, className: string | RegExp): Promise<boolean> {
  try {
    const element = page.locator(selector);
    const classAttribute = await element.getAttribute('class');
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
export async function waitForElementVisible(page: Page, selector: string, timeout = 5000): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Settings helpers for Task Sync e2e tests
 * Based on the ghost-sync settings helper pattern
 */

/**
 * Wait for settings modal to be fully loaded
 */
async function waitForSettingsModal(page: Page): Promise<void> {
  await page.waitForSelector('.modal-container', { timeout: 10000 });

  const possibleNavSelectors = [
    '.vertical-tab-nav',
    '.setting-nav',
    '.nav-buttons-container',
    '.modal-setting-nav',
    '.setting-tab-nav',
    '.settings-nav'
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
  await page.waitForLoadState('networkidle');
}

/**
 * Open Task Sync plugin settings
 */
export async function openTaskSyncSettings(context: SharedTestContext): Promise<void> {
  await executeCommand(context, 'Open Settings');
  await waitForSettingsModal(context.page);

  const taskSyncSelectors = [
    '.vertical-tab-nav-item:has-text("Task Sync")',
    '.vertical-tab-nav .vertical-tab-nav-item[data-tab="task-sync"]',
    '.vertical-tab-nav-item:text("Task Sync")',
    '.vertical-tab-nav :text("Task Sync")'
  ];

  for (const selector of taskSyncSelectors) {
    try {
      const element = context.page.locator(selector);
      const count = await element.count();

      if (count > 0 && await element.first().isVisible()) {
        await element.first().click();
        // Wait for the Task Sync settings to load by looking for the settings container
        await context.page.waitForSelector('.task-sync-settings', { timeout: 5000 });
        // Also wait for the header to be visible
        await context.page.waitForSelector('.task-sync-settings-header h2:has-text("Task Sync Settings")', { timeout: 5000 });
        return;
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error('Could not find Task Sync in settings modal');
}

/**
 * Close settings modal
 */
export async function closeSettings(page: Page): Promise<void> {
  const closeButton = page.locator('.modal-close-button, .modal-close, [aria-label="Close"]');
  if (await closeButton.count() > 0) {
    await closeButton.first().click();
  } else {
    await page.keyboard.press('Escape');
  }

  await page.waitForSelector('.modal-container', { state: 'detached', timeout: 3000 });
}

/**
 * Fill a setting input field
 */
export async function fillSettingInput(page: Page, placeholder: string, value: string): Promise<void> {
  const input = page.locator(`input[placeholder="${placeholder}"]`);
  await input.waitFor({ timeout: 5000 });
  await input.clear();
  await input.fill(value);
  await page.waitForTimeout(100);
}

/**
 * Scroll to a specific settings section
 */
export async function scrollToSettingsSection(page: Page, sectionName: string): Promise<void> {
  const section = page.locator('.task-sync-section-header').filter({ hasText: sectionName });
  await section.scrollIntoViewIfNeeded();
  // Wait for the section to be visible after scrolling
  await section.waitFor({ state: 'visible', timeout: 5000 });
}
