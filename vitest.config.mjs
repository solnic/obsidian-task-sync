import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**/*', 'node_modules/**/*'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true
      }
    },
    reporter: 'default'
  },
  resolve: {
    alias: {
      'obsidian': new URL('./tests/__mocks__/obsidian.ts', import.meta.url).pathname
    }
  },
  define: {
    global: 'globalThis'
  }
});
