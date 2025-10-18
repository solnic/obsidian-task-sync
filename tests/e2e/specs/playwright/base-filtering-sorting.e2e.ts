/**
 * E2E tests for Base Filtering and Sorting functionality
 * Tests that bases have correct filters and sorting configurations
 */

import { test, expect } from "../../helpers/setup";
import {
  updatePluginSettings,
  waitForBaseFile,
  readVaultFile,
} from "../../helpers/global";
import {
  createArea,
  createProject,
  createTask,
} from "../../helpers/entity-helpers";

test.describe("Base Filtering and Sorting", () => {
  test("should filter out done tasks in all base views", async ({ page }) => {
    // Enable project bases and auto-sync
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
      autoSyncAreaProjectBases: true,
    });

    // Create a project - this will automatically generate the base
    await createProject(page, {
      name: "Testing Project",
      description: "Project for testing filters",
    });

    // Wait for base to be created automatically
    await waitForBaseFile(page, "Bases/Testing Project.base");

    // Read base content
    const baseContent = await readVaultFile(page, "Bases/Testing Project.base");
    expect(baseContent).toBeTruthy();

    // Count how many times the Done filter appears
    const doneFilterMatches = baseContent!.match(/note\["Done"\] == false/g);
    expect(doneFilterMatches).toBeTruthy();
    expect(doneFilterMatches!.length).toBeGreaterThan(0);

    // Verify it appears in the main Tasks view
    const mainTasksViewMatch = baseContent!.match(
      /name: Tasks[\s\S]*?filters:[\s\S]*?and:[\s\S]*?note\["Done"\] == false/
    );
    expect(mainTasksViewMatch).toBeTruthy();

    // Verify it appears in "All [Type]" views
    const allBugsViewMatch = baseContent!.match(
      /name: All Bugs[\s\S]*?filters:[\s\S]*?and:[\s\S]*?note\["Done"\] == false/
    );
    expect(allBugsViewMatch).toBeTruthy();

    // Verify it appears in priority-based views
    const priorityViewMatch = baseContent!.match(
      /name: Tasks • Low priority[\s\S]*?filters:[\s\S]*?and:[\s\S]*?note\["Done"\] == false/
    );
    expect(priorityViewMatch).toBeTruthy();
  });

  test("should filter out parent tasks in top-level views", async ({
    page,
  }) => {
    // Enable area bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
    });

    // Create an area
    await createArea(page, {
      name: "Development",
      description: "Development area",
    });

    // Generate area base
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
    await waitForBaseFile(page, "Bases/Development.base");

    // Read base content
    const baseContent = await readVaultFile(page, "Bases/Development.base");
    expect(baseContent).toBeTruthy();

    // Count how many times the Parent Task filter appears
    const parentTaskFilterMatches = baseContent!.match(
      /note\["Parent Task"\] == null/g
    );
    expect(parentTaskFilterMatches).toBeTruthy();
    expect(parentTaskFilterMatches!.length).toBeGreaterThan(0);

    // Verify it appears in the main Tasks view
    const mainTasksViewMatch = baseContent!.match(
      /name: Tasks[\s\S]*?filters:[\s\S]*?and:[\s\S]*?note\["Parent Task"\] == null/
    );
    expect(mainTasksViewMatch).toBeTruthy();

    // Verify it appears in "All [Type]" views
    const allFeaturesViewMatch = baseContent!.match(
      /name: All Features[\s\S]*?filters:[\s\S]*?and:[\s\S]*?note\["Parent Task"\] == null/
    );
    expect(allFeaturesViewMatch).toBeTruthy();

    // Verify it appears in priority-based views
    const priorityViewMatch = baseContent!.match(
      /name: Bugs • High priority[\s\S]*?filters:[\s\S]*?and:[\s\S]*?note\["Parent Task"\] == null/
    );
    expect(priorityViewMatch).toBeTruthy();
  });

  test("should have correct sorting configuration in all views", async ({
    page,
  }) => {
    // Enable project bases and auto-sync
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
      autoSyncAreaProjectBases: true,
    });

    // Create a project - this will automatically generate the base
    await createProject(page, {
      name: "Sorting Test",
      description: "Project for testing sorting",
    });

    // Wait for base to be created
    await waitForBaseFile(page, "Bases/Sorting Test.base");

    // Read base content
    const baseContent = await readVaultFile(page, "Bases/Sorting Test.base");
    expect(baseContent).toBeTruthy();

    // Verify sorting configuration exists with comprehensive default sort
    expect(baseContent).toContain("sort:");

    // Verify Done is sorted ascending (first sort field)
    const doneSortMatch = baseContent!.match(
      /property: Done[\s\S]*?direction: ASC/
    );
    expect(doneSortMatch).toBeTruthy();

    // Verify Category is sorted ascending
    const categorySortMatch = baseContent!.match(
      /property: Category[\s\S]*?direction: ASC/
    );
    expect(categorySortMatch).toBeTruthy();

    // Verify file.mtime (Updated At) is sorted descending
    const mtimeSortMatch = baseContent!.match(
      /property: file\.mtime[\s\S]*?direction: DESC/
    );
    expect(mtimeSortMatch).toBeTruthy();

    // Verify file.ctime (Created At) is sorted descending
    const ctimeSortMatch = baseContent!.match(
      /property: file\.ctime[\s\S]*?direction: DESC/
    );
    expect(ctimeSortMatch).toBeTruthy();

    // Verify formula.Title is sorted ascending (last sort field)
    const titleSortMatch = baseContent!.match(
      /property: formula\.Title[\s\S]*?direction: ASC/
    );
    expect(titleSortMatch).toBeTruthy();
  });

  test("should have project-specific filtering in project bases", async ({
    page,
  }) => {
    // Enable project bases and auto-sync
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
      autoSyncAreaProjectBases: true,
    });

    // Create a project with special characters in name
    // This will automatically generate the base due to autoSyncAreaProjectBases
    await createProject(page, {
      name: "Project & Test",
      description: "Project with special chars",
    });

    // Wait for base to be created automatically
    await waitForBaseFile(page, "Bases/Project & Test.base");

    // Read base content
    const baseContent = await readVaultFile(page, "Bases/Project & Test.base");
    expect(baseContent).toBeTruthy();

    // Verify project-specific filtering
    expect(baseContent).toContain('note["Project"] == "[[Project & Test]]"');

    // Verify it's combined with other filters
    const mainViewMatch = baseContent!.match(
      /name: Tasks[\s\S]*?filters:[\s\S]*?and:[\s\S]*?- file\.inFolder\("Tasks"\)[\s\S]*?- note\["Done"\] == false[\s\S]*?- note\["Project"\] == "\[\[Project & Test\]\]"[\s\S]*?- note\["Parent Task"\] == null/
    );
    expect(mainViewMatch).toBeTruthy();
  });

  test("should have area-specific filtering in area bases", async ({
    page,
  }) => {
    // Enable area bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
    });

    // Create an area
    await createArea(page, {
      name: "Personal Growth",
      description: "Personal development area",
    });

    // Generate area base
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
    await waitForBaseFile(page, "Bases/Personal Growth.base");

    // Read base content
    const baseContent = await readVaultFile(page, "Bases/Personal Growth.base");
    expect(baseContent).toBeTruthy();

    // Verify area-specific filtering
    expect(baseContent).toContain('note["Areas"].contains("Personal Growth")');

    // Verify it's combined with other filters
    const mainViewMatch = baseContent!.match(
      /name: Tasks[\s\S]*?filters:[\s\S]*?and:[\s\S]*?- file\.inFolder\("Tasks"\)[\s\S]*?- note\["Done"\] == false[\s\S]*?- note\["Areas"\]\.contains\("Personal Growth"\)[\s\S]*?- note\["Parent Task"\] == null/
    );
    expect(mainViewMatch).toBeTruthy();
  });

  test("should have category-specific filtering in type views", async ({
    page,
  }) => {
    // Enable project bases and auto-sync
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
      autoSyncAreaProjectBases: true,
    });

    // Create a project - this will automatically generate the base
    await createProject(page, {
      name: "Category Test",
      description: "Testing category filters",
    });

    // Wait for base to be created automatically
    await waitForBaseFile(page, "Bases/Category Test.base");

    // Read base content
    const baseContent = await readVaultFile(page, "Bases/Category Test.base");
    expect(baseContent).toBeTruthy();

    // Verify "All Bugs" view has Bug category filter
    const allBugsMatch = baseContent!.match(
      /name: All Bugs[\s\S]*?filters:[\s\S]*?and:[\s\S]*?- note\["Category"\] == "Bug"/
    );
    expect(allBugsMatch).toBeTruthy();

    // Verify "All Features" view has Feature category filter
    const allFeaturesMatch = baseContent!.match(
      /name: All Features[\s\S]*?filters:[\s\S]*?and:[\s\S]*?- note\["Category"\] == "Feature"/
    );
    expect(allFeaturesMatch).toBeTruthy();

    // Verify priority-based views have both category and priority filters
    const bugHighPriorityMatch = baseContent!.match(
      /name: Bugs • High priority[\s\S]*?filters:[\s\S]*?and:[\s\S]*?- note\["Category"\] == "Bug"[\s\S]*?- note\["Priority"\] == "High"/
    );
    expect(bugHighPriorityMatch).toBeTruthy();
  });

  test("should combine all filters correctly in priority views", async ({
    page,
  }) => {
    // Enable area bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
    });

    // Create an area
    await createArea(page, {
      name: "Work Projects",
      description: "Work-related projects",
    });

    // Generate area base
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
    await waitForBaseFile(page, "Bases/Work Projects.base");

    // Read base content
    const baseContent = await readVaultFile(page, "Bases/Work Projects.base");
    expect(baseContent).toBeTruthy();

    // Verify a priority view has all required filters:
    // 1. inFolder
    // 2. notDone
    // 3. inArea
    // 4. ofCategory
    // 5. withPriority
    // 6. noParentTask
    const featureUrgentMatch = baseContent!.match(
      /name: Features • Urgent priority[\s\S]*?filters:[\s\S]*?and:[\s\S]*?- file\.inFolder\("Tasks"\)[\s\S]*?- note\["Done"\] == false[\s\S]*?- note\["Areas"\]\.contains\("Work Projects"\)[\s\S]*?- note\["Category"\] == "Feature"[\s\S]*?- note\["Priority"\] == "Urgent"[\s\S]*?- note\["Parent Task"\] == null/
    );
    expect(featureUrgentMatch).toBeTruthy();
  });
});
