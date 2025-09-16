/**
 * E2E tests for Base Regeneration functionality
 * Tests that bases are regenerated with correct filter syntax and type badges
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  createTestFolders,
  getFileContent,
  fileExists,
  waitForTaskSyncPlugin,
  waitForBaseFile,
  waitForBasesRegeneration,
  toggleSetting,
  fillSetting,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";
import { createArea, createProject } from "../helpers/entity-helpers";

describe("Base Regeneration", () => {
  const context = setupE2ETestHooks();

  test(
    "should generate correct link syntax in area bases after regeneration",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await waitForTaskSyncPlugin(context.page);

      // Create the numbered folder structure first
      await createArea(context, {
        name: "Task Sync",
        description: `This is the Task Sync area for managing plugin development.

## Tasks

![[Tasks.base]]`,
      });

      // Configure settings via UI
      await fillSetting(context, "General", "Areas Folder", "Areas");
      await toggleSetting(
        context,
        "Bases Integration",
        "Enable Area Bases",
        true
      );
      await toggleSetting(
        context,
        "Bases Integration",
        "Auto-Sync Area/Project Bases",
        true
      );

      // Trigger regeneration via command
      await executeCommand(context, "Task Sync: Refresh");

      // Wait for the area base to be created
      await waitForBaseFile(context.page, "Bases/Task Sync.base");

      // Check that the area base was created
      const baseExists = await fileExists(context.page, "Bases/Task Sync.base");
      expect(baseExists).toBe(true);

      // Check that the filter syntax is correct
      const baseContent = await getFileContent(
        context.page,
        "Bases/Task Sync.base"
      );
      expect(baseContent).toContain('Areas.contains(link("Task Sync"))');
      expect(baseContent).not.toContain('Areas.contains(link("Task Sync.md"))');
    }
  );

  test(
    "should generate correct link syntax in project bases after regeneration",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await waitForTaskSyncPlugin(context.page);

      // Create a project using the default folder structure
      await createProject(context, {
        name: "Website Redesign",
        areas: ["Work"],
        description: `Website redesign project for the company.

## Tasks

![[Tasks.base]]`,
      });

      // Configure settings via UI
      await toggleSetting(
        context,
        "Bases Integration",
        "Enable Project Bases",
        true
      );
      await toggleSetting(
        context,
        "Bases Integration",
        "Auto-Sync Area/Project Bases",
        true
      );

      // Trigger regeneration via command
      await executeCommand(context, "Task Sync: Refresh");

      // Wait for bases regeneration to complete
      await waitForBasesRegeneration(context.page);

      // Debug: Check what files exist in the Bases folder
      const basesFiles = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const basesFolder = app.vault.getAbstractFileByPath("Bases");
        if (basesFolder && basesFolder.children) {
          return basesFolder.children.map((file: any) => file.name);
        }
        return [];
      });
      console.log("Files in Bases folder:", basesFiles);

      // Debug: Check what projects were detected
      const projectsDetected = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin && plugin.baseManager) {
          const projectsAndAreas =
            await plugin.baseManager.getProjectsAndAreas();
          return projectsAndAreas;
        }
        return [];
      });
      console.log("Projects and areas detected:", projectsDetected);

      // Debug: Check plugin settings
      const pluginSettings = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin) {
          return {
            projectBasesEnabled: plugin.settings.projectBasesEnabled,
            autoSyncAreaProjectBases: plugin.settings.autoSyncAreaProjectBases,
            basesFolder: plugin.settings.basesFolder,
          };
        }
        return null;
      });
      console.log("Plugin settings:", pluginSettings);

      // Check that the project base was created
      const baseExists = await fileExists(
        context.page,
        "Bases/Website Redesign.base"
      );
      expect(baseExists).toBe(true);

      // Check that the filter syntax is correct
      const baseContent = await getFileContent(
        context.page,
        "Bases/Website Redesign.base"
      );
      expect(baseContent).toContain(
        'Project.contains(link("Website Redesign"))'
      );
      expect(baseContent).not.toContain(
        'Project.contains(link("Website Redesign.md"))'
      );
    }
  );

  test(
    "should generate clean type display in base formulas",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await waitForTaskSyncPlugin(context.page);

      // Trigger regeneration via command (task types are already configured by default)
      await executeCommand(context, "Task Sync: Refresh");

      // Wait for bases regeneration to complete
      await waitForBasesRegeneration(context.page);

      // Check that the main Tasks base has correct type badge formula
      const baseExists = await fileExists(context.page, "Bases/Tasks.base");
      expect(baseExists).toBe(true);

      // Check that type formula is correct (using formulas section)
      const baseContent = await getFileContent(
        context.page,
        "Bases/Tasks.base"
      );
      expect(baseContent).toContain("formulas:");
      expect(baseContent).toContain("Title: link(file.name, Title)");
      expect(baseContent).toContain("name: Type");
      expect(baseContent).toContain("type: string");

      // Should use simple Type display without complex formatting
      expect(baseContent).not.toContain("if(Type ==");
      expect(baseContent).not.toContain("RED:");
      expect(baseContent).not.toContain("BLUE:");

      // Should use Category in views (simplified property names)
      expect(baseContent).toContain('Category == "');

      // Should NOT contain HTML spans or old Type Badge property
      expect(baseContent).not.toContain("<span");
      expect(baseContent).not.toContain("task-type-badge");
      expect(baseContent).not.toContain("note.Type Badge");
    }
  );

  test(
    "should regenerate bases with correct syntax using command",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await waitForTaskSyncPlugin(context.page);

      // Create both area and project
      await createArea(context, {
        name: "Health & Fitness",
        description: "Health and fitness tracking area.",
      });

      await createProject(context, {
        name: "Marathon Training",
        areas: ["Health & Fitness"],
        description: "Marathon training project.",
      });

      // Configure settings via UI
      await toggleSetting(
        context,
        "Bases Integration",
        "Enable Area Bases",
        true
      );
      await toggleSetting(
        context,
        "Bases Integration",
        "Enable Project Bases",
        true
      );
      await toggleSetting(
        context,
        "Bases Integration",
        "Auto-Sync Area/Project Bases",
        true
      );

      // Use the refresh command
      await executeCommand(context, "Task Sync: Refresh");

      // Wait for bases regeneration to complete
      await waitForBasesRegeneration(context.page);

      // Check that both bases were created with correct syntax
      const areaBaseExists = await fileExists(
        context.page,
        "Bases/Health & Fitness.base"
      );
      expect(areaBaseExists).toBe(true);

      const projectBaseExists = await fileExists(
        context.page,
        "Bases/Marathon Training.base"
      );
      expect(projectBaseExists).toBe(true);

      // Check area base syntax
      const areaBaseContent = await getFileContent(
        context.page,
        "Bases/Health & Fitness.base"
      );
      expect(areaBaseContent).toContain(
        'Areas.contains(link("Health & Fitness"))'
      );

      // Check project base syntax
      const projectBaseContent = await getFileContent(
        context.page,
        "Bases/Marathon Training.base"
      );
      expect(projectBaseContent).toContain(
        'Project.contains(link("Marathon Training"))'
      );
    }
  );

  test(
    "should handle special characters in file names correctly",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await waitForTaskSyncPlugin(context.page);

      // Create files with special characters
      await createArea(context, {
        name: "R&D (Research)",
        description: "Research and development area.",
      });

      await createProject(context, {
        name: "API v2.0 Development",
        areas: ["R&D (Research)"],
        description: "API version 2.0 development project.",
      });

      // Configure settings via UI
      await toggleSetting(
        context,
        "Bases Integration",
        "Enable Area Bases",
        true
      );
      await toggleSetting(
        context,
        "Bases Integration",
        "Enable Project Bases",
        true
      );
      await toggleSetting(
        context,
        "Bases Integration",
        "Auto-Sync Area/Project Bases",
        true
      );

      // Trigger regeneration via command
      await executeCommand(context, "Task Sync: Refresh");

      // Wait for bases regeneration to complete
      await waitForBasesRegeneration(context.page);

      // Check that bases were created
      const areaBaseExists = await fileExists(
        context.page,
        "Bases/R&D (Research).base"
      );
      expect(areaBaseExists).toBe(true);

      const projectBaseExists = await fileExists(
        context.page,
        "Bases/API v2.0 Development.base"
      );
      expect(projectBaseExists).toBe(true);

      // Check that special characters are handled correctly in filters
      const areaBaseContent = await getFileContent(
        context.page,
        "Bases/R&D (Research).base"
      );
      expect(areaBaseContent).toContain(
        'Areas.contains(link("R&D (Research)"))'
      );

      const projectBaseContent = await getFileContent(
        context.page,
        "Bases/API v2.0 Development.base"
      );
      expect(projectBaseContent).toContain(
        'Project.contains(link("API v2.0 Development"))'
      );
    }
  );
});
