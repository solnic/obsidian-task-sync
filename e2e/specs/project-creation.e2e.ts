/**
 * E2E tests for Project Creation functionality
 * Tests the project creation command, modal, and base generation
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks, executeCommand } from '../helpers/shared-context';

describe('Project Creation', () => {
  const context = setupE2ETestHooks();

  test('should have project creation command available', async () => {
    await createTestFolders(context.page);

    // Check if the project creation command exists
    const hasCreateProjectCommand = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const commands = app.commands.commands;
      return 'obsidian-task-sync:create-project' in commands;
    });

    expect(hasCreateProjectCommand).toBe(true);
  });

  test('should open project creation modal when command is executed', async () => {
    await createTestFolders(context.page);

    // Execute the create project command
    await executeCommand(context, 'Task Sync: Create Project');
    await context.page.waitForSelector('.task-sync-create-project', { timeout: 5000 });

    // Check if modal is open
    const modalExists = await context.page.locator('.task-sync-create-project').isVisible();
    expect(modalExists).toBe(true);

    // Check modal title
    const modalTitle = await context.page.locator('.modal-title').textContent();
    expect(modalTitle).toBe('Create New Project');

    // Close modal
    await context.page.keyboard.press('Escape');
    await context.page.waitForTimeout(500);
  });

  test('should create project with basic information', async () => {
    await createTestFolders(context.page);

    // Execute the create project command
    await executeCommand(context, 'Task Sync: Create Project');
    await context.page.waitForSelector('.task-sync-create-project', { timeout: 5000 });

    // Fill in project name
    const nameInput = context.page.locator('input[placeholder*="Website Redesign, Learn Spanish"]');
    await nameInput.fill('Test Project');

    // Fill in areas
    const areasInput = context.page.locator('input[placeholder*="Work, Learning"]');
    await areasInput.fill('Work, Development');

    // Fill in description
    const descriptionInput = context.page.locator('textarea[placeholder*="Brief description"]');
    await descriptionInput.fill('This is a test project for e2e testing');

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(2000);

    // Check if project file was created
    const projectFileExists = await fileExists(context.page, 'Projects/Test Project.md');
    expect(projectFileExists).toBe(true);

    // Check project file content
    const projectContent = await getFileContent(context.page, 'Projects/Test Project.md');
    expect(projectContent).toContain('Name: Test Project');
    expect(projectContent).toContain('Type: Project');
    // Areas should be split into array format
    expect(projectContent).toContain('- Work');
    expect(projectContent).toContain('- Development');
    expect(projectContent).toContain('This is a test project for e2e testing');
    expect(projectContent).toContain('![[Bases/Test Project.base]]');
  });

  test('should create individual project base when enabled', async () => {
    await createTestFolders(context.page);

    // Ensure project bases are enabled
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
      }
    });

    // Execute the create project command
    await executeCommand(context, 'Task Sync: Create Project');
    await context.page.waitForSelector('.task-sync-create-project', { timeout: 5000 });

    // Fill in project name
    const nameInput = context.page.locator('input[placeholder*="Website Redesign, Learn Spanish"]');
    await nameInput.fill('Website Redesign');

    // Fill in areas
    const areasInput = context.page.locator('input[placeholder*="Work, Learning"]');
    await areasInput.fill('Work');

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(3000);

    // Check if individual project base was created
    const baseFileExists = await fileExists(context.page, 'Bases/Website Redesign.base');
    expect(baseFileExists).toBe(true);

    // Check base file content
    const baseContent = await getFileContent(context.page, 'Bases/Website Redesign.base');
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
    expect(baseContent).toContain('Project.contains(link("Website Redesign"))');
  });

  test('should validate required fields', async () => {
    await createTestFolders(context.page);

    // Execute the create project command
    await executeCommand(context, 'Task Sync: Create Project');
    await context.page.waitForSelector('.task-sync-create-project', { timeout: 5000 });

    // Try to create without name
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForSelector('.task-sync-error', { timeout: 5000 });

    // Check for error message
    const errorExists = await context.page.locator('.task-sync-error').isVisible();
    expect(errorExists).toBe(true);

    const errorText = await context.page.locator('.task-sync-error').textContent();
    expect(errorText).toContain('Project name is required');

    // Close modal
    await context.page.keyboard.press('Escape');
    await context.page.waitForTimeout(500);
  });

  test('should handle special characters in project name', async () => {
    await createTestFolders(context.page);

    // Execute the create project command
    await executeCommand(context, 'Task Sync: Create Project');
    await context.page.waitForSelector('.task-sync-create-project', { timeout: 5000 });

    // Fill in project name with special characters
    const nameInput = context.page.locator('input[placeholder*="Website Redesign, Learn Spanish"]');
    await nameInput.fill('Mobile App (iOS & Android)');

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(2000);

    // Check if project file was created with original name
    const projectFileExists = await fileExists(context.page, 'Projects/Mobile App (iOS & Android).md');
    expect(projectFileExists).toBe(true);

    // Check project file content has original name
    const projectContent = await getFileContent(context.page, 'Projects/Mobile App (iOS & Android).md');
    expect(projectContent).toContain('Name: Mobile App (iOS & Android)');
  });

  test('should use template when configured', async () => {
    await createTestFolders(context.page);

    // Create a custom project template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Name: <% tp.file.title %>
Type: Project
Areas: {{areas}}
Status: Planning
---

## Overview

{{description}}

## Objectives

- [ ] Objective 1
- [ ] Objective 2

## Milestones

- [ ] Milestone 1
- [ ] Milestone 2

## Tasks

![[{{name}}.base]]
`;

      try {
        await app.vault.create('Templates/project-template.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
        // If file already exists, modify it instead
        if (error.message.includes('already exists')) {
          const existingFile = app.vault.getAbstractFileByPath('Templates/project-template.md');
          if (existingFile) {
            await app.vault.modify(existingFile, templateContent);
            console.log('Template file updated successfully');
          }
        }
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultProjectTemplate = 'project-template.md';
        await plugin.saveSettings();
      }
    });

    // Execute the create project command
    await executeCommand(context, 'Task Sync: Create Project');
    await context.page.waitForSelector('.task-sync-create-project', { timeout: 5000 });

    // Fill in project information
    const nameInput = context.page.locator('input[placeholder*="Website Redesign, Learn Spanish"]');
    await nameInput.fill('E-commerce Platform');

    const areasInput = context.page.locator('input[placeholder*="Work, Learning"]');
    await areasInput.fill('Work, Technology');

    const descriptionInput = context.page.locator('textarea[placeholder*="Brief description"]');
    await descriptionInput.fill('Build a modern e-commerce platform with React and Node.js');

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(2000);

    // Check if project file was created
    const projectFileExists = await fileExists(context.page, 'Projects/E-commerce Platform.md');
    expect(projectFileExists).toBe(true);

    // Check project file content uses template
    const projectContent = await getFileContent(context.page, 'Projects/E-commerce Platform.md');
    expect(projectContent).toContain('Status: Planning');
    expect(projectContent).toContain('## Overview');
    expect(projectContent).toContain('## Objectives');
    expect(projectContent).toContain('## Milestones');
    expect(projectContent).toContain('Build a modern e-commerce platform with React and Node.js');
    expect(projectContent).toContain('- Work');
    expect(projectContent).toContain('- Technology');
    expect(projectContent).toContain('![[Bases/E-commerce Platform.base]]');
  });

  test('should create project without areas', async () => {
    await createTestFolders(context.page);

    // Execute the create project command
    await executeCommand(context, 'Task Sync: Create Project');
    await context.page.waitForSelector('.task-sync-create-project', { timeout: 5000 });

    // Fill in only project name
    const nameInput = context.page.locator('input[placeholder*="Website Redesign, Learn Spanish"]');
    await nameInput.fill('Simple Project');

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(2000);

    // Check if project file was created
    const projectFileExists = await fileExists(context.page, 'Projects/Simple Project.md');
    expect(projectFileExists).toBe(true);

    // Check project file content
    const projectContent = await getFileContent(context.page, 'Projects/Simple Project.md');
    expect(projectContent).toContain('Name: Simple Project');
    expect(projectContent).toContain('Type: Project');
    expect(projectContent).toContain('Areas:'); // Should be empty but present
  });
});
