/**
 * Test setup file for e2e tests
 * Ensures necessary directories exist and configures test environment
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));

    for (const line of envLines) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
        process.env[key.trim()] = value.trim();
      }
    }
    console.log('🔧 Loaded environment variables from .env file');
  }
} catch (error) {
  console.warn('⚠️ Failed to load .env file:', error.message);
}

// Ensure screenshots and debug directories exist
const screenshotsDir = path.join(process.cwd(), 'e2e', 'screenshots');
const debugDir = path.join(process.cwd(), 'e2e', 'debug');

try {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(debugDir, { recursive: true });
  console.log('📁 Created e2e directories for screenshots and debug info');
} catch (error) {
  console.warn('⚠️ Failed to create e2e directories:', error.message);
}

// Add cleanup for old screenshots/debug files (keep last 10 runs)
try {
  const cleanupOldFiles = (dir: string, maxFiles: number = 50) => {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir)
      .map(file => ({
        name: file,
        path: path.join(dir, file),
        mtime: fs.statSync(path.join(dir, file)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Remove files beyond the limit
    files.slice(maxFiles).forEach(file => {
      try {
        if (fs.statSync(file.path).isDirectory()) {
          fs.rmSync(file.path, { recursive: true });
        } else {
          fs.unlinkSync(file.path);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  };

  cleanupOldFiles(screenshotsDir);
  cleanupOldFiles(debugDir);
} catch (error) {
  // Ignore cleanup errors
}
