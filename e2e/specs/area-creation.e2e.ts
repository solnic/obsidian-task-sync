/**
 * E2E tests for Area Creation functionality
 * Tests the area creation command, modal, and base generation
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Area Creation', () => {
  const context = setupE2ETestHooks();

  test('should have area creation command available', async () => {
    await createTestFolders(context.page);

    // Check if the area creation command exists
    const hasCreateAreaCommand = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      return 'obsidian-task-sync:create-area' in commands;
    });

    expect(hasCreateAreaCommand).toBe(true);
  });

  test('should open area creation modal when command is executed', async () => {
    await createTestFolders(context.page);

    // Execute the create area command
    await executeCommand(context, 'Task Sync: Create Area');
    await context.page.waitForSelector('.task-sync-create-area', { timeout: 5000 });

    // Check if modal is open
    const modalExists = await context.page.locator('.task-sync-create-area').isVisible();
    expect(modalExists).toBe(true);

    // Check modal title
    const modalTitle = await context.page.locator('.modal-title').textContent();
    expect(modalTitle).toBe('Create New Area');

    // Close modal
    await context.page.keyboard.press('Escape');
    await context.page.waitForTimeout(500);
  });

  test('should create area with basic information', async () => {
    await createTestFolders(context.page);

    // Execute the create area command
    await executeCommand(context, 'Task Sync: Create Area');
    await context.page.waitForSelector('.task-sync-create-area', { timeout: 5000 });

    // Fill in area name
    const nameInput = context.page.locator('input[placeholder*="Health, Finance, Learning"]');
    await nameInput.fill('Test Area');

    // Fill in description
    const descriptionInput = context.page.locator('textarea[placeholder*="Brief description"]');
    await descriptionInput.fill('This is a test area for e2e testing');

    // Click create button
    await context.page.locator('button:has-text("Create Area")').click();
    await context.page.waitForTimeout(2000);

    // Check if area file was created
    const areaFileExists = await fileExists(context.page, 'Areas/Test Area.md');
    expect(areaFileExists).toBe(true);

    // Check area file content
    const areaContent = await getFileContent(context.page, 'Areas/Test Area.md');
    expect(areaContent).toContain('Name: Test Area');
    expect(areaContent).toContain('Type: Area');
    expect(areaContent).toContain('This is a test area for e2e testing');
    expect(areaContent).toContain('![[Bases/Test Area.base]]');
  });

  test('should create individual area base when enabled', async () => {
    await createTestFolders(context.page);

    // Ensure area bases are enabled
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
      }
    });

    // Execute the create area command
    await executeCommand(context, 'Task Sync: Create Area');
    await context.page.waitForSelector('.task-sync-create-area', { timeout: 5000 });

    // Fill in area name
    const nameInput = context.page.locator('input[placeholder*="Health, Finance, Learning"]');
    await nameInput.fill('Finance Area');

    // Click create button
    await context.page.locator('button:has-text("Create Area")').click();
    await context.page.waitForTimeout(3000);

    // Check if individual area base was created
    const baseFileExists = await fileExists(context.page, 'Bases/Finance Area.base');
    expect(baseFileExists).toBe(true);

    // Check base file content
    const baseContent = await getFileContent(context.page, 'Bases/Finance Area.base');
    expect(baseContent).toContain('properties:');
    expect(baseContent).toContain('name: Title');
    expect(baseContent).toContain('name: Type');
    expect(baseContent).toContain('name: Done');
    expect(baseContent).toContain('formulas:');
    expect(baseContent).toContain('Title: link(file.name, Title)');
    expect(baseContent).toContain('views:');
    expect(baseContent).toContain('name: Tasks');
    expect(baseContent).toContain('name: All Bugs');
    expect(baseContent).toContain('name: All Features');
    expect(baseContent).toContain('Areas.contains(link("Finance Area"))');
  });

  test('should validate required fields', async () => {
    await createTestFolders(context.page);

    // Execute the create area command
    await executeCommand(context, 'Task Sync: Create Area');
    await context.page.waitForSelector('.task-sync-create-area', { timeout: 5000 });

    // Try to create without name
    await context.page.locator('button:has-text("Create Area")').click();
    await context.page.waitForSelector('.task-sync-error', { timeout: 5000 });

    // Check for error message
    const errorExists = await context.page.locator('.task-sync-error').isVisible();
    expect(errorExists).toBe(true);

    const errorText = await context.page.locator('.task-sync-error').textContent();
    expect(errorText).toContain('Area name is required');

    // Close modal
    await context.page.keyboard.press('Escape');
    await context.page.waitForTimeout(500);
  });

  test('should handle special characters in area name', async () => {
    await createTestFolders(context.page);

    // Execute the create area command
    await executeCommand(context, 'Task Sync: Create Area');
    await context.page.waitForSelector('.task-sync-create-area', { timeout: 5000 });

    // Fill in area name with special characters
    const nameInput = context.page.locator('input[placeholder*="Health, Finance, Learning"]');
    await nameInput.fill('Health & Fitness (2024)');

    // Click create button
    await context.page.locator('button:has-text("Create Area")').click();
    await context.page.waitForTimeout(2000);

    // Check if area file was created with original name
    const areaFileExists = await fileExists(context.page, 'Areas/Health & Fitness (2024).md');
    expect(areaFileExists).toBe(true);

    // Check area file content has original name using API
    const frontMatter = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      return await plugin.taskFileManager.loadFrontMatter('Areas/Health & Fitness (2024).md');
    });

    expect(frontMatter.Name).toBe('Health & Fitness (2024)');
  });

  test('should use template when configured', async () => {
    await createTestFolders(context.page);

    // Create a custom area template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Name: <% tp.file.title %>
Type: Area
Custom: true
---

## Overview

{{description}}

## Goals

- Goal 1
- Goal 2

## Tasks

![[{{name}}.base]]
`;

      try {
        await app.vault.create('Templates/area-template.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultAreaTemplate = 'area-template.md';
        await plugin.saveSettings();
      }
    });

    // Execute the create area command
    await executeCommand(context, 'Task Sync: Create Area');
    await context.page.waitForSelector('.task-sync-create-area', { timeout: 5000 });

    // Fill in area information
    const nameInput = context.page.locator('input[placeholder*="Health, Finance, Learning"]');
    await nameInput.fill('Learning Area');

    const descriptionInput = context.page.locator('textarea[placeholder*="Brief description"]');
    await descriptionInput.fill('Continuous learning and skill development');

    // Click create button
    await context.page.locator('button:has-text("Create Area")').click();
    await context.page.waitForTimeout(2000);

    // Check if area file was created
    const areaFileExists = await fileExists(context.page, 'Areas/Learning Area.md');
    expect(areaFileExists).toBe(true);

    // Check area file content uses template
    const areaContent = await getFileContent(context.page, 'Areas/Learning Area.md');
    expect(areaContent).toContain('Custom: true');
    expect(areaContent).toContain('## Overview');
    expect(areaContent).toContain('## Goals');
    expect(areaContent).toContain('Continuous learning and skill development');
    expect(areaContent).toContain('![[Bases/Learning Area.base]]');
  });
});
