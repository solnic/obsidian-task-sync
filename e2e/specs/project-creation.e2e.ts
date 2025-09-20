/**
 * E2E tests for Project Creation functionality
 * Tests the project creation command, modal, and base generation
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  getFileContent,
  fileExists,
  verifyProjectProperties,
  executeCommand,
} from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Project Creation", () => {
  const context = setupE2ETestHooks();

  test("should create project with basic information", async () => {
    await executeCommand(context, "Task Sync: Create Project");

    await context.page.waitForSelector(".task-sync-create-project", {
      timeout: 5000,
    });

    // Fill in project name
    const nameInput = context.page.locator(
      'input[placeholder*="Website Redesign, Learn Spanish"]'
    );
    await nameInput.fill("Test Project");

    // Fill in areas
    const areasInput = context.page.locator(
      'input[placeholder*="Work, Learning"]'
    );
    await areasInput.fill("Work, Development");

    // Fill in description
    const descriptionInput = context.page.locator(
      'textarea[placeholder*="Brief description"]'
    );
    await descriptionInput.fill("This is a test project for e2e testing");

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(2000);

    // Check if project file was created
    const projectFileExists = await fileExists(
      context.page,
      "Projects/Test Project.md"
    );
    expect(projectFileExists).toBe(true);

    // Check project file content using property verification
    await verifyProjectProperties(context.page, "Projects/Test Project.md", {
      Name: "Test Project",
      Type: "Project",
      Areas: ["Work", "Development"], // Areas should be split into array format
    });

    // Check that description and base embed are in the content
    const projectContent = await getFileContent(
      context.page,
      "Projects/Test Project.md"
    );
    expect(projectContent).toContain("This is a test project for e2e testing");
    expect(projectContent).toContain("![[Bases/Test Project.base]]");
  });

  test("should create individual project base when enabled", async () => {
    // Ensure project bases are enabled
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
      }
    });

    // Execute the create project command
    await executeCommand(context, "Task Sync: Create Project");
    await context.page.waitForSelector(".task-sync-create-project", {
      timeout: 5000,
    });

    // Fill in project name
    const nameInput = context.page.locator(
      'input[placeholder*="Website Redesign, Learn Spanish"]'
    );
    await nameInput.fill("Website Redesign");

    // Fill in areas
    const areasInput = context.page.locator(
      'input[placeholder*="Work, Learning"]'
    );
    await areasInput.fill("Work");

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(3000);

    // Check if individual project base was created
    const baseFileExists = await fileExists(
      context.page,
      "Bases/Website Redesign.base"
    );
    expect(baseFileExists).toBe(true);

    // Check base file content
    const baseContent = await getFileContent(
      context.page,
      "Bases/Website Redesign.base"
    );
    expect(baseContent).toContain("properties:");
    expect(baseContent).toContain("name: Title");
    expect(baseContent).toContain("name: Type");
    expect(baseContent).toContain("name: Done");
    expect(baseContent).toContain("formulas:");
    expect(baseContent).toContain("Title: link(file.name, Title)");
    expect(baseContent).toContain("views:");
    expect(baseContent).toContain("name: Tasks");
    expect(baseContent).toContain("name: All Bugs");
    expect(baseContent).toContain("name: All Features");
    expect(baseContent).toContain('Project.contains(link("Website Redesign"))');
  });

  test("should validate required fields", async () => {
    // Execute the create project command
    await executeCommand(context, "Task Sync: Create Project");
    await context.page.waitForSelector(".task-sync-create-project", {
      timeout: 5000,
    });

    // Try to create without name
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForSelector(".task-sync-error", { timeout: 5000 });

    // Check for error message
    const errorExists = await context.page
      .locator(".task-sync-error")
      .isVisible();
    expect(errorExists).toBe(true);

    const errorText = await context.page
      .locator(".task-sync-error")
      .textContent();
    expect(errorText).toContain("Project name is required");

    // Close modal
    await context.page.keyboard.press("Escape");
    await context.page.waitForTimeout(500);
  });

  test("should handle special characters in project name", async () => {
    // Execute the create project command
    await executeCommand(context, "Task Sync: Create Project");
    await context.page.waitForSelector(".task-sync-create-project", {
      timeout: 5000,
    });

    // Fill in project name with special characters
    const nameInput = context.page.locator(
      'input[placeholder*="Website Redesign, Learn Spanish"]'
    );
    await nameInput.fill("Mobile App (iOS & Android)");

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(2000);

    // Check if project file was created with original name
    const projectFileExists = await fileExists(
      context.page,
      "Projects/Mobile App (iOS & Android).md"
    );
    expect(projectFileExists).toBe(true);

    // Check project file content has original name using API
    const frontMatter = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.noteManagers.loadFrontMatter(
        "Projects/Mobile App (iOS & Android).md"
      );
    });

    expect(frontMatter.Name).toBe("Mobile App (iOS & Android)");
  });

  test("should use template when configured", async () => {
    // Create a custom project template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Name: ''
Type: Project
Areas:
  - Work
  - Technology
Status: Planning
---

## Overview

Build a modern e-commerce platform with React and Node.js

## Objectives

- [ ] Objective 1
- [ ] Objective 2

## Milestones

- [ ] Milestone 1
- [ ] Milestone 2

## Tasks

![[{{name}}.base]]
`;

      // Delete existing template if it exists
      const templatePath = "Templates/project-template.md";
      if (await app.vault.adapter.exists(templatePath)) {
        await app.vault.delete(app.vault.getAbstractFileByPath(templatePath));
      }

      await app.vault.create(templatePath, templateContent);
    });

    // Configure plugin to use the template
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.defaultProjectTemplate = "project-template.md";
        await plugin.saveSettings();
      }
    });

    // Execute the create project command
    await executeCommand(context, "Task Sync: Create Project");
    await context.page.waitForSelector(".task-sync-create-project", {
      timeout: 5000,
    });

    // Fill in project information
    const nameInput = context.page.locator(
      'input[placeholder*="Website Redesign, Learn Spanish"]'
    );
    await nameInput.fill("E-commerce Platform");

    const areasInput = context.page.locator(
      'input[placeholder*="Work, Learning"]'
    );
    await areasInput.fill("Work, Technology");

    const descriptionInput = context.page.locator(
      'textarea[placeholder*="Brief description"]'
    );
    await descriptionInput.fill(
      "Build a modern e-commerce platform with React and Node.js"
    );

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(2000);

    // Check if project file was created
    const projectFileExists = await fileExists(
      context.page,
      "Projects/E-commerce Platform.md"
    );
    expect(projectFileExists).toBe(true);

    // Check project file content uses template
    await verifyProjectProperties(
      context.page,
      "Projects/E-commerce Platform.md",
      {
        Status: "Planning",
        Areas: ["Work", "Technology"],
      }
    );

    // Check that template content is present
    const projectContent = await getFileContent(
      context.page,
      "Projects/E-commerce Platform.md"
    );
    expect(projectContent).toContain("## Overview");
    expect(projectContent).toContain("## Objectives");
    expect(projectContent).toContain("## Milestones");
    expect(projectContent).toContain(
      "Build a modern e-commerce platform with React and Node.js"
    );
    expect(projectContent).toContain("![[Bases/E-commerce Platform.base]]");
  });

  test("should create project without areas", async () => {
    // Execute the create project command
    await executeCommand(context, "Task Sync: Create Project");
    await context.page.waitForSelector(".task-sync-create-project", {
      timeout: 5000,
    });

    // Fill in only project name
    const nameInput = context.page.locator(
      'input[placeholder*="Website Redesign, Learn Spanish"]'
    );
    await nameInput.fill("Simple Project");

    // Click create button
    await context.page.locator('button:has-text("Create Project")').click();
    await context.page.waitForTimeout(2000);

    // Check if project file was created
    const projectFileExists = await fileExists(
      context.page,
      "Projects/Simple Project.md"
    );
    expect(projectFileExists).toBe(true);

    // Check project file content using property verification
    await verifyProjectProperties(context.page, "Projects/Simple Project.md", {
      Name: "Simple Project",
      Type: "Project",
      Areas: [], // Should be empty but present
    });
  });
});
