import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config();

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['e2e/**/*.e2e.ts'],
    exclude: ['tests/**/*'],
    hookTimeout: 10000,
    testTimeout: 10000,
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
    reporter: 'verbose',
    globalSetup: './e2e/global-setup.ts',
    globalTeardown: './e2e/global-teardown.ts',
    setupFiles: ['./e2e/test-setup.ts']
  },
  define: {
    global: 'globalThis'
  }
});
