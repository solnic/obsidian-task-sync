import { test, expect, beforeAll, afterAll } from 'vitest';
import { ElectronApplication, Page, _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;

beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  // Get the first page
  page = await electronApp.firstWindow();

  // Wait for the app to be ready
  await page.waitForLoadState('domcontentloaded');
});

afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test('plugin loads successfully', async () => {
  // Basic test to ensure the plugin structure is working
  expect(electronApp).toBeDefined();
  expect(page).toBeDefined();
});

test('plugin manifest exists', async () => {
  const manifestPath = path.join(__dirname, '../manifest.json');
  expect(fs.existsSync(manifestPath)).toBe(true);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(manifest.id).toBe('obsidian-task-sync');
  expect(manifest.name).toBe('Task Sync');
  expect(manifest.version).toBe('1.0.0');
});

test('main plugin file exists', async () => {
  const mainPath = path.join(__dirname, '../main.js');
  expect(fs.existsSync(mainPath)).toBe(true);
});
