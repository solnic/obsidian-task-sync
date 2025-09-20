import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import os from 'os';

config();

const isCI = process.env.CI === 'true';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['e2e/**/*.e2e.ts'],
    exclude: ['tests/**/*'],
    testTimeout: isCI ? 30000 : 10000,
    hookTimeout: isCI ? 30000 : 10000,
    fileParallelism: true,
    minWorkers: isCI ? 6 : Math.max(2, Math.floor(os.cpus().length / 2)),
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
