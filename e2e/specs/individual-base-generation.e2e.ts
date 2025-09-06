/**
 * E2E tests for Individual Base Generation functionality
 * Tests the creation and configuration of individual area and project bases
 */

import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForBasesRegeneration,
  configureBasesSettings,
  toggleAreaBasesEnabled,
  toggleProjectBasesEnabled
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Individual Base Generation', () => {
  const context = setupE2ETestHooks();

  test('should generate individual area base with correct structure', async () => {
    await createTestFolders(context.page);

    // Create an area file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const areaContent = `---
Name: Health
Type: Area
---

## Notes

This is a health area for tracking fitness and wellness.

## Tasks

![[Health.base]]
`;
      await app.vault.create('Areas/Health.md', areaContent);
    });

    // Wait for metadata cache to update
    await context.page.waitForTimeout(1000);

    // Enable area bases via UI and trigger regeneration
    await configureBasesSettings(context, true, false);

    // Trigger regeneration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.regenerateBases();
      }
    });

    await waitForBasesRegeneration(context.page);

    // Check if individual area base was created
    const baseFileExists = await fileExists(context.page, 'Bases/Health.base');
    expect(baseFileExists).toBe(true);

    // Check base file content structure
    const baseContent = await getFileContent(context.page, 'Bases/Health.base');

    // Check properties section
    expect(baseContent).toContain('properties:');
    expect(baseContent).toContain('name: Title');
    expect(baseContent).toContain('name: Type');
    expect(baseContent).toContain('name: Priority');
    expect(baseContent).toContain('name: Project');
    expect(baseContent).toContain('name: Done');
    expect(baseContent).toContain('type: checkbox');
    expect(baseContent).toContain('type: string');

    // Check formulas section
    expect(baseContent).toContain('formulas:');
    expect(baseContent).toContain('Title: link(file.name, Title)');

    // Check views
    expect(baseContent).toContain('views:');
    expect(baseContent).toContain('name: Tasks');
    expect(baseContent).toContain('name: All Bugs');
    expect(baseContent).toContain('name: All Features');
    expect(baseContent).toContain('name: All Improvements');
    expect(baseContent).toContain('name: All Chores');

    // Check filtering
    expect(baseContent).toContain('Areas.contains(link("Health"))');
    expect(baseContent).toContain('Type == "Bug"');
    expect(baseContent).toContain('Type == "Feature"');
  });

  test('should generate individual project base with correct structure', async () => {
    await createTestFolders(context.page);

    // Create a project file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const projectContent = `---
Name: Website Redesign
Type: Project
Areas: Work
---

## Notes

This is a website redesign project.

## Tasks

![[Website-Redesign.base]]
`;
      await app.vault.create('Projects/Website Redesign.md', projectContent);
    });

    // Enable project bases via UI and trigger regeneration
    await configureBasesSettings(context, false, true);

    // Trigger regeneration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.regenerateBases();
      }
    });

    await waitForBasesRegeneration(context.page);

    // Check if individual project base was created
    const baseFileExists = await fileExists(context.page, 'Bases/Website Redesign.base');
    expect(baseFileExists).toBe(true);

    // Check base file content structure
    const baseContent = await getFileContent(context.page, 'Bases/Website Redesign.base');

    // Check properties section
    expect(baseContent).toContain('properties:');
    expect(baseContent).toContain('name: Title');
    expect(baseContent).toContain('name: Type');
    expect(baseContent).toContain('name: Priority');
    expect(baseContent).toContain('name: Areas');
    expect(baseContent).toContain('name: Done');
    expect(baseContent).toContain('name: Status');
    expect(baseContent).toContain('type: checkbox');
    expect(baseContent).toContain('type: string');

    // Check formulas section
    expect(baseContent).toContain('formulas:');
    expect(baseContent).toContain('Title: link(file.name, Title)');

    // Check views
    expect(baseContent).toContain('views:');
    expect(baseContent).toContain('name: Tasks');
    expect(baseContent).toContain('name: All Bugs');
    expect(baseContent).toContain('name: All Features');
    expect(baseContent).toContain('name: All Improvements');
    expect(baseContent).toContain('name: All Chores');

    // Check filtering
    expect(baseContent).toContain('Project.contains(link("Website Redesign"))');
    expect(baseContent).toContain('Type == "Bug"');
    expect(baseContent).toContain('Type == "Feature"');
  });

  test('should respect area bases enabled setting', async () => {
    await createTestFolders(context.page);

    // Create an area file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const areaContent = `---
Name: Finance
Type: Area
---

## Notes

Finance area for budgeting and investments.
`;
      await app.vault.create('Areas/Finance.md', areaContent);
    });

    // Disable area bases and enable project bases via UI
    await configureBasesSettings(context, false, true);

    // Trigger regeneration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.regenerateBases();
      }
    });

    await waitForBasesRegeneration(context.page);

    // Check that individual area base was NOT created
    const baseFileExists = await fileExists(context.page, 'Bases/Finance.base');
    expect(baseFileExists).toBe(false);
  });

  test('should respect project bases enabled setting', async () => {
    await createTestFolders(context.page);

    // Create a project file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const projectContent = `---
Name: Mobile App
Type: Project
Areas: Technology
---

## Notes

Mobile app development project.
`;
      await app.vault.create('Projects/Mobile App.md', projectContent);
    });

    // Enable area bases and disable project bases via UI
    await configureBasesSettings(context, true, false);

    // Trigger regeneration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.regenerateBases();
      }
    });

    await waitForBasesRegeneration(context.page);

    // Check that individual project base was NOT created
    const baseFileExists = await fileExists(context.page, 'Bases/Mobile App.base');
    expect(baseFileExists).toBe(false);
  });

  test('should update base embedding in area/project files', async () => {
    await createTestFolders(context.page);

    // Create an area file without specific base embedding
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const areaContent = `---
Name: Learning
Type: Area
---

## Notes

Learning and skill development area.

## Tasks

![[Tasks.base]]
`;
      await app.vault.create('Areas/Learning.md', areaContent);
    });

    // Enable area bases via UI and trigger regeneration
    await configureBasesSettings(context, true, false);

    // Trigger regeneration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.regenerateBases();
      }
    });

    await waitForBasesRegeneration(context.page);

    // Check that the area file was updated with specific base embedding
    const areaContent = await getFileContent(context.page, 'Areas/Learning.md');
    expect(areaContent).toContain('![[Bases/Learning.base]]');
    expect(areaContent).not.toContain('![[Tasks.base]]');
  });

  test('should handle multiple areas and projects', async () => {
    await createTestFolders(context.page);

    // Create multiple areas and projects
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      // Create areas (check if they exist first)
      try {
        await app.vault.create('Areas/Health2.md', `---
Name: Health2
Type: Area
---

Health and fitness tracking.
`);
      } catch (error) {
        console.log('Health2 area already exists');
      }

      try {
        await app.vault.create('Areas/Finance2.md', `---
Name: Finance2
Type: Area
---

Financial planning and budgeting.
`);
      } catch (error) {
        console.log('Finance2 area already exists');
      }

      // Create projects
      try {
        await app.vault.create('Projects/Workout Plan.md', `---
Name: Workout Plan
Type: Project
Areas: Health2
---

12-week workout plan.
`);
      } catch (error) {
        console.log('Workout Plan project already exists');
      }

      try {
        await app.vault.create('Projects/Budget Tracker.md', `---
Name: Budget Tracker
Type: Project
Areas: Finance2
---

Monthly budget tracking system.
`);
      } catch (error) {
        console.log('Budget Tracker project already exists');
      }
    });

    // Enable both area and project bases via UI
    await configureBasesSettings(context, true, true);

    // Trigger regeneration
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        await plugin.regenerateBases();
      }
    });

    await waitForBasesRegeneration(context.page);

    // Check that all individual bases were created
    const healthBaseExists = await fileExists(context.page, 'Bases/Health2.base');
    expect(healthBaseExists).toBe(true);

    const financeBaseExists = await fileExists(context.page, 'Bases/Finance2.base');
    expect(financeBaseExists).toBe(true);

    const workoutBaseExists = await fileExists(context.page, 'Bases/Workout Plan.base');
    expect(workoutBaseExists).toBe(true);

    const budgetBaseExists = await fileExists(context.page, 'Bases/Budget Tracker.base');
    expect(budgetBaseExists).toBe(true);

    // Check that main Tasks.base still exists
    const mainBaseExists = await fileExists(context.page, 'Bases/Tasks.base');
    expect(mainBaseExists).toBe(true);
  });
});
