/**
 * E2E tests for Base Generation functionality
 * Tests the creation and structure of Obsidian Bases for projects, areas, and tasks
 */

import { test, expect } from "../../helpers/setup";
import {
  updatePluginSettings,
  waitForBaseFile,
  waitForFileContentToContain,
  readVaultFile,
  type ExtendedPage,
} from "../../helpers/global";
import {
  createArea,
  createProject,
  createTask,
} from "../../helpers/entity-helpers";

test.describe("Base Generation", () => {
  test("should generate Tasks.base with correct structure and filters", async ({
    page,
  }) => {
    // Create some projects and areas for the Tasks.base to reference
    await createProject(page, {
      name: "Test Project",
      description: "A test project",
    });

    await createArea(page, {
      name: "Test Area",
      description: "A test area",
    });

    // Trigger base regeneration
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.host.getExtensionById("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          const projectsAndAreas = await baseManager.getProjectsAndAreas();
          await baseManager.createOrUpdateTasksBase(projectsAndAreas);
        }
      }
    });

    // Wait for Tasks.base to be created
    await waitForBaseFile(page, "Bases/Tasks.base");

    // Read the base file content
    const baseContent = await readVaultFile(page, "Bases/Tasks.base");
    expect(baseContent).toBeTruthy();

    // Verify formulas section
    expect(baseContent).toContain("formulas:");
    expect(baseContent).toContain("Title: link(file.name, Title)");

    // Verify properties section
    expect(baseContent).toContain("properties:");
    expect(baseContent).toContain("name: Title");
    expect(baseContent).toContain("name: Type");
    expect(baseContent).toContain("name: Category");
    expect(baseContent).toContain("name: Priority");
    expect(baseContent).toContain("name: Done");
    expect(baseContent).toContain("name: Status");
    expect(baseContent).toContain("name: Parent Task");
    expect(baseContent).toContain("type: checkbox");

    // Verify views section
    expect(baseContent).toContain("views:");
    expect(baseContent).toContain("name: Tasks");

    // Verify "All [Type]" views exist
    expect(baseContent).toContain("name: All Tasks");
    expect(baseContent).toContain("name: All Bugs");
    expect(baseContent).toContain("name: All Features");
    expect(baseContent).toContain("name: All Improvements");
    expect(baseContent).toContain("name: All Chores");

    // Verify priority-based views exist
    expect(baseContent).toContain("name: Tasks • Low priority");
    expect(baseContent).toContain("name: Tasks • Medium priority");
    expect(baseContent).toContain("name: Tasks • High priority");
    expect(baseContent).toContain("name: Tasks • Urgent priority");

    // Verify filters include notDone and noParentTask
    expect(baseContent).toContain('note["Done"] == false');
    expect(baseContent).toContain('note["Parent Task"] == null');

    // Verify sorting configuration (comprehensive default sort)
    expect(baseContent).toContain("sort:");
    expect(baseContent).toContain("property: Done");
    expect(baseContent).toContain("property: Project");
    expect(baseContent).toContain("property: Category");
    expect(baseContent).toContain("property: file.mtime");
    expect(baseContent).toContain("property: file.ctime");
    expect(baseContent).toContain("property: formula.Title");
    expect(baseContent).toContain("direction: ASC");
    expect(baseContent).toContain("direction: DESC");
  });

  test("should generate individual project base with correct structure", async ({
    page,
  }) => {
    // Enable project bases and auto-sync
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
      autoSyncAreaProjectBases: true,
    });

    // Create a project - this will automatically generate the base file
    // due to autoSyncAreaProjectBases being enabled
    const project = await createProject(page, {
      name: "Website Redesign",
      description: "Redesign company website",
    });

    // Wait for project base to be created automatically
    await waitForBaseFile(page, "Bases/Website Redesign.base");

    // Read the base file content
    const baseContent = await readVaultFile(
      page,
      "Bases/Website Redesign.base"
    );
    expect(baseContent).toBeTruthy();

    // Verify formulas
    expect(baseContent).toContain("formulas:");
    expect(baseContent).toContain("Title: link(file.name, Title)");

    // Verify properties
    expect(baseContent).toContain("properties:");
    expect(baseContent).toContain("name: Title");
    expect(baseContent).toContain("name: Priority");
    expect(baseContent).toContain("name: Areas");
    expect(baseContent).toContain("name: Done");
    expect(baseContent).toContain("name: Status");

    // Verify main Tasks view
    expect(baseContent).toContain("name: Tasks");

    // Verify "All [Type]" views for project
    expect(baseContent).toContain("name: All Tasks");
    expect(baseContent).toContain("name: All Bugs");
    expect(baseContent).toContain("name: All Features");

    // Verify project-specific filtering
    expect(baseContent).toContain('note["Project"] == "[[Website Redesign]]"');
    expect(baseContent).toContain('note["Done"] == false');
    expect(baseContent).toContain('note["Parent Task"] == null');

    // Verify priority-based views
    expect(baseContent).toContain("name: Tasks • Low priority");
    expect(baseContent).toContain("name: Bugs • High priority");
    expect(baseContent).toContain("name: Features • Urgent priority");

    // Verify the project file has base embedding
    const projectContent = await readVaultFile(
      page,
      "Projects/Website Redesign.md"
    );
    expect(projectContent).toContain("![[Bases/Website Redesign.base]]");
  });

  test("should generate individual area base with correct structure", async ({
    page,
  }) => {
    // Enable area bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
    });

    // Create an area
    const area = await createArea(page, {
      name: "Health & Fitness",
      description: "Health and fitness tracking",
    });

    // Trigger area base generation manually (areas don't have automatic generation yet)
    await page.evaluate(
      async ({ areaName }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin) {
          const extension = plugin.host.getExtensionById("obsidian");
          if (extension) {
            const baseManager = extension.getBaseManager();
            const areas = await baseManager.getAreas();
            const area = areas.find((a: any) => a.name === areaName);
            if (area) {
              await baseManager.createOrUpdateAreaBase(area);
            }
          }
        }
      },
      { areaName: area.name }
    );

    // Wait for area base to be created
    await waitForBaseFile(page, "Bases/Health & Fitness.base");

    // Read the base file content
    const baseContent = await readVaultFile(
      page,
      "Bases/Health & Fitness.base"
    );
    expect(baseContent).toBeTruthy();

    // Verify formulas
    expect(baseContent).toContain("formulas:");
    expect(baseContent).toContain("Title: link(file.name, Title)");

    // Verify properties
    expect(baseContent).toContain("properties:");
    expect(baseContent).toContain("name: Title");
    expect(baseContent).toContain("name: Priority");
    expect(baseContent).toContain("name: Projects");
    expect(baseContent).toContain("name: Done");
    expect(baseContent).toContain("name: Status");

    // Verify main Tasks view
    expect(baseContent).toContain("name: Tasks");

    // Verify "All [Type]" views for area
    expect(baseContent).toContain("name: All Tasks");
    expect(baseContent).toContain("name: All Bugs");
    expect(baseContent).toContain("name: All Features");

    // Verify area-specific filtering
    expect(baseContent).toContain('note["Areas"].contains("Health & Fitness")');
    expect(baseContent).toContain('note["Done"] == false');
    expect(baseContent).toContain('note["Parent Task"] == null');

    // Verify priority-based views
    expect(baseContent).toContain("name: Tasks • Medium priority");
    expect(baseContent).toContain("name: Bugs • Low priority");

    // Verify the area file has base embedding
    const areaContent = await readVaultFile(page, "Areas/Health & Fitness.md");
    expect(areaContent).toContain("![[Bases/Health & Fitness.base]]");
  });

  test("should update base embedding when project base is regenerated", async ({
    page,
  }) => {
    // Enable project bases
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
    });

    // Create a project without base embedding
    await page.evaluate(async () => {
      const app = (window as any).app;
      const projectContent = `---
Name: Mobile App
Type: Project
---

## Overview

Mobile app development project.

## Tasks

{{tasks}}
`;
      await app.vault.create("Projects/Mobile App.md", projectContent);
    });

    // Trigger project base generation
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.host.getExtensionById("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          const projects = await baseManager.getProjects();
          const project = projects.find((p: any) => p.name === "Mobile App");
          if (project) {
            await baseManager.createOrUpdateProjectBase(project);
          }
        }
      }
    });

    // Wait for base file and embedding to be added
    await waitForBaseFile(page, "Bases/Mobile App.base");
    await waitForFileContentToContain(
      page,
      "Projects/Mobile App.md",
      "![[Bases/Mobile App.base]]"
    );

    // Verify the project file now has base embedding
    const projectContent = await readVaultFile(page, "Projects/Mobile App.md");
    expect(projectContent).toContain("![[Bases/Mobile App.base]]");
    expect(projectContent).not.toContain("{{tasks}}");
  });
});
