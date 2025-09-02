import type { Page, ElectronApplication } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Setup Obsidian with Task Sync plugin for e2e testing
 */
export async function setupObsidianWithTaskSync(
  vaultPath: string,
  dataDir: string
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const { _electron: electron } = await import('playwright');

  const appPath = path.resolve('./.obsidian-unpacked/main.js');
  const resolvedVaultPath = path.resolve(vaultPath);
  const userDataDir = path.resolve(dataDir);

  // Check if Obsidian is unpacked
  if (!fs.existsSync(appPath)) {
    throw new Error(
      `Unpacked Obsidian not found at ${appPath}. ` +
      'Please run: npm run setup:obsidian-playwright'
    );
  }

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
    launchArgs.push('--no-sandbox');
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
      '--disable-features=VizDisplayCompositor'
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

  // Get the first window
  const page = await electronApp.firstWindow();
  console.log("📱 Got main window, title:", await page.title());

  // Wait for Obsidian to be fully loaded
  await page.waitForFunction(() => {
    return typeof (window as any).app !== 'undefined' &&
      (window as any).app.workspace !== undefined &&
      (window as any).app.workspace.layoutReady === true;
  }, { timeout: 30000 });

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
 */
export async function waitForAsyncOperation(timeout: number = 1000): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timeout));
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
  await page.evaluate(async () => {
    const app = (window as any).app;
    const folders = ['Tasks', 'Projects', 'Areas', 'Templates'];
    
    for (const folder of folders) {
      try {
        const exists = await app.vault.adapter.exists(folder);
        if (!exists) {
          await app.vault.createFolder(folder);
          console.log(`Created folder: ${folder}`);
        }
      } catch (error) {
        console.log(`Error creating folder ${folder}:`, error.message);
      }
    }
  });
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
