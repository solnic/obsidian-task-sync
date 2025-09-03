import { test, expect, describe } from 'vitest';
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForAsyncOperation
} from '../helpers/task-sync-setup';
import { setupE2ETestHooks } from '../helpers/shared-context';

describe('Template {{tasks}} Syntax', () => {
  const context = setupE2ETestHooks();

  test('should process {{tasks}} syntax in project templates', async () => {
    await createTestFolders(context.page);

    // Create a project template with {{tasks}} syntax
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Name: {{name}}
Type: Project
Areas: {{areas}}
Status: Planning
---

## Overview

{{description}}

## Objectives

- [ ] Objective 1
- [ ] Objective 2

## Tasks

{{tasks}}

## Notes

Additional project notes here.
`;

      try {
        await app.vault.create('Templates/project-tasks-template.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultProjectTemplate = 'project-tasks-template.md';
        await plugin.saveSettings();
      }
    });

    // Create a project using the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.createProject) {
        await plugin.createProject({
          name: 'Mobile App Development',
          description: 'Building a cross-platform mobile application',
          areas: 'Technology, Business'
        });
      }
    });

    await waitForAsyncOperation(1000);

    // Check if project file was created
    const projectExists = await fileExists(context.page, 'Projects/Mobile App Development.md');
    expect(projectExists).toBe(true);

    // Check project file content
    const projectContent = await getFileContent(context.page, 'Projects/Mobile App Development.md');

    // Verify {{tasks}} was replaced with specific base embed
    expect(projectContent).toContain('![[Bases/Mobile App Development.base]]');
    expect(projectContent).not.toContain('{{tasks}}');

    // Verify other variables were processed
    expect(projectContent).toContain('Name: Mobile App Development');
    expect(projectContent).toContain('Areas: Technology, Business');
    expect(projectContent).toContain('Building a cross-platform mobile application');
  });

  test('should process {{tasks}} syntax in area templates', async () => {
    await createTestFolders(context.page);

    // Create an area template with {{tasks}} syntax
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Name: {{name}}
Type: Area
Custom: true
---

## Overview

{{description}}

## Goals

- Goal 1
- Goal 2

## Tasks

{{tasks}}

## Resources

Links and resources for this area.
`;

      try {
        await app.vault.create('Templates/area-tasks-template.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultAreaTemplate = 'area-tasks-template.md';
        await plugin.saveSettings();
      }
    });

    // Create an area using the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.createArea) {
        await plugin.createArea({
          name: 'Health & Wellness',
          description: 'Maintaining physical and mental health'
        });
      }
    });

    await waitForAsyncOperation(1000);

    // Check if area file was created
    const areaExists = await fileExists(context.page, 'Areas/Health & Wellness.md');
    expect(areaExists).toBe(true);

    // Check area file content
    const areaContent = await getFileContent(context.page, 'Areas/Health & Wellness.md');

    // Verify {{tasks}} was replaced with specific base embed
    expect(areaContent).toContain('![[Bases/Health & Wellness.base]]');
    expect(areaContent).not.toContain('{{tasks}}');

    // Verify other variables were processed
    expect(areaContent).toContain('Name: Health & Wellness');
    expect(areaContent).toContain('Maintaining physical and mental health');
  });

  test('should not create duplicate base embeds when {{tasks}} is used', async () => {
    await createTestFolders(context.page);

    // Create a template with {{tasks}} syntax
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Name: {{name}}
Type: Project
---

## Tasks
{{tasks}}`;

      try {
        await app.vault.create('Templates/simple-project-template.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultProjectTemplate = 'simple-project-template.md';
        await plugin.saveSettings();
      }
    });

    // Create a project
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.createProject) {
        await plugin.createProject({
          name: 'Test Project',
          description: 'A test project'
        });
      }
    });

    await waitForAsyncOperation(1000);

    // Regenerate bases to test for duplicates
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.regenerateBases) {
        await plugin.regenerateBases();
      }
    });

    await waitForAsyncOperation(1000);

    // Check project file content
    const projectContent = await getFileContent(context.page, 'Projects/Test Project.md');

    // Count base embeds - should only have one
    const baseEmbedMatches = projectContent.match(/!\[\[.*\.base\]\]/g);
    expect(baseEmbedMatches).toHaveLength(1);
    expect(baseEmbedMatches[0]).toBe('![[Bases/Test Project.base]]');
  });

  test('should handle multiple {{tasks}} occurrences in template', async () => {
    await createTestFolders(context.page);

    // Create a template with multiple {{tasks}} occurrences
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Name: {{name}}
Type: Project
---

## Active Tasks
{{tasks}}

## Archived Tasks
{{tasks}}`;

      try {
        await app.vault.create('Templates/multi-tasks-template.md', templateContent);
      } catch (error) {
        console.log('Template creation error:', error);
      }
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin) {
        plugin.settings.defaultProjectTemplate = 'multi-tasks-template.md';
        await plugin.saveSettings();
      }
    });

    // Create a project
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins['obsidian-task-sync'];
      if (plugin && plugin.createProject) {
        await plugin.createProject({
          name: 'Multi Tasks Project',
          description: 'A project with multiple task sections'
        });
      }
    });

    await waitForAsyncOperation(1000);

    // Check project file content
    const projectContent = await getFileContent(context.page, 'Projects/Multi Tasks Project.md');

    // Should have two base embeds (one for each {{tasks}})
    const baseEmbedMatches = projectContent.match(/!\[\[Bases\/Multi Tasks Project\.base\]\]/g);
    expect(baseEmbedMatches).toHaveLength(2);
    expect(projectContent).not.toContain('{{tasks}}');
  });
});
