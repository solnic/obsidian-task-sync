#!/usr/bin/env node

/**
 * Comprehensive validation script for headless e2e testing setup
 * This script validates the entire headless testing pipeline
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating headless e2e testing setup...\n');

let allChecks = [];

function addCheck(name, passed, details = '') {
  allChecks.push({ name, passed, details });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}${details ? ': ' + details : ''}`);
}

// 1. Check system dependencies
console.log('📋 Checking system dependencies...');

try {
  execSync('which xvfb-run', { stdio: 'ignore' });
  addCheck('Xvfb installed', true);
} catch (error) {
  addCheck('Xvfb installed', false, 'Run: npm run setup:headless');
}

try {
  execSync('which node', { stdio: 'ignore' });
  const version = execSync('node --version', { encoding: 'utf8' }).trim();
  addCheck('Node.js available', true, version);
} catch (error) {
  addCheck('Node.js available', false);
}

try {
  execSync('which npm', { stdio: 'ignore' });
  const version = execSync('npm --version', { encoding: 'utf8' }).trim();
  addCheck('npm available', true, `v${version}`);
} catch (error) {
  addCheck('npm available', false);
}

// 2. Check required libraries
console.log('\n🔧 Checking required libraries...');

const requiredLibs = [
  'libnss3',
  'libatk-bridge2.0-0',
  'libdrm2',
  'libxcomposite1',
  'libxdamage1',
  'libxrandr2',
  'libgbm1',
  'libxss1',
  'libasound2',
  'libatspi2.0-0',
  'libgtk-3-0'
];

let missingLibs = [];
for (const lib of requiredLibs) {
  try {
    execSync(`dpkg -l | grep -q ${lib}`, { stdio: 'ignore' });
  } catch (error) {
    missingLibs.push(lib);
  }
}

if (missingLibs.length === 0) {
  addCheck('Required libraries installed', true, `All ${requiredLibs.length} libraries present`);
} else {
  addCheck('Required libraries installed', false, `Missing: ${missingLibs.join(', ')}`);
}

// 3. Test headless detection logic
console.log('\n🖥️ Testing headless detection logic...');

try {
  const result = execSync('node scripts/test-headless-detection.js', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  const success = result.includes('All tests passed!');
  addCheck('Headless detection logic', success, success ? 'All scenarios pass' : 'Some scenarios failed');
} catch (error) {
  addCheck('Headless detection logic', false, 'Script execution failed');
}

// 4. Test xvfb functionality
console.log('\n🧪 Testing xvfb functionality...');

try {
  const result = execSync('node scripts/test-xvfb-electron.js', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  const success = result.includes('All xvfb tests passed!');
  addCheck('Xvfb functionality', success, success ? 'All xvfb tests pass' : 'Some xvfb tests failed');
} catch (error) {
  addCheck('Xvfb functionality', false, 'Script execution failed');
}

// 5. Check project structure
console.log('\n📁 Checking project structure...');

const requiredFiles = [
  'package.json',
  'vitest.playwright.config.mjs',
  'e2e/helpers/plugin-setup.ts',
  'e2e/helpers/shared-context-vitest.ts',
  '.obsidian-unpacked/main.js'
];

for (const file of requiredFiles) {
  const exists = fs.existsSync(file);
  addCheck(`File exists: ${file}`, exists);
}

// 6. Check package.json scripts
console.log('\n📜 Checking package.json scripts...');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = [
    'test:e2e',
    'test:e2e:headless',
    'test:e2e:windowed',
    'test:e2e:ci',
    'setup:headless',
    'test:headless-detection',
    'test:xvfb'
  ];

  for (const script of requiredScripts) {
    const exists = packageJson.scripts && packageJson.scripts[script];
    addCheck(`Script: ${script}`, exists);
  }
} catch (error) {
  addCheck('Package.json readable', false, error.message);
}

// 7. Check environment
console.log('\n🌍 Checking environment...');

const currentEnv = {
  CI: process.env.CI,
  E2E_HEADLESS: process.env.E2E_HEADLESS,
  DISPLAY: process.env.DISPLAY
};

console.log(`   Current environment: ${JSON.stringify(currentEnv)}`);

// Simulate headless detection
const isHeadless = process.env.E2E_HEADLESS === 'false' ? false :
  (process.env.CI === 'true' ||
    process.env.E2E_HEADLESS === 'true' ||
    process.env.DISPLAY === undefined ||
    process.env.DISPLAY === '');

addCheck('Environment detection', true, `Detected mode: ${isHeadless ? 'headless' : 'windowed'}`);

// 8. Summary
console.log('\n📊 Validation Summary:');
const passed = allChecks.filter(check => check.passed).length;
const total = allChecks.length;
const success = passed === total;

console.log(`   Passed: ${passed}/${total} checks`);

if (!success) {
  console.log('\n❌ Failed checks:');
  allChecks.filter(check => !check.passed).forEach(check => {
    console.log(`   • ${check.name}${check.details ? ': ' + check.details : ''}`);
  });

  console.log('\n🔧 Recommended actions:');
  console.log('   1. Run: npm run setup:headless');
  console.log('   2. Ensure all dependencies are installed');
  console.log('   3. Check the headless testing documentation');
}

console.log(`\n${success ? '🎉' : '⚠️'} Validation ${success ? 'completed successfully' : 'completed with issues'}!`);

if (success) {
  console.log('\n🚀 Your system is ready for headless e2e testing!');
  console.log('   Try running: npm run test:e2e:headless');
} else {
  console.log('\n📖 For troubleshooting help, check the documentation');
}

process.exit(success ? 0 : 1);
