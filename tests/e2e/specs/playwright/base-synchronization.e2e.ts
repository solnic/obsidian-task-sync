/**
 * E2E tests for Base Synchronization functionality
 * Tests that bases are properly updated when settings change
 */

import { test, expect } from "../../helpers/setup";
import {
  updatePluginSettings,
  waitForBaseFile,
  waitForFileContentToContain,
  readVaultFile,
} from "../../helpers/global";
import { createArea, createProject } from "../../helpers/entity-helpers";

test.describe("Base Synchronization", () => {
  test("should sync area bases when new task type is added", async ({ page }) => {
    // Enable area bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
    });

    // Create an area
    await createArea(page, {
      name: "Technology",
      description: "Technology and development",
    });

    // Generate initial area base
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaBases();
        }
      }
    });

    // Wait for base to be created
    await waitForBaseFile(page, "Bases/Technology.base");

    // Verify initial content doesn't have "Epic" view
    let baseContent = await readVaultFile(page, "Bases/Technology.base");
    expect(baseContent).not.toContain("name: All Epics");

    // Add a new task type
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.taskTypes.push({ name: "Epic", color: "orange" });
        await plugin.saveSettings();
        // Trigger sync
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaBases();
        }
      }
    });

    // Wait for base to be updated with new task type
    await waitForFileContentToContain(
      page,
      "Bases/Technology.base",
      "name: All Epics"
    );

    // Verify base was updated
    baseContent = await readVaultFile(page, "Bases/Technology.base");
    expect(baseContent).toContain("name: All Epics");
    expect(baseContent).toContain('note["Category"] == "Epic"');
  });

  test("should sync project bases when task type is removed", async ({ page }) => {
    // Enable project bases
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
    });

    // Create a project
    await createProject(page, {
      name: "Documentation",
      description: "Documentation project",
    });

    // Generate initial project base
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncProjectBases();
        }
      }
    });

    // Wait for base to be created
    await waitForBaseFile(page, "Bases/Documentation.base");

    // Verify initial content has "Chores" view
    let baseContent = await readVaultFile(page, "Bases/Documentation.base");
    expect(baseContent).toContain("name: All Chores");
    expect(baseContent).toContain('note["Category"] == "Chore"');

    // Remove "Chore" task type
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const choreIndex = plugin.settings.taskTypes.findIndex(
          (t: any) => t.name === "Chore"
        );
        if (choreIndex > -1) {
          plugin.settings.taskTypes.splice(choreIndex, 1);
        }
        await plugin.saveSettings();
        // Trigger sync
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncProjectBases();
        }
      }
    });

    // Wait for base to be updated (Chores view removed)
    await page.waitForFunction(
      async ({ filePath }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file) return false;

        const content = await app.vault.read(file);
        return !content.includes("name: All Chores");
      },
      { filePath: "Bases/Documentation.base" },
      { timeout: 5000 }
    );

    // Verify base was updated
    baseContent = await readVaultFile(page, "Bases/Documentation.base");
    expect(baseContent).not.toContain("name: All Chores");
    expect(baseContent).not.toContain('note["Category"] == "Chore"');
  });

  test("should sync both area and project bases together", async ({ page }) => {
    // Enable both area and project bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
      projectBasesEnabled: true,
    });

    // Create an area and a project
    await createArea(page, {
      name: "Work",
      description: "Work area",
    });

    await createProject(page, {
      name: "API Development",
      description: "REST API project",
    });

    // Generate both bases
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaProjectBases();
        }
      }
    });

    // Wait for both bases to be created
    await waitForBaseFile(page, "Bases/Work.base");
    await waitForBaseFile(page, "Bases/API Development.base");

    // Verify both bases exist
    const workBaseContent = await readVaultFile(page, "Bases/Work.base");
    const apiBaseContent = await readVaultFile(page, "Bases/API Development.base");

    expect(workBaseContent).toBeTruthy();
    expect(apiBaseContent).toBeTruthy();

    // Verify area base has area-specific filtering
    expect(workBaseContent).toContain('note["Areas"].contains("Work")');

    // Verify project base has project-specific filtering
    expect(apiBaseContent).toContain('note["Project"] == "[[API Development]]"');
  });

  test("should respect areaBasesEnabled setting", async ({ page }) => {
    // Disable area bases
    await updatePluginSettings(page, {
      areaBasesEnabled: false,
      projectBasesEnabled: true,
    });

    // Create an area
    await createArea(page, {
      name: "Finance",
      description: "Finance area",
    });

    // Try to generate bases
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaProjectBases();
        }
      }
    });

    // Wait a bit to ensure no base is created
    await page.waitForTimeout(1000);

    // Verify area base was NOT created
    const baseExists = await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("Bases/Finance.base");
      return file !== null;
    });

    expect(baseExists).toBe(false);
  });

  test("should respect projectBasesEnabled setting", async ({ page }) => {
    // Disable project bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
      projectBasesEnabled: false,
    });

    // Create a project
    await createProject(page, {
      name: "Mobile App",
      description: "Mobile app project",
    });

    // Try to generate bases
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaProjectBases();
        }
      }
    });

    // Wait a bit to ensure no base is created
    await page.waitForTimeout(1000);

    // Verify project base was NOT created
    const baseExists = await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("Bases/Mobile App.base");
      return file !== null;
    });

    expect(baseExists).toBe(false);
  });

  test("should maintain base structure integrity during sync", async ({ page }) => {
    // Enable project bases
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
    });

    // Create a project
    await createProject(page, {
      name: "Website",
      description: "Website project",
    });

    // Generate initial base
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncProjectBases();
        }
      }
    });

    // Wait for base to be created
    await waitForBaseFile(page, "Bases/Website.base");

    // Verify initial structure
    let baseContent = await readVaultFile(page, "Bases/Website.base");
    expect(baseContent).toContain("properties:");
    expect(baseContent).toContain("views:");
    expect(baseContent).toContain("filters:");
    expect(baseContent).toContain("and:");

    // Add multiple task types
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.taskTypes.push(
          { name: "Documentation", color: "yellow" },
          { name: "Review", color: "pink" }
        );
        await plugin.saveSettings();
        const extension = plugin.extensionManager.getExtension("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncProjectBases();
        }
      }
    });

    // Wait for base to be updated
    await waitForFileContentToContain(
      page,
      "Bases/Website.base",
      "name: All Documentations"
    );

    // Verify structure is maintained
    baseContent = await readVaultFile(page, "Bases/Website.base");
    expect(baseContent).toContain("properties:");
    expect(baseContent).toContain("views:");
    expect(baseContent).toContain("filters:");
    expect(baseContent).toContain("and:");

    // Verify new views were added
    expect(baseContent).toContain("name: All Documentations");
    expect(baseContent).toContain("name: All Reviews");

    // Verify filtering is still correct
    expect(baseContent).toContain('note["Project"] == "[[Website]]"');
    expect(baseContent).toContain('note["Done"] == false');
  });
});

