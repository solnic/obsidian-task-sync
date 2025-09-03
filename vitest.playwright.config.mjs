import { defineConfig } from 'vitest/config';
import * as fs from 'fs';

// Ensure HAR recordings directory exists
const harDir = './e2e/recordings';
if (!fs.existsSync(harDir)) {
  fs.mkdirSync(harDir, { recursive: true });
}

// Ensure screenshots directory exists
const screenshotsDir = './e2e/screenshots';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const isCI = process.env.CI === 'true';
const isHeadless = isCI || process.env.E2E_HEADLESS === 'true';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['e2e/**/*.e2e.ts'],
    exclude: ['tests/**/*'],
    testTimeout: 5000,
    hookTimeout: 5000,
    fileParallelism: true,
    maxConcurrency: 3,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: isHeadless,
        isolate: true
      }
    },
    reporter: isCI ? ['verbose', 'junit'] : 'default',
    outputFile: isCI ? {
      junit: './test-results/junit.xml'
    } : undefined,
    globalSetup: './e2e/global-setup.ts',
    globalTeardown: './e2e/global-teardown.ts',
    // Ensure screenshots and debug directories are preserved
    setupFiles: ['./e2e/test-setup.ts']
  },
  define: {
    global: 'globalThis'
  }
});
