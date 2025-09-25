import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        css: "injected",
        compatibility: {
          componentApi: 4,
        },
      },
    }),
  ],
  test: {
    // Set up DOM environment for component testing
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["e2e/**/*", "node_modules/**/*"],
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
    reporters: ["default"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      obsidian: new URL("./tests/__mocks__/obsidian.ts", import.meta.url)
        .pathname,
    },
    // Tell Vitest to use the `browser` entry points in `package.json` files, even though it's running in Node
    conditions: process.env.VITEST ? ["browser"] : undefined,
  },
  define: {
    global: "globalThis",
  },
});
