import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

/**
 * Global teardown for all e2e tests
 * Cleans up any remaining processes and test artifacts
 */
export default async function globalTeardown() {
  try {
    // Clean up test environments
    await cleanupTestEnvironments();

    // Kill any remaining Electron processes
    console.log("🔍 Cleaning up any remaining Electron processes...");

    try {
      const { stdout } = await execAsync(
        'pgrep -f "Electron.*obsidian.*main.js" || true'
      );

      if (stdout.trim()) {
        const pids = stdout
          .trim()
          .split("\n")
          .filter((pid) => pid.trim());

        for (const pid of pids) {
          try {
            process.kill(parseInt(pid), "SIGKILL");
          } catch (error) {}
        }
      }
    } catch (error) {}

    console.log("✅ Global e2e test teardown complete");
  } catch (error) {
    console.error("❌ Global teardown failed:", error);
  }
}

/**
 * Clean up test environments
 */
async function cleanupTestEnvironments(): Promise<void> {
  const testEnvDir = path.join(process.cwd(), "tests/e2e/test-environments");
  if (fs.existsSync(testEnvDir)) {
    const entries = await fs.promises.readdir(testEnvDir);
    for (const entry of entries) {
      const entryPath = path.join(testEnvDir, entry);
      await fs.promises.rm(entryPath, { recursive: true, force: true });
    }
  }
}
