#!/usr/bin/env node

/**
 * Rerun E2E tests that failed in the previous run
 * Uses Vitest with multiple reporters (verbose + json) to capture and parse results
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function runFailedTests(isHeadless = false) {
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

  const baseCommand = isHeadless
    ? 'xvfb-run -a --server-args="-screen 0 1920x1080x24 -ac -nolisten tcp -dpi 96" npx vitest run --config vitest.playwright.config.mjs'
    : 'npx vitest run --config vitest.playwright.config.mjs';

  // Check if we have file-level failures (indicated by wildcard test names)
  const fileLevelFailures = failedTests.filter(test => test.testName === '*');
  const testLevelFailures = failedTests.filter(test => test.testName !== '*');

  let command;
  if (fileLevelFailures.length > 0) {
    // If we have file-level failures, run those files directly
    const failedFiles = fileLevelFailures.map(test => test.file).join(' ');
    command = `${baseCommand} ${failedFiles} --reporter=verbose --reporter=json --outputFile=${RESULTS_FILE}`;
  } else if (testLevelFailures.length > 0) {
    // If we only have test-level failures, use testNamePattern
    const testNamePattern = testLevelFailures.map(test => test.testName).join('|');
    command = `${baseCommand} --testNamePattern="${testNamePattern}" --reporter=verbose --reporter=json --outputFile=${RESULTS_FILE}`;
  } else {
    console.log('❌ No valid failed tests found to rerun');
    return;
  }

  console.log('🚀 Running failed tests...');
  console.log(`Command: ${command}`);
  console.log('');

  try {
    execSync(command, { stdio: 'inherit' });
    console.log('✅ Failed tests rerun completed!');
  } catch (error) {
    console.log('❌ Some tests still failing. Check output above.');
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  const isHeadless = args.includes('--headless');

  if (args.includes('--help') || args.includes('-h')) {
    console.log('🎯 Rerun Failed E2E Tests');
    console.log('========================');
    console.log('');
    console.log('Usage: node scripts/rerun-failed-e2e.js [--headless]');
    console.log('');
    console.log('This script reruns only the tests that failed in the previous run.');
    console.log('It reads test results from e2e-test-results.json and uses --testNamePattern');
    console.log('to target only the failed tests.');
    console.log('');
    console.log('Options:');
    console.log('  --headless    Run tests in headless mode (with xvfb)');
    console.log('  --help, -h    Show this help message');
    return;
  }

  runFailedTests(isHeadless);
}

if (require.main === module) {
  main();
}
