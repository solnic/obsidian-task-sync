import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Global setup for all e2e tests
 * Prepares test environment without creating shared Electron instances
 * Each worker will create its own isolated Electron instance
 */
/**
 * Kill any existing Electron processes to ensure clean test environment
 */
async function killExistingElectronProcesses(): Promise<void> {
  try {
    console.log('🔍 Cleaning up any existing Electron processes...');

    // Find Electron processes that might be leftover from previous test runs
    const { stdout } = await execAsync('pgrep -f "Electron.*obsidian.*main.js" || true');

    if (stdout.trim()) {
      const pids = stdout.trim().split('\n').filter(pid => pid.trim());
      console.log(`🔪 Found ${pids.length} existing Electron processes, killing them...`);

      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGTERM');
          console.log(`💀 Killed Electron process ${pid}`);
        } catch (error) {
          console.log(`⚠️ Could not kill process ${pid}:`, error.message);
        }
      }

      // Give processes time to terminate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force kill any remaining processes
      try {
        const { stdout: remainingProcesses } = await execAsync('pgrep -f "Electron.*obsidian.*main.js" || true');
        if (remainingProcesses.trim()) {
          const remainingPids = remainingProcesses.trim().split('\n').filter(pid => pid.trim());
          for (const pid of remainingPids) {
            try {
              process.kill(parseInt(pid), 'SIGKILL');
              console.log(`💀 Force killed stubborn Electron process ${pid}`);
            } catch (error) {
              console.log(`⚠️ Could not force kill process ${pid}:`, error.message);
            }
          }
        }
      } catch (error) {
        // Ignore errors when checking for remaining processes
      }
    } else {
      console.log('✅ No existing Electron processes found');
    }
  } catch (error) {
    console.log('⚠️ Error checking for existing Electron processes:', error.message);
  }
}

/**
 * Clean up old screenshots from previous test runs
 */
async function cleanupScreenshots(): Promise<void> {
  try {
    console.log('🧹 Cleaning up old screenshots...');
    const screenshotsDir = path.join(process.cwd(), 'e2e/screenshots');

    if (fs.existsSync(screenshotsDir)) {
      const files = await fs.promises.readdir(screenshotsDir);
      let cleanedCount = 0;

      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
          const filePath = path.join(screenshotsDir, file);
          try {
            await fs.promises.unlink(filePath);
            cleanedCount++;
          } catch (error) {
            console.log(`⚠️ Could not delete screenshot ${file}:`, error.message);
          }
        }
      }

      console.log(`✅ Cleaned up ${cleanedCount} old screenshots`);
    } else {
      console.log('📁 Screenshots directory does not exist, creating it...');
      await fs.promises.mkdir(screenshotsDir, { recursive: true });
    }
  } catch (error) {
    console.log('⚠️ Error cleaning up screenshots:', error.message);
  }
}

export default async function globalSetup() {
  console.log("🌍 Starting global e2e test setup...");

  try {
    // Kill any existing Electron processes first
    await killExistingElectronProcesses();

    // Clean up old screenshots from previous runs
    await cleanupScreenshots();

    // Build the plugin before running e2e tests
    console.log('🔨 Building plugin for e2e tests...');
    try {
      await execAsync('npm run build', { cwd: process.cwd() });
      console.log('✅ Plugin build completed successfully');
    } catch (buildError) {
      console.error('❌ Plugin build failed:', buildError);
      throw new Error(`Plugin build failed: ${buildError.message}`);
    }

    // Ensure test environments directory exists
    const testEnvDir = path.join(process.cwd(), 'e2e/test-environments');
    await fs.promises.mkdir(testEnvDir, { recursive: true });

    // Clean up any leftover test environments from previous runs
    if (fs.existsSync(testEnvDir)) {
      const entries = await fs.promises.readdir(testEnvDir);
      for (const entry of entries) {
        const entryPath = path.join(testEnvDir, entry);
        try {
          await fs.promises.rm(entryPath, { recursive: true, force: true });
        } catch (error) {
          console.log(`⚠️ Could not clean up ${entry}:`, error.message);
        }
      }
    }

    console.log("✅ Global e2e test setup complete");

  } catch (error) {
    console.error("❌ Global setup failed:", error);
    throw error;
  }
}
