import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config();

const isCI = process.env.CI === 'true';
const _isHeadless = isCI || process.env.E2E_HEADLESS === 'true';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['e2e/**/*.e2e.ts'],
    exclude: ['tests/**/*'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: true,
    minWorkers: 6,
    maxConcurrency: 1,
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
