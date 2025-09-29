#!/usr/bin/env node

/**
 * Rerun E2E tests that failed in the previous run
 * Parses Playwright JSON results and runs npm run test:e2e with the failed test pattern
 */

const fs = require('fs');
const { spawn } = require('child_process');

const RESULTS_FILE = 'tests/e2e/results.json';

function getFailedTestsFromResults() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log(`❌ No previous test results found (${RESULTS_FILE})`);
    console.log('💡 Run e2e tests first to generate results file');
    return [];
  }

  try {
    const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
    const failedTests = [];

    // Parse Playwright JSON results to find failed tests
    if (results.suites) {
      function extractFailedTests(suites) {
        suites.forEach(suite => {
          // Check specs in this suite
          if (suite.specs) {
            suite.specs.forEach(spec => {
              if (spec.ok === false) {
                failedTests.push({
                  file: spec.file,
                  testName: spec.title,
                  fullName: spec.title
                });
              }
            });
          }

          // Recursively check nested suites
          if (suite.suites) {
            extractFailedTests(suite.suites);
          }
        });
      }

      extractFailedTests(results.suites);
    }

    return failedTests;
  } catch (error) {
    console.log(`❌ Error parsing test results: ${error.message}`);
    return [];
  }
}

function runFailedTests() {
  const failedTests = getFailedTestsFromResults();

  if (failedTests.length === 0) {
    console.log('✅ No failed tests found to rerun!');
    return;
  }

  console.log(`🔄 Found ${failedTests.length} failed tests to rerun:`);
  failedTests.forEach(test => {
    console.log(`   - ${test.fullName}`);
  });
  console.log('');

  // For Playwright, we can use --grep to match test titles
  const testPattern = failedTests.map(test => test.testName).join('|');

  console.log('🚀 Running failed tests...');

  // Build the npm command with properly quoted test pattern for Playwright
  const npmArgs = ['run', 'test:e2e', '--', '--grep', `"${testPattern}"`];

  console.log(`Command: npm ${npmArgs.join(' ')}`);
  console.log('');

  // Use spawn to run the command and inherit stdio for real-time output
  const child = spawn('npm', npmArgs, {
    stdio: 'inherit',
    shell: true
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Failed tests rerun completed!');
    } else {
      console.log('❌ Some tests are still failing.');
      process.exit(code);
    }
  });

  child.on('error', (error) => {
    console.error('❌ Error running tests:', error.message);
    process.exit(1);
  });
}



function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('🎯 Rerun Failed E2E Tests');
    console.log('========================');
    console.log('');
    console.log('Usage: node scripts/rerun-failed-e2e.js');
    console.log('');
    console.log('This script reruns only the tests that failed in the previous run.');
    console.log('It reads test results from tests/e2e/results.json and runs');
    console.log('npm run test:e2e with the failed test pattern.');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h    Show this help message');
    return;
  }

  runFailedTests();
}

if (require.main === module) {
  main();
}
