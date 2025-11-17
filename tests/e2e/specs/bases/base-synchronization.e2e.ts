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
  waitForSyncComplete,
  openFile,
} from "../../helpers/global";
import {
  createArea,
  createProject,
  createTask,
} from "../../helpers/entity-helpers";
import {
  regenerateBases,
  waitForBaseViewToLoad,
  switchBaseView,
  hasViewsDropdown,
  getBaseTaskTitles,
  expectBaseTasksContain,
  expectBaseTasksNotContain,
  openNoteWithBases,
  openBaseNoteStable,
} from "../../helpers/bases-helpers";

test.describe("Base Synchronization", { tag: '@bases' }, () => {
  test("should sync area bases when new task type is added", async ({
    page,
  }) => {
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
        const extension = plugin.host.getExtensionById("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaBases();
        }
      }
    });

    // Wait for base to be created
    await waitForBaseFile(page, "Bases/Technology.base");

    // Create some initial tasks (Bug and Feature)
    await createTask(page, {
      title: "Bug Task",
      category: "Bug",
      priority: "High",
      areas: ["Technology"],
      done: false,
    });

    await createTask(page, {
      title: "Feature Task",
      category: "Feature",
      priority: "Medium",
      areas: ["Technology"],
      done: false,
    });

    // Regenerate bases to include tasks
    await regenerateBases(page);

    // Open area file to verify initial state
    await openFile(page, "Areas/Technology.md");

    await waitForBaseViewToLoad(page, 5000);

    // Verify "All Epics" view is NOT available yet
    const allEpicsViewExists = await page.evaluate(() => {
      const viewsButton = document.querySelector(
        ".query-toolbar .mod-views .text-icon-button"
      ) as HTMLElement;
      if (!viewsButton) return false;
      viewsButton.click();
      const menuItems = Array.from(document.querySelectorAll(".menu-item"));
      const hasEpics = menuItems.some((item) =>
        item.textContent?.includes("All Epics")
      );
      // Close menu
      viewsButton.click();
      return hasEpics;
    });

    expect(allEpicsViewExists).toBe(false);

    // Add a new task type "Epic"
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.taskCategories.push({ name: "Epic", color: "orange" });
        await plugin.saveSettings();
        // Trigger sync
        const extension = plugin.host.getExtensionById("obsidian");
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

    // Create an Epic task
    await createTask(page, {
      title: "Epic Task",
      category: "Epic",
      priority: "Urgent",
      areas: ["Technology"],
      done: false,
    });

    // Regenerate bases to include new task
    await regenerateBases(page);

    // Re-open area file to see updated base
    await openFile(page, "Areas/Technology.md");
    await waitForBaseViewToLoad(page, 3000);

    // Verify "All Epics" view is now available and functional
    await switchBaseView(page, "All Epics");
    const epicTitles = await getBaseTaskTitles(page);

    // Should see the Epic task
    expect(epicTitles).toContain("Epic Task");
    // Should NOT see Bug or Feature tasks in Epic view
    expect(epicTitles).not.toContain("Bug Task");
    expect(epicTitles).not.toContain("Feature Task");
  });

  test("should sync project bases when task type is removed", async ({
    page,
  }) => {
    // Enable project bases
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
    });

    // Create a project
    await createProject(page, {
      name: "Documentation",
      description: "Documentation project",
    });

    // Wait for base to be created
    await waitForBaseFile(page, "Bases/Documentation.base");

    // Create tasks with different categories including Chore
    await createTask(page, {
      title: "Chore Task One",
      category: "Chore",
      priority: "Low",
      project: "Documentation",
      done: false,
    });

    await createTask(page, {
      title: "Bug Task One",
      category: "Bug",
      priority: "High",
      project: "Documentation",
      done: false,
    });

    await createTask(page, {
      title: "Feature Task One",
      category: "Feature",
      priority: "Medium",
      project: "Documentation",
      done: false,
    });

    // Regenerate bases to include tasks
    await regenerateBases(page);

    // Open project file to verify initial state
    await openFile(page, "Projects/Documentation.md");

    await waitForBaseViewToLoad(page, 5000);

    // Verify "All Chores" view is available and functional
    await switchBaseView(page, "All Chores");
    const choreTitles = await getBaseTaskTitles(page);
    expect(choreTitles).toContain("Chore Task One");

    // Remove "Chore" task type
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const choreIndex = plugin.settings.taskCategories.findIndex(
          (t: any) => t.name === "Chore"
        );
        if (choreIndex > -1) {
          plugin.settings.taskCategories.splice(choreIndex, 1);
        }
        await plugin.saveSettings();
        // Trigger sync
        const extension = plugin.host.getExtensionById("obsidian");
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
      { timeout: 2500 }
    );

    // Verify base file content confirms removal
    const baseContent = await readVaultFile(page, "Bases/Documentation.base");
    expect(baseContent).not.toContain("name: All Chores");
    expect(baseContent).not.toContain('note["Category"] == "Chore"');

    // Verify "All Bugs" view is still in the base
    expect(baseContent).toContain("name: All Bugs");
    expect(baseContent).toContain('note["Category"] == "Bug"');
  });

  test("should sync both area and project bases together", async ({ page }) => {
    // Enable both area and project bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
      projectBasesEnabled: true,
    });

    // Create an area
    await createArea(page, {
      name: "Work",
      description: "Work area",
    });

    // Create a project
    await createProject(page, {
      name: "API Development",
      description: "REST API project",
      areas: ["Work"],
    });

    // Generate both bases
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        const extension = plugin.host.getExtensionById("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaProjectBases();
        }
      }
    });

    // Wait for both bases to be created
    await waitForBaseFile(page, "Bases/Work.base");
    await waitForBaseFile(page, "Bases/API Development.base");

    // Create tasks for the area (not assigned to project)
    await createTask(page, {
      title: "Area Only Task",
      category: "Task",
      priority: "Medium",
      areas: ["Work"],
      done: false,
    });

    // Create tasks for the project (also in the area)
    await createTask(page, {
      title: "Project Task One",
      category: "Feature",
      priority: "High",
      project: "API Development",
      areas: ["Work"],
      done: false,
    });

    await createTask(page, {
      title: "Project Task Two",
      category: "Bug",
      priority: "Urgent",
      project: "API Development",
      areas: ["Work"],
      done: false,
    });

    // Regenerate bases to include tasks
    await regenerateBases(page);

    // Test Area base
    await openFile(page, "Areas/Work.md");
    await waitForBaseViewToLoad(page, 3000);

    // Area base should show all tasks in the area (both project and non-project)
    await expectBaseTasksContain(page, [
      "Area Only Task",
      "Project Task One",
      "Project Task Two",
    ]);

    // Test Project base
    await openFile(page, "Projects/API Development.md");
    await waitForBaseViewToLoad(page, 3000);

    // Project base should only show project tasks
    await expectBaseTasksContain(page, [
      "Project Task One",
      "Project Task Two",
    ]);
    await expectBaseTasksNotContain(page, ["Area Only Task"]);

    // Verify both bases have correct filtering across different views
    await openFile(page, "Projects/API Development.md");
    await waitForBaseViewToLoad(page, 3000);
    await switchBaseView(page, "All Features");
    const projectFeatures = await getBaseTaskTitles(page);
    expect(projectFeatures).toContain("Project Task One");
    expect(projectFeatures).not.toContain("Area Only Task");
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
        const extension = plugin.host.getExtensionById("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaProjectBases();
        }
      }
    });

    // Wait for sync to complete
    await waitForSyncComplete(page);

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
        const extension = plugin.host.getExtensionById("obsidian");
        if (extension) {
          const baseManager = extension.getBaseManager();
          await baseManager.syncAreaProjectBases();
        }
      }
    });

    // Wait for sync to complete
    await waitForSyncComplete(page);

    // Verify project base was NOT created
    const baseExists = await page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath("Bases/Mobile App.base");
      return file !== null;
    });

    expect(baseExists).toBe(false);
  });

  test("should maintain base structure integrity during sync", async ({
    page,
  }) => {
    // Enable project bases and auto-sync
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
      autoSyncAreaProjectBases: true,
    });

    // Create a project - this will automatically generate the base
    await createProject(page, {
      name: "Website",
      description: "Website project",
    });

    // Wait for base to be created
    await waitForBaseFile(page, "Bases/Website.base");

    // Create initial tasks with standard categories
    await createTask(page, {
      title: "Initial Bug",
      category: "Bug",
      priority: "High",
      project: "Website",
      done: false,
    });

    await createTask(page, {
      title: "Initial Feature",
      category: "Feature",
      priority: "Medium",
      project: "Website",
      done: false,
    });

    // Regenerate bases to include initial tasks
    await regenerateBases(page);

    // Open project file and verify initial views work
    await openFile(page, "Projects/Website.md");
    await waitForBaseViewToLoad(page, 3000);

    await switchBaseView(page, "All Bugs");
    let bugTitles = await getBaseTaskTitles(page);
    expect(bugTitles).toContain("Initial Bug");

    // Add multiple task types and manually trigger sync
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.taskCategories.push(
          { name: "Documentation", color: "yellow" },
          { name: "Review", color: "pink" }
        );
        await plugin.saveSettings();

        // Manually trigger sync to test the sync functionality
        const extension = plugin.host.getExtensionById("obsidian");
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

    // Create tasks with new categories
    await createTask(page, {
      title: "Documentation Task",
      category: "Documentation",
      priority: "Low",
      project: "Website",
      done: false,
    });

    await createTask(page, {
      title: "Review Task",
      category: "Review",
      priority: "High",
      project: "Website",
      done: false,
    });

    // Regenerate bases to include new tasks
    await regenerateBases(page);

    // Re-open project file to see updated base
    await openFile(page, "Projects/Website.md");
    await waitForBaseViewToLoad(page, 3000);

    // Verify old views still work correctly
    await switchBaseView(page, "All Bugs");
    bugTitles = await getBaseTaskTitles(page);
    expect(bugTitles).toContain("Initial Bug");
    expect(bugTitles).not.toContain("Documentation Task");
    expect(bugTitles).not.toContain("Review Task");

    // Verify new "All Documentations" view works
    await switchBaseView(page, "All Documentations");
    const docTitles = await getBaseTaskTitles(page);
    expect(docTitles).toContain("Documentation Task");
    expect(docTitles).not.toContain("Initial Bug");
    expect(docTitles).not.toContain("Review Task");

    // Verify new "All Reviews" view works
    await switchBaseView(page, "All Reviews");
    const reviewTitles = await getBaseTaskTitles(page);
    expect(reviewTitles).toContain("Review Task");
    expect(reviewTitles).not.toContain("Initial Bug");
    expect(reviewTitles).not.toContain("Documentation Task");

    // Verify main Tasks view shows all not-done tasks
    await switchBaseView(page, "Tasks");
    const allTitles = await getBaseTaskTitles(page);
    expect(allTitles).toContain("Initial Bug");
    expect(allTitles).toContain("Initial Feature");
    expect(allTitles).toContain("Documentation Task");
    expect(allTitles).toContain("Review Task");
  });
});
