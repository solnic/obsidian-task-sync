#!/usr/bin/env node

/**
 * Launch Obsidian in headless mode with DevTools remote debugging enabled
 * This allows connecting to the Obsidian instance using Playwright, Puppeteer, or Chrome DevTools
 *
 * Usage:
 *   npm run test:obsidian:open
 *   npm run test:obsidian:open -- --vault=/path/to/vault
 *   npm run test:obsidian:open -- --vault=/path/to/vault --port=9222
 *
 * Once running, you can connect to it:
 *   - Chrome DevTools: chrome://inspect
 *   - Playwright: await playwright.chromium.connectOverCDP('http://localhost:9222')
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
};

const vaultPath = getArg('vault', path.resolve('./tests/e2e/test-vault'));
const dataDir = getArg('data-dir', path.resolve('./tests/e2e/test-data'));
const debugPort = getArg('port', '9222');
const headless = getArg('headless', 'true') !== 'false';

// Ensure directories exist
if (!fs.existsSync(vaultPath)) {
  fs.mkdirSync(vaultPath, { recursive: true });
  console.log(`✅ Created vault directory: ${vaultPath}`);
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`✅ Created data directory: ${dataDir}`);
}

// Find Obsidian executable
const obsidianUnpackedPath = path.resolve('./tests/e2e/.obsidian-unpacked');
const electronPath = path.resolve('./node_modules/electron/dist/electron');

// Check for different possible Obsidian structures
const mainJsPath = path.resolve(obsidianUnpackedPath + '/main.js');
const appExtractedMainJs = path.resolve(obsidianUnpackedPath + '/app-extracted/main.js');
const obsidianBinaryPath = path.resolve(obsidianUnpackedPath + '/obsidian');
const appAsarPath = path.resolve(obsidianUnpackedPath + '/resources/app.asar');

let appPath;
if (fs.existsSync(appExtractedMainJs)) {
  appPath = appExtractedMainJs;
} else if (fs.existsSync(mainJsPath)) {
  appPath = mainJsPath;
} else if (fs.existsSync(appAsarPath)) {
  appPath = obsidianBinaryPath;
} else if (fs.existsSync(obsidianBinaryPath)) {
  appPath = obsidianBinaryPath;
} else {
  console.error('❌ Unpacked Obsidian not found.');
  console.error(`   Checked: ${appExtractedMainJs}, ${mainJsPath}, ${appAsarPath}, ${obsidianBinaryPath}`);
  console.error('   Please run: npm run setup:obsidian-playwright');
  process.exit(1);
}

console.log('🚀 Starting Obsidian in headless mode with remote debugging...');
console.log('');
console.log('Configuration:');
console.log(`  Vault:        ${vaultPath}`);
console.log(`  Data Dir:     ${dataDir}`);
console.log(`  Debug Port:   ${debugPort}`);
console.log(`  Headless:     ${headless}`);
console.log(`  App Path:     ${appPath}`);
console.log('');

// Build Electron launch arguments
const launchArgs = [
  appPath,
  `--user-data-dir=${dataDir}`,
  'open',
  `obsidian://open?path=${encodeURIComponent(path.resolve(vaultPath))}`,
  '--window-size=1920,1080',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${debugPort}`,
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

if (headless) {
  launchArgs.push(
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--disable-features=VizDisplayCompositor',
    '--disable-dbus',
    '--disable-default-apps',
    '--disable-component-update'
  );
}

// Determine if we need xvfb
const needsXvfb = process.platform === 'linux' && (!process.env.DISPLAY || process.env.DISPLAY === '');

let electronProcess;

if (needsXvfb) {
  console.log('🖥️  No display detected, using xvfb-run...');
  console.log('');
  
  // Use xvfb-run to provide virtual display
  electronProcess = spawn('xvfb-run', [
    '-a',
    '--server-args=-screen 0 1920x1080x24 -ac -nolisten tcp -dpi 96',
    electronPath,
    ...launchArgs
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    }
  });
} else {
  console.log('🖥️  Display available, launching directly...');
  console.log('');
  
  electronProcess = spawn(electronPath, launchArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    }
  });
}

console.log('✅ Obsidian is starting...');
console.log('');
console.log('📡 Remote debugging available at:');
console.log(`   http://localhost:${debugPort}`);
console.log('');
console.log('🔗 Connect using:');
console.log('   - Chrome DevTools: chrome://inspect');
console.log('   - Playwright: await playwright.chromium.connectOverCDP(`http://localhost:${debugPort}`)');
console.log('   - Puppeteer: await puppeteer.connect({ browserURL: `http://localhost:${debugPort}` })');
console.log('');
console.log('Press Ctrl+C to stop Obsidian');
console.log('');

electronProcess.on('error', (error) => {
  console.error('❌ Failed to start Obsidian:', error);
  process.exit(1);
});

electronProcess.on('exit', (code, signal) => {
  if (signal) {
    console.log(`\n⚠️  Obsidian was killed with signal: ${signal}`);
  } else if (code !== 0) {
    console.log(`\n❌ Obsidian exited with code: ${code}`);
  } else {
    console.log('\n✅ Obsidian closed successfully');
  }
  process.exit(code || 0);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Obsidian...');
  electronProcess.kill('SIGTERM');
  
  // Force kill after 5 seconds if it doesn't stop
  setTimeout(() => {
    console.log('⚠️  Force killing Obsidian...');
    electronProcess.kill('SIGKILL');
    process.exit(1);
  }, 5000);
});

process.on('SIGTERM', () => {
  electronProcess.kill('SIGTERM');
});

