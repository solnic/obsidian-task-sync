#!/usr/bin/env node

/**
 * Test script to verify headless mode detection logic
 * This tests various environment scenarios to ensure proper mode detection
 */

console.log('🧪 Testing headless detection logic...\n');

// Test scenarios
const testScenarios = [
  {
    name: 'CI environment',
    env: { CI: 'true' },
    expected: true
  },
  {
    name: 'Explicit headless',
    env: { E2E_HEADLESS: 'true' },
    expected: true
  },
  {
    name: 'No DISPLAY variable',
    env: { DISPLAY: undefined },
    expected: true
  },
  {
    name: 'Empty DISPLAY variable',
    env: { DISPLAY: '' },
    expected: true
  },
  {
    name: 'Force windowed mode',
    env: { E2E_HEADLESS: 'false', CI: 'true' },
    expected: false
  },
  {
    name: 'Normal desktop environment',
    env: { DISPLAY: ':0' },
    expected: false
  },
  {
    name: 'Virtual display',
    env: { DISPLAY: ':99' },
    expected: false
  }
];

// Headless detection function (same as in shared-context.ts)
function detectHeadlessMode(env) {
  return env.E2E_HEADLESS === 'false' ? false :
    (env.CI === 'true' ||
     env.E2E_HEADLESS === 'true' ||
     env.DISPLAY === undefined ||
     env.DISPLAY === '');
}

let allPassed = true;

// Run tests
testScenarios.forEach((scenario, index) => {
  const result = detectHeadlessMode(scenario.env);
  const passed = result === scenario.expected;
  const status = passed ? '✅' : '❌';
  
  console.log(`${status} Test ${index + 1}: ${scenario.name}`);
  console.log(`   Environment: ${JSON.stringify(scenario.env)}`);
  console.log(`   Expected: ${scenario.expected ? 'headless' : 'windowed'}`);
  console.log(`   Actual: ${result ? 'headless' : 'windowed'}`);
  
  if (!passed) {
    allPassed = false;
    console.log(`   ❌ FAILED: Expected ${scenario.expected} but got ${result}`);
  }
  
  console.log('');
});

// Summary
console.log('📊 Test Summary:');
const passedCount = testScenarios.filter((scenario, index) => {
  return detectHeadlessMode(scenario.env) === scenario.expected;
}).length;

console.log(`   Passed: ${passedCount}/${testScenarios.length} tests`);

if (allPassed) {
  console.log('\n🎉 All tests passed!');
  console.log('   Headless detection logic is working correctly.');
} else {
  console.log('\n❌ Some tests failed!');
  console.log('   Please check the headless detection logic.');
}

process.exit(allPassed ? 0 : 1);
