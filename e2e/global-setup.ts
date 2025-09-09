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
    const { stdout } = await execAsync('pgrep -f "Electron.*obsidian.*main.js" || true');

    if (stdout.trim()) {
      const pids = stdout.trim().split('\n').filter(pid => pid.trim());
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGTERM');
        } catch (error) {
          // NO OP
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
            } catch (error) {
              // NO OP
            }
          }
        }
      } catch (error) {
        // Ignore errors when checking for remaining processes
      }
    }
  } catch (error) {
    console.log('⚠️ Error checking for existing Electron processes:', error.message);
  }
}

/**
 * Clean up old debug artifacts from previous test runs
 */
async function cleanupDebugArtifacts(): Promise<void> {
  try {
    const debugDir = path.join(process.cwd(), 'e2e/debug');

    if (fs.existsSync(debugDir)) {
      await fs.promises.rm(debugDir, { recursive: true, force: true });
    }

    await fs.promises.mkdir(debugDir, { recursive: true });
  } catch (error) {
    console.log('⚠️ Error cleaning up debug artifacts:', error.message);
  }
}

export default async function globalSetup() {
  try {
    // Kill any existing Electron processes first
    await killExistingElectronProcesses();

    // Clean up old debug artifacts from previous runs
    await cleanupDebugArtifacts();

    try {
      await execAsync('npm run build', { cwd: process.cwd() });
    } catch (buildError) {
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
  } catch (error) {
    throw error;
  }
}
