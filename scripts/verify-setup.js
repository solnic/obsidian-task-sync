#!/usr/bin/env node

/**
 * Simple script to test the setup verification module
 * This can be run to check if the e2e environment is ready
 */

const path = require('path');

// Import the verification module
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

    const { verifySetup } = require('../tests/e2e/helpers/setup-verification.ts');

    console.log('🔍 Verifying e2e testing setup...\n');

    const result = await verifySetup();

    console.log('📊 Setup Check Results:\n');

    for (const check of result.checks) {
      const status = check.passed ? '✅' : '❌';
      const details = check.details ? `: ${check.details}` : '';
      console.log(`${status} ${check.name}${details}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    if (result.isReady) {
      console.log('🎉 E2E testing environment is ready!');
      console.log('\n🧪 You can run e2e tests with: npm run test:e2e');
      process.exit(0);
    } else {
      console.log('⚠️  E2E testing environment is NOT ready\n');
      console.log('Missing requirements:');
      for (const requirement of result.missingRequirements) {
        console.log(`   - ${requirement}`);
      }
      console.log('\n🔧 Run the following command to set up:');
      console.log('   npm run setup:e2e');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error running verification:', error.message);
    process.exit(1);
  }
}

main();
