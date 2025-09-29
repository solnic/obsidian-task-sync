/**
 * E2E tests for Area Creation functionality
 * Tests the area creation command, modal, and base generation
 */

import { test, expect } from "../../../helpers/setup";
import {
  executeCommand,
  fileExists,
  getFileContent,
  verifyAreaProperties,
  getAreaByName,
  expectNotice,
  updatePluginSettings,
  waitForBaseFile,
  waitForFileCreation,
} from "../../../helpers/global";

test.describe("Area Creation", () => {
  test("should create area with basic information", async ({ page }) => {
    await executeCommand(page, "Task Sync: Create Area");

    await expect(page.locator(".task-sync-create-area")).toBeVisible();

    // Fill in area name
    const nameInput = page.locator(
      'input[placeholder*="Health, Finance, Learning"]'
    );
    await nameInput.fill("Test Area");

    // Fill in description
    const descriptionInput = page.locator(
      'textarea[placeholder*="Brief description"]'
    );
    await descriptionInput.fill("This is a test area for e2e testing");

    // Click create button
    await page.locator('button:has-text("Create Area")').click();

    await waitForFileCreation(page, "Areas/Test Area.md");

    await page.waitForTimeout(2000);

    const area = await getAreaByName(page, "Test Area");

    await verifyAreaProperties(page, area.file.path, {
      Name: "Test Area",
      Type: "Area",
    });
  });

  test("should create individual area base when enabled", async ({ page }) => {
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
      autoSyncAreaProjectBases: true,
    });

    await executeCommand(page, "Task Sync: Create Area");
    await expect(page.locator(".task-sync-create-area")).toBeVisible();

    const nameInput = page.locator(
      'input[placeholder*="Health, Finance, Learning"]'
    );
    await nameInput.fill("Finance Area");

    // Click create button
    await page.locator('button:has-text("Create Area")').click();

    await waitForBaseFile(page, "Bases/Finance Area.base");
    await page.waitForTimeout(2000);

    // Check base file content
    const baseContent = await getFileContent(page, "Bases/Finance Area.base");
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
    expect(baseContent).toContain('Areas.contains(link("Finance Area"))');
  });

  test("should validate required fields", async ({ page }) => {
    await executeCommand(page, "Task Sync: Create Area");
    await expect(page.locator(".task-sync-create-area")).toBeVisible();

    await page.locator('button:has-text("Create Area")').click();

    // Check for error notice
    await expectNotice(page, "Area name is required");
  });

  test("should handle special characters in area name", async ({ page }) => {
    await executeCommand(page, "Task Sync: Create Area");
    await expect(page.locator(".task-sync-create-area")).toBeVisible();

    const nameInput = page.locator(
      'input[placeholder*="Health, Finance, Learning"]'
    );
    await nameInput.fill("Health & Fitness (2024)");

    // Click create button
    await page.locator('button:has-text("Create Area")').click();

    const areaFileExists = await fileExists(
      page,
      "Areas/Health & Fitness (2024).md"
    );
    expect(areaFileExists).toBe(true);

    // Check area file content has original name using API
    const frontMatter = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.noteManagers.loadFrontMatter(
        "Areas/Health & Fitness (2024).md"
      );
    });

    expect(frontMatter.Name).toBe("Health & Fitness (2024)");
  });

  test("should use template when configured", async ({ page }) => {
    // Create a custom area template
    await page.evaluate(async () => {
      const app = (window as any).app;
      const templateContent = `---
Name: ''
Type: Area
Custom: true
---

## Overview

Continuous learning and skill development

## Goals

- Goal 1
- Goal 2

## Tasks

![[{{name}}.base]]
`;

      // Delete existing template if it exists
      const templatePath = "Templates/area-template.md";
      if (await app.vault.adapter.exists(templatePath)) {
        await app.vault.delete(app.vault.getAbstractFileByPath(templatePath));
      }

      try {
        await app.vault.create("Templates/area-template.md", templateContent);
      } catch (error) {
        console.log("Template creation error:", error);
      }
    });

    // Configure plugin to use the template
    await updatePluginSettings(page, {
      defaultAreaTemplate: "area-template.md",
    });

    // Execute the create area command
    await executeCommand(page, "Task Sync: Create Area");
    await expect(page.locator(".task-sync-create-area")).toBeVisible();

    // Fill in area information
    const nameInput = page.locator(
      'input[placeholder*="Health, Finance, Learning"]'
    );
    await nameInput.fill("Learning Area");

    const descriptionInput = page.locator(
      'textarea[placeholder*="Brief description"]'
    );
    await descriptionInput.fill("Continuous learning and skill development");

    // Click create button
    await page.locator('button:has-text("Create Area")').click();
    await page.waitForTimeout(2000);

    // Check if area file was created
    const areaFileExists = await fileExists(page, "Areas/Learning Area.md");
    expect(areaFileExists).toBe(true);

    // Check area file content uses template
    await verifyAreaProperties(page, "Areas/Learning Area.md", {
      Custom: true,
    });

    // Check that template content is present
    const areaContent = await getFileContent(page, "Areas/Learning Area.md");
    expect(areaContent).toContain("## Overview");
    expect(areaContent).toContain("## Goals");
    expect(areaContent).toContain("Continuous learning and skill development");
    expect(areaContent).toContain("![[Bases/Learning Area.base]]");
  });
});
