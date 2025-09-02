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
    testTimeout: isHeadless ? 120000 : 60000,  // Longer timeouts for headless mode
    hookTimeout: isHeadless ? 60000 : 30000,
    fileParallelism: true,
    maxConcurrency: isHeadless ? 1 : 3,        // Single concurrency for headless stability
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
    globalTeardown: './e2e/global-teardown.ts'
  },
  define: {
    global: 'globalThis'
  }
});
