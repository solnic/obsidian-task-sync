import { test, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

test('plugin manifest exists and is valid', () => {
  const manifestPath = path.join(__dirname, '../manifest.json');
  expect(fs.existsSync(manifestPath)).toBe(true);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  expect(manifest.id).toBe('obsidian-task-sync');
  expect(manifest.name).toBe('Task Sync');
  expect(manifest.version).toBe('1.0.0');
  expect(manifest.minAppVersion).toBe('0.15.0');
  expect(manifest.description).toContain('task');
  expect(manifest.author).toBe('Peter Solnica');
});

test('main plugin file exists and is built', () => {
  const mainPath = path.join(__dirname, '../main.js');
  expect(fs.existsSync(mainPath)).toBe(true);

  const mainContent = fs.readFileSync(mainPath, 'utf8');
  expect(mainContent).toContain('TaskSyncPlugin');
  expect(mainContent).toContain('onload');
  expect(mainContent).toContain('onunload');
});

test('plugin styles exist', () => {
  const stylesPath = path.join(__dirname, '../styles.css');
  expect(fs.existsSync(stylesPath)).toBe(true);

  const stylesContent = fs.readFileSync(stylesPath, 'utf8');
  expect(stylesContent).toContain('task-sync');
});

test('TypeScript types are properly defined', () => {
  const typesPath = path.join(__dirname, '../src/types');
  expect(fs.existsSync(typesPath)).toBe(true);

  const entitiesPath = path.join(typesPath, 'entities.ts');
  const servicesPath = path.join(typesPath, 'services.ts');
  const indexPath = path.join(typesPath, 'index.ts');

  expect(fs.existsSync(entitiesPath)).toBe(true);
  expect(fs.existsSync(servicesPath)).toBe(true);
  expect(fs.existsSync(indexPath)).toBe(true);

  // Check that key types are defined
  const entitiesContent = fs.readFileSync(entitiesPath, 'utf8');
  expect(entitiesContent).toContain('interface Task');
  expect(entitiesContent).toContain('interface Project');
  expect(entitiesContent).toContain('interface Area');
  expect(entitiesContent).toContain('enum TaskStatus');
});

test('VaultScanner service exists and is properly structured', () => {
  const scannerPath = path.join(__dirname, '../src/services/VaultScannerService.ts');
  expect(fs.existsSync(scannerPath)).toBe(true);

  const scannerContent = fs.readFileSync(scannerPath, 'utf8');
  expect(scannerContent).toContain('class VaultScanner');
  expect(scannerContent).toContain('findTaskFiles');
  expect(scannerContent).toContain('findProjectFiles');
  expect(scannerContent).toContain('findAreaFiles');
  expect(scannerContent).toContain('validateFolderStructure');
});

test('package.json has correct dependencies and scripts', () => {
  const packagePath = path.join(__dirname, '../package.json');
  expect(fs.existsSync(packagePath)).toBe(true);

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  // Check essential scripts
  expect(packageJson.scripts.build).toBeDefined();
  expect(packageJson.scripts.test).toBeDefined();
  expect(packageJson.scripts['test:e2e']).toBeDefined();

  // Check essential dependencies
  expect(packageJson.devDependencies.obsidian).toBeDefined();
  expect(packageJson.devDependencies.typescript).toBeDefined();
  expect(packageJson.devDependencies.vitest).toBeDefined();
  expect(packageJson.devDependencies['@playwright/test']).toBeDefined();
});

test('build configuration files exist', () => {
  const tsconfigPath = path.join(__dirname, '../tsconfig.json');
  const esbuildPath = path.join(__dirname, '../esbuild.config.mjs');
  const vitestPath = path.join(__dirname, '../vitest.config.mjs');
  const vitestPlaywrightPath = path.join(__dirname, '../vitest.playwright.config.mjs');

  expect(fs.existsSync(tsconfigPath)).toBe(true);
  expect(fs.existsSync(esbuildPath)).toBe(true);
  expect(fs.existsSync(vitestPath)).toBe(true);
  expect(fs.existsSync(vitestPlaywrightPath)).toBe(true);
});
