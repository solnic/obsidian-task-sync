#!/usr/bin/env node

/**
 * Pre-test script that runs before e2e tests
 * Ensures the e2e testing environment is properly set up
 * This runs BEFORE xvfb-maybe to ensure xvfb is installed
 */

const path = require('path');

async function main() {
  try {
    // Compile TypeScript on-the-fly using ts-node
    require('ts-node').register({
      compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
      },
      transpileOnly: true,
    });

    const { ensureSetup } = require('../tests/e2e/helpers/setup-verification.ts');

    console.log('🔍 Checking e2e testing setup...\n');

    await ensureSetup();

    console.log('✅ E2E environment ready, starting tests...\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during e2e setup:', error.message);
    process.exit(1);
  }
}

main();
