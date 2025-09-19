import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config();

const isCI = process.env.CI === 'true';
const isHeadless = isCI || process.env.E2E_HEADLESS === 'true' || !process.env.DISPLAY;

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['e2e/**/*.e2e.ts'],
    exclude: ['tests/**/*'],
    hookTimeout: isHeadless ? 30000 : 10000,
    testTimeout: isHeadless ? 60000 : 10000,
    fileParallelism: true,
    minWorkers: isHeadless ? 3 : 10,
    maxConcurrency: isHeadless ? 3 : 5,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true
      }
    },
    reporter: isCI ? ['verbose', 'junit'] : 'verbose',
    outputFile: isCI ? {
      junit: './test-results/junit.xml'
    } : undefined,
    globalSetup: './e2e/global-setup.ts',
    globalTeardown: './e2e/global-teardown.ts',
    setupFiles: ['./e2e/test-setup.ts']
  },
  define: {
    global: 'globalThis'
  }
});
