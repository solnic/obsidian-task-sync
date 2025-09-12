#!/usr/bin/env node

/**
 * Rerun E2E tests that failed in the previous run
 * Simply runs npm run test:e2e:headless with the failed test pattern
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RESULTS_FILE = 'e2e-test-results.json';

function getFailedTestsFromResults() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log(`❌ No previous test results found (${RESULTS_FILE})`);
    console.log('💡 Run e2e tests first to generate results file');
    return [];
  }

  try {
    const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
    const failedTests = [];

    // Parse Vitest JSON results to find failed tests
    if (results.testResults) {
      results.testResults.forEach(file => {
        if (file.assertionResults) {
          file.assertionResults.forEach(test => {
            if (test.status === 'failed') {
              failedTests.push({
                file: file.name,
                testName: test.title,
                fullName: test.fullName || test.title
              });
            }
          });
        }
        // Also check if the entire file failed (beforeAll/beforeEach failures)
        if (file.status === 'failed' && (!file.assertionResults || file.assertionResults.length === 0)) {
          // For file-level failures, we'll need to run the entire file
          failedTests.push({
            file: file.name,
            testName: `*`, // Wildcard to match all tests in file
            fullName: `All tests in ${path.basename(file.name)}`
          });
        }
      });
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

  // Check if we have file-level failures (indicated by wildcard test names)
  const fileLevelFailures = failedTests.filter(test => test.testName === '*');
  const testLevelFailures = failedTests.filter(test => test.testName !== '*');

  let testPattern;
  if (fileLevelFailures.length > 0) {
    // If we have file-level failures, we'll need to run the entire files
    // For now, just use all test names as pattern
    testPattern = failedTests.map(test => test.testName === '*' ? '.*' : test.testName).join('|');
  } else if (testLevelFailures.length > 0) {
    // If we only have test-level failures, use testNamePattern
    testPattern = testLevelFailures.map(test => test.testName).join('|');
  } else {
    console.log('❌ No valid failed tests found to rerun');
    return;
  }

  console.log('🚀 Running failed tests...');

  // Build the npm command with properly quoted test pattern
  const npmArgs = ['run', 'test:e2e:headless', '--', '-t', `"${testPattern}"`];

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
    console.log('It reads test results from e2e-test-results.json and runs');
    console.log('npm run test:e2e:headless with the failed test pattern.');
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
