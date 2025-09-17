/**
 * E2E tests for Individual Base Generation functionality
 * Tests the creation and configuration of individual area and project bases
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  getFileContent,
  fileExists,
  waitForBasesRegeneration,
  configureBasesSettings,
  executeCommand,
} from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createArea, createProject } from "../helpers/entity-helpers";

describe("Individual Base Generation", () => {
  const context = setupE2ETestHooks();

  test("should generate individual area base with correct structure", async () => {
    // Create an area file using entity helper
    await createArea(context, {
      name: "Health",
      description:
        "## Notes\n\nThis is a health area for tracking fitness and wellness.\n\n## Tasks\n\n![[Bases/Health.base]]",
    });

    // Wait for metadata cache to update
    await context.page.waitForTimeout(1000);

    // Enable area bases via UI and trigger regeneration
    await configureBasesSettings(context, true, false);

    // Trigger regeneration via command
    await executeCommand(context, "Task Sync: Refresh");

    await waitForBasesRegeneration(context.page);

    // Check if individual area base was created
    const baseFileExists = await fileExists(context.page, "Bases/Health.base");
    expect(baseFileExists).toBe(true);

    // Check base file content structure
    const baseContent = await getFileContent(context.page, "Bases/Health.base");

    // Check properties section
    expect(baseContent).toContain("properties:");
    expect(baseContent).toContain("name: Title");
    expect(baseContent).toContain("name: Type");
    expect(baseContent).toContain("name: Priority");
    expect(baseContent).toContain("name: Project");
    expect(baseContent).toContain("name: Done");
    expect(baseContent).toContain("type: checkbox");
    expect(baseContent).toContain("type: string");

    // Check formulas section
    expect(baseContent).toContain("formulas:");
    expect(baseContent).toContain("Title: link(file.name, Title)");

    // Check views
    expect(baseContent).toContain("views:");
    expect(baseContent).toContain("name: Tasks");
    expect(baseContent).toContain("name: All Bugs");
    expect(baseContent).toContain("name: All Features");
    expect(baseContent).toContain("name: All Improvements");
    expect(baseContent).toContain("name: All Chores");

    // Check filtering
    expect(baseContent).toContain('Areas.contains(link("Health"))');
    expect(baseContent).toContain('Category == "Bug"');
    expect(baseContent).toContain('Category == "Feature"');
  });

  test("should generate individual project base with correct structure", async () => {
    // Create a project file using entity helper
    await createProject(context, {
      name: "Website Redesign",
      areas: ["Work"],
      description:
        "## Notes\n\nThis is a website redesign project.\n\n## Tasks\n\n![[Bases/Website Redesign.base]]",
    });

    // Enable project bases via UI and trigger regeneration
    await configureBasesSettings(context, false, true);

    // Trigger regeneration via command
    await executeCommand(context, "Task Sync: Refresh");

    await waitForBasesRegeneration(context.page);

    // Check if individual project base was created
    const baseFileExists = await fileExists(
      context.page,
      "Bases/Website Redesign.base"
    );
    expect(baseFileExists).toBe(true);

    // Check base file content structure
    const baseContent = await getFileContent(
      context.page,
      "Bases/Website Redesign.base"
    );

    // Check properties section
    expect(baseContent).toContain("properties:");
    expect(baseContent).toContain("name: Title");
    expect(baseContent).toContain("name: Type");
    expect(baseContent).toContain("name: Priority");
    expect(baseContent).toContain("name: Areas");
    expect(baseContent).toContain("name: Done");
    expect(baseContent).toContain("name: Status");
    expect(baseContent).toContain("type: checkbox");
    expect(baseContent).toContain("type: string");

    // Check formulas section
    expect(baseContent).toContain("formulas:");
    expect(baseContent).toContain("Title: link(file.name, Title)");

    // Check views
    expect(baseContent).toContain("views:");
    expect(baseContent).toContain("name: Tasks");
    expect(baseContent).toContain("name: All Bugs");
    expect(baseContent).toContain("name: All Features");
    expect(baseContent).toContain("name: All Improvements");
    expect(baseContent).toContain("name: All Chores");

    // Check filtering
    expect(baseContent).toContain('Project.contains(link("Website Redesign"))');
    expect(baseContent).toContain('Category == "Bug"');
    expect(baseContent).toContain('Category == "Feature"');
  });

  test("should respect area bases enabled setting", async () => {
    // Disable area bases and enable project bases via UI
    await configureBasesSettings(context, false, true);

    // Create an area file using entity helper
    await createArea(context, {
      name: "Finance",
      description: "## Notes\n\nFinance area for budgeting and investments.",
    });

    // Trigger regeneration via command
    await executeCommand(context, "Task Sync: Refresh");

    await waitForBasesRegeneration(context.page);

    // Check that individual area base was NOT created
    const baseFileExists = await fileExists(context.page, "Bases/Finance.base");
    expect(baseFileExists).toBe(false);
  });

  test("should respect project bases enabled setting", async () => {
    // Create a project file using entity helper
    await createProject(context, {
      name: "Mobile App",
      areas: ["Technology"],
      description: "## Notes\n\nMobile app development project.",
    });

    // Enable area bases and disable project bases via UI
    await configureBasesSettings(context, true, false);

    // Trigger regeneration via command
    await executeCommand(context, "Task Sync: Refresh");

    await waitForBasesRegeneration(context.page);

    // Check that individual project base was NOT created
    const baseFileExists = await fileExists(
      context.page,
      "Bases/Mobile App.base"
    );
    expect(baseFileExists).toBe(false);
  });

  test("should update base embedding in area/project files", async () => {
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

{{tasks}}
`;
      await app.vault.create("Areas/Learning.md", areaContent);
    });

    // Enable area bases directly via plugin settings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      plugin.settings.areaBasesEnabled = true;
      plugin.settings.projectBasesEnabled = false;
      await plugin.saveSettings();
    });

    await executeCommand(context, "Task Sync: Refresh");
    await waitForBasesRegeneration(context.page);

    const areaContent = await getFileContent(context.page, "Areas/Learning.md");
    expect(areaContent).toContain("![[Bases/Learning.base]]");
  });
});
