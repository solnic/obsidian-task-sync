import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Global teardown for all e2e tests
 * Cleans up any remaining processes and test artifacts
 */
export default async function globalTeardown() {
  console.log("🧹 Starting global e2e test teardown...");

  try {
    // Kill any remaining Electron processes
    console.log('🔍 Cleaning up any remaining Electron processes...');
    
    try {
      const { stdout } = await execAsync('pgrep -f "Electron.*obsidian.*main.js" || true');
      
      if (stdout.trim()) {
        const pids = stdout.trim().split('\n').filter(pid => pid.trim());
        console.log(`🔪 Found ${pids.length} remaining Electron processes, killing them...`);
        
        for (const pid of pids) {
          try {
            process.kill(parseInt(pid), 'SIGKILL');
            console.log(`💀 Killed Electron process ${pid}`);
          } catch (error) {
            console.log(`⚠️ Could not kill process ${pid}:`, error.message);
          }
        }
      } else {
        console.log('✅ No remaining Electron processes found');
      }
    } catch (error) {
      console.log('⚠️ Error checking for remaining Electron processes:', error.message);
    }

    console.log("✅ Global e2e test teardown complete");

  } catch (error) {
    console.error("❌ Global teardown failed:", error);
    // Don't throw error in teardown to avoid masking test failures
  }
}
