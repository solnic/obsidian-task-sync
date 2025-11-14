/**
 * E2E tests for Base Filtering and Sorting functionality
 * Tests that bases have correct filters and sorting configurations
 */

import { test, expect } from "../helpers/setup";
import {
  updatePluginSettings,
  waitForBaseFile,
  readVaultFile,
  openFile,
  waitForFileProcessed,
} from "../helpers/global";
import {
  createArea,
  createProject,
  createTask,
} from "../helpers/entity-helpers";
import {
  regenerateBases,
  waitForBaseViewToLoad,
  getBaseTaskTitles,
  switchBaseView,
  hasViewsDropdown,
  expectBaseTasksInOrder,
  expectBaseTasksContain,
  expectBaseTasksNotContain,
} from "../helpers/bases-helpers";

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

    // Create multiple tasks with different statuses and categories
    // Task 1: Not done, Bug category
    await createTask(page, {
      title: "Visible Not Done Bug",
      category: "Bug",
      priority: "High",
      status: "In Progress",
      project: "Testing Project",
      done: false,
    });

    // Task 2: Done, Bug category (should be filtered out)
    await createTask(page, {
      title: "Hidden Done Bug",
      category: "Bug",
      priority: "Medium",
      status: "Done",
      project: "Testing Project",
      done: true,
    });

    // Task 3: Not done, Feature category
    await createTask(page, {
      title: "Visible Not Done Feature",
      category: "Feature",
      priority: "High",
      status: "Backlog",
      project: "Testing Project",
      done: false,
    });

    // Task 4: Done, Feature category (should be filtered out)
    await createTask(page, {
      title: "Hidden Done Feature",
      category: "Feature",
      priority: "Low",
      status: "Done",
      project: "Testing Project",
      done: true,
    });

    // Task 5: Not done, Task category with Low priority
    await createTask(page, {
      title: "Visible Not Done Task Low Priority",
      category: "Task",
      priority: "Low",
      status: "Backlog",
      project: "Testing Project",
      done: false,
    });

    // Task 6: Done, Task category with Low priority (should be filtered out)
    await createTask(page, {
      title: "Hidden Done Task Low Priority",
      category: "Task",
      priority: "Low",
      status: "Done",
      project: "Testing Project",
      done: true,
    });

    // Wait for the last task to be processed
    await waitForFileProcessed(page, "Tasks/Hidden Done Task Low Priority.md");

    // Regenerate bases to ensure new tasks are included
    await regenerateBases(page);

    await waitForBaseFile(page, "Bases/Testing Project.base");

    // Open the project file which embeds the base
    await openFile(page, "Projects/Testing Project.md");

    // Wait for bases view to load with data
    await waitForBaseViewToLoad(page, 3000);

    // Test 1: Main "Tasks" view - should show only not-done tasks
    // (Already on Tasks view by default, no need to switch)

    // Should see all not-done tasks
    await expectBaseTasksContain(page, [
      "Visible Not Done Bug",
      "Visible Not Done Feature",
      "Visible Not Done Task Low Priority",
    ]);

    // Should NOT see done tasks
    await expectBaseTasksNotContain(page, [
      "Hidden Done Bug",
      "Hidden Done Feature",
      "Hidden Done Task Low Priority",
    ]);

    // Verify correct ordering - should be sorted by Title ascending
    // Expected order: alphabetically by title
    const expectedOrder = [
      "Visible Not Done Bug",
      "Visible Not Done Feature",
      "Visible Not Done Task Low Priority",
    ].sort();

    await expectBaseTasksInOrder(page, expectedOrder);

    // Test 2: "All Bugs" view - should show only not-done bugs
    await switchBaseView(page, "All Bugs");
    const allBugsTitles = await getBaseTaskTitles(page);

    expect(allBugsTitles).toContain("Visible Not Done Bug");

    expect(allBugsTitles).not.toContain("Hidden Done Bug");
    expect(allBugsTitles).not.toContain("Visible Not Done Feature");
    expect(allBugsTitles).not.toContain("Hidden Done Feature");
    expect(allBugsTitles).not.toContain("Visible Not Done Task Low Priority");

    // Test 3: "All Features" view - should show only not-done features
    await switchBaseView(page, "All Features");
    const allFeaturesTitles = await getBaseTaskTitles(page);

    expect(allFeaturesTitles).toContain("Visible Not Done Feature");
    expect(allFeaturesTitles).not.toContain("Hidden Done Feature");
    expect(allFeaturesTitles).not.toContain("Visible Not Done Bug");
    expect(allFeaturesTitles).not.toContain("Hidden Done Bug");
    expect(allFeaturesTitles).not.toContain(
      "Visible Not Done Task Low Priority"
    );

    // Test 4: Priority-based view - "Tasks • Low priority" - should show only not-done low priority tasks
    await switchBaseView(page, "Tasks • Low priority");
    const lowPriorityTitles = await getBaseTaskTitles(page);

    expect(lowPriorityTitles).toContain("Visible Not Done Task Low Priority");
    expect(lowPriorityTitles).not.toContain("Hidden Done Task Low Priority");
    expect(lowPriorityTitles).not.toContain("Visible Not Done Bug");
    expect(lowPriorityTitles).not.toContain("Visible Not Done Feature");
  });

  test("should filter out child tasks in top-level views", async ({ page }) => {
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

    // Create parent task (has no parent itself - this should be visible)
    await createTask(page, {
      title: "Parent Task Epic",
      category: "Feature",
      priority: "High",
      areas: ["Development"],
      done: false,
    });

    // Create a child task (has a parent - this should be filtered out)
    await createTask(page, {
      title: "Child Task Implementation",
      category: "Task",
      priority: "Medium",
      areas: ["Development"],
      parentTask: "Parent Task Epic",
      done: false,
    });

    // Create standalone task without parent (this should be visible)
    await createTask(page, {
      title: "Standalone Feature Task",
      category: "Feature",
      priority: "High",
      areas: ["Development"],
      done: false,
    });

    // Create another standalone task (this should be visible)
    await createTask(page, {
      title: "Standalone Bug Fix",
      category: "Bug",
      priority: "Urgent",
      areas: ["Development"],
      done: false,
    });

    // Wait for the last task to be processed
    await waitForFileProcessed(page, "Tasks/Standalone Bug Fix.md");

    // Regenerate bases to include new tasks
    await regenerateBases(page);

    // Open the area file which embeds the base
    await openFile(page, "Areas/Development.md");

    // Wait for bases view to load with data
    await waitForBaseViewToLoad(page, 3000);

    // Should see standalone tasks and parent task, but NOT child tasks
    await expectBaseTasksContain(page, [
      "Parent Task Epic",
      "Standalone Feature Task",
      "Standalone Bug Fix",
    ]);

    // Should NOT see the child task
    await expectBaseTasksNotContain(page, ["Child Task Implementation"]);

    // Test in "All Features" view - should still filter out child tasks
    await switchBaseView(page, "All Features");
    const featureTitles = await getBaseTaskTitles(page);

    // Should see both parent and standalone features
    expect(featureTitles).toContain("Standalone Feature Task");
    expect(featureTitles).toContain("Parent Task Epic");

    // Test in priority view - should still filter out child tasks
    await switchBaseView(page, "Features • High priority");
    const highPriorityTitles = await getBaseTaskTitles(page);

    // Should see both high priority features
    expect(highPriorityTitles).toContain("Standalone Feature Task");
    expect(highPriorityTitles).toContain("Parent Task Epic");
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

    // Create tasks with different properties to test sorting
    // All tasks have done=false to ensure they appear in the view

    // Bug tasks (Category: Bug - comes first alphabetically)
    await createTask(page, {
      title: "Zebra Bug",
      category: "Bug",
      priority: "High",
      project: "Sorting Test",
      done: false,
    });

    await createTask(page, {
      title: "Alpha Bug",
      category: "Bug",
      priority: "Medium",
      project: "Sorting Test",
      done: false,
    });

    // Feature tasks (Category: Feature - comes after Bug)
    await createTask(page, {
      title: "Zulu Feature",
      category: "Feature",
      priority: "Low",
      project: "Sorting Test",
      done: false,
    });

    await createTask(page, {
      title: "Bravo Feature",
      category: "Feature",
      priority: "High",
      project: "Sorting Test",
      done: false,
    });

    // Task category (Category: Task - comes after Feature)
    await createTask(page, {
      title: "Yankee Task",
      category: "Task",
      priority: "Medium",
      project: "Sorting Test",
      done: false,
    });

    await createTask(page, {
      title: "Charlie Task",
      category: "Task",
      priority: "Urgent",
      project: "Sorting Test",
      done: false,
    });

    // Wait for the last task to be processed
    await waitForFileProcessed(page, "Tasks/Charlie Task.md");

    // Regenerate bases to include new tasks
    await regenerateBases(page);

    // Open the project file which embeds the base
    await openFile(page, "Projects/Sorting Test.md");

    // Wait for bases view to load with data
    await waitForBaseViewToLoad(page, 3000);

    // Get all visible tasks
    const allTitles = await getBaseTaskTitles(page);

    // Verify we have all 6 tasks
    expect(allTitles.length).toBe(6);

    // Sorting should be:
    // 1. Done (ASC) - all false, so no effect
    // 2. Category (ASC) - Bug < Feature < Task
    // 3. file.mtime (DESC) - most recently modified first within same category
    // 4. file.ctime (DESC) - most recently created first
    // 5. Title (ASC) - alphabetically within same category

    // Since tasks are created in sequence and Category is the primary differentiator,
    // we should see tasks grouped by category with alphabetical sorting within each category

    // Get Bug tasks (should be first group)
    const bugTitles = allTitles.filter((t) => t.includes("Bug"));
    expect(bugTitles.length).toBe(2);

    // Get Feature tasks (should be second group)
    const featureTitles = allTitles.filter((t) => t.includes("Feature"));
    expect(featureTitles.length).toBe(2);

    // Get Task category tasks (should be third group)
    const taskTitles = allTitles.filter((t) => t.includes("Task"));
    expect(taskTitles.length).toBe(2);

    // Verify category grouping order by checking first task of each group
    const firstBugIndex = allTitles.findIndex((t) => t.includes("Bug"));
    const firstFeatureIndex = allTitles.findIndex((t) => t.includes("Feature"));
    const firstTaskIndex = allTitles.findIndex((t) => t.includes("Task"));

    expect(firstBugIndex).toBeLessThan(firstFeatureIndex);
    expect(firstFeatureIndex).toBeLessThan(firstTaskIndex);

    // Within each category, verify alphabetical sorting by title
    expect(bugTitles[0]).toBe("Alpha Bug");
    expect(bugTitles[1]).toBe("Zebra Bug");

    expect(featureTitles[0]).toBe("Bravo Feature");
    expect(featureTitles[1]).toBe("Zulu Feature");

    expect(taskTitles[0]).toBe("Charlie Task");
    expect(taskTitles[1]).toBe("Yankee Task");
  });

  test("should have project-specific filtering in project bases", async ({
    page,
  }) => {
    // Enable project bases and auto-sync
    await updatePluginSettings(page, {
      projectBasesEnabled: true,
      autoSyncAreaProjectBases: true,
    });

    // Create two projects
    await createProject(page, {
      name: "Project Alpha",
      description: "First project",
    });

    await createProject(page, {
      name: "Project Beta",
      description: "Second project",
    });

    // Wait for bases to be created automatically
    await waitForBaseFile(page, "Bases/Project Alpha.base");
    await waitForBaseFile(page, "Bases/Project Beta.base");

    // Create tasks for Project Alpha
    await createTask(page, {
      title: "Alpha Task One",
      category: "Feature",
      priority: "High",
      project: "Project Alpha",
      done: false,
    });

    await createTask(page, {
      title: "Alpha Task Two",
      category: "Bug",
      priority: "Medium",
      project: "Project Alpha",
      done: false,
    });

    // Create tasks for Project Beta
    await createTask(page, {
      title: "Beta Task One",
      category: "Feature",
      priority: "Low",
      project: "Project Beta",
      done: false,
    });

    await createTask(page, {
      title: "Beta Task Two",
      category: "Task",
      priority: "High",
      project: "Project Beta",
      done: false,
    });

    // Create a task with no project
    await createTask(page, {
      title: "Unassigned Task",
      category: "Task",
      priority: "Medium",
      done: false,
    });

    // Wait for the last task to be processed
    await waitForFileProcessed(page, "Tasks/Unassigned Task.md");

    // Regenerate bases to include new tasks
    await regenerateBases(page);

    // Test Project Alpha base
    await openFile(page, "Projects/Project Alpha.md");
    await waitForBaseViewToLoad(page, 3000);

    // Should only see Project Alpha tasks
    await expectBaseTasksContain(page, ["Alpha Task One", "Alpha Task Two"]);
    await expectBaseTasksNotContain(page, [
      "Beta Task One",
      "Beta Task Two",
      "Unassigned Task",
    ]);

    // Test Project Beta base
    await openFile(page, "Projects/Project Beta.md");
    await waitForBaseViewToLoad(page, 3000);

    // Should only see Project Beta tasks
    await expectBaseTasksContain(page, ["Beta Task One", "Beta Task Two"]);
    await expectBaseTasksNotContain(page, [
      "Alpha Task One",
      "Alpha Task Two",
      "Unassigned Task",
    ]);

    // Test filtering persists across view switches in Project Alpha
    await openFile(page, "Projects/Project Alpha.md");
    await waitForBaseViewToLoad(page, 3000);

    await switchBaseView(page, "All Features");
    const alphaFeatures = await getBaseTaskTitles(page);

    // Should only see Alpha features, not Beta features
    expect(alphaFeatures).toContain("Alpha Task One");
    expect(alphaFeatures).not.toContain("Beta Task One");
  });

  test("should have area-specific filtering in area bases", async ({
    page,
  }) => {
    // Enable area bases
    await updatePluginSettings(page, {
      areaBasesEnabled: true,
    });

    // Create first area
    await createArea(page, {
      name: "Personal Growth",
      description: "Personal development area",
    });

    // Generate base for first area
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

    // Wait for first base to be created
    await waitForBaseFile(page, "Bases/Personal Growth.base");

    // Create second area
    await createArea(page, {
      name: "Work Projects",
      description: "Work-related projects",
    });

    // Generate base for second area
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

    // Wait for second base to be created
    await waitForBaseFile(page, "Bases/Work Projects.base");

    // Create tasks for Personal Growth area
    await createTask(page, {
      title: "Personal Task One",
      category: "Task",
      priority: "Medium",
      areas: ["Personal Growth"],
      done: false,
    });

    await createTask(page, {
      title: "Personal Task Two",
      category: "Feature",
      priority: "Low",
      areas: ["Personal Growth"],
      done: false,
    });

    // Create tasks for Work Projects area
    await createTask(page, {
      title: "Work Task One",
      category: "Bug",
      priority: "High",
      areas: ["Work Projects"],
      done: false,
    });

    await createTask(page, {
      title: "Work Task Two",
      category: "Feature",
      priority: "Urgent",
      areas: ["Work Projects"],
      done: false,
    });

    // Create a task with multiple areas (should appear in both)
    await createTask(page, {
      title: "Shared Task",
      category: "Task",
      priority: "High",
      areas: ["Personal Growth", "Work Projects"],
      done: false,
    });

    // Create a task with no area
    await createTask(page, {
      title: "Unassigned Area Task",
      category: "Task",
      priority: "Low",
      done: false,
    });

    // Wait for the last task to be processed
    await waitForFileProcessed(page, "Tasks/Unassigned Area Task.md");

    // Regenerate bases to include new tasks
    await regenerateBases(page);

    // Test Personal Growth area base
    await openFile(page, "Areas/Personal Growth.md");
    await waitForBaseViewToLoad(page, 3000);

    // Should see Personal Growth tasks and shared task
    await expectBaseTasksContain(page, [
      "Personal Task One",
      "Personal Task Two",
      "Shared Task",
    ]);

    // Should NOT see Work-only tasks or unassigned tasks
    await expectBaseTasksNotContain(page, [
      "Work Task One",
      "Work Task Two",
      "Unassigned Area Task",
    ]);

    // Test Work Projects area base
    await openFile(page, "Areas/Work Projects.md");
    await waitForBaseViewToLoad(page, 3000);

    // Should see Work Projects tasks and shared task
    await expectBaseTasksContain(page, [
      "Work Task One",
      "Work Task Two",
      "Shared Task",
    ]);

    // Should NOT see Personal-only tasks or unassigned tasks
    await expectBaseTasksNotContain(page, [
      "Personal Task One",
      "Personal Task Two",
      "Unassigned Area Task",
    ]);

    // Test filtering persists across view switches
    await openFile(page, "Areas/Personal Growth.md");
    await waitForBaseViewToLoad(page, 3000);

    await switchBaseView(page, "All Features");
    const personalFeatures = await getBaseTaskTitles(page);

    // Should only see Personal Growth features, not Work features
    expect(personalFeatures).toContain("Personal Task Two");
    expect(personalFeatures).not.toContain("Work Task Two");
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

    // Create tasks with different categories
    await createTask(page, {
      title: "Bug Task Alpha",
      category: "Bug",
      priority: "High",
      project: "Category Test",
      done: false,
    });

    await createTask(page, {
      title: "Bug Task Beta",
      category: "Bug",
      priority: "Medium",
      project: "Category Test",
      done: false,
    });

    await createTask(page, {
      title: "Feature Task Alpha",
      category: "Feature",
      priority: "High",
      project: "Category Test",
      done: false,
    });

    await createTask(page, {
      title: "Feature Task Beta",
      category: "Feature",
      priority: "Low",
      project: "Category Test",
      done: false,
    });

    await createTask(page, {
      title: "General Task Alpha",
      category: "Task",
      priority: "Medium",
      project: "Category Test",
      done: false,
    });

    await createTask(page, {
      title: "General Task Beta",
      category: "Task",
      priority: "Low",
      project: "Category Test",
      done: false,
    });

    // Wait for the last task to be processed
    await waitForFileProcessed(page, "Tasks/General Task Beta.md");

    // Regenerate bases to include new tasks
    await regenerateBases(page);

    // Open the project file which embeds the base
    await openFile(page, "Projects/Category Test.md");
    await waitForBaseViewToLoad(page, 3000);

    // Test "All Bugs" view - should only show Bug tasks
    await switchBaseView(page, "All Bugs");
    const bugTitles = await getBaseTaskTitles(page);

    expect(bugTitles).toContain("Bug Task Alpha");
    expect(bugTitles).toContain("Bug Task Beta");
    expect(bugTitles).not.toContain("Feature Task Alpha");
    expect(bugTitles).not.toContain("Feature Task Beta");
    expect(bugTitles).not.toContain("General Task Alpha");
    expect(bugTitles).not.toContain("General Task Beta");

    // Test "All Features" view - should only show Feature tasks
    await switchBaseView(page, "All Features");
    const featureTitles = await getBaseTaskTitles(page);

    expect(featureTitles).toContain("Feature Task Alpha");
    expect(featureTitles).toContain("Feature Task Beta");
    expect(featureTitles).not.toContain("Bug Task Alpha");
    expect(featureTitles).not.toContain("Bug Task Beta");
    expect(featureTitles).not.toContain("General Task Alpha");
    expect(featureTitles).not.toContain("General Task Beta");

    // Test "All Tasks" view (Task category) - should only show Task category
    await switchBaseView(page, "All Tasks");
    const taskTitles = await getBaseTaskTitles(page);

    expect(taskTitles).toContain("General Task Alpha");
    expect(taskTitles).toContain("General Task Beta");
    expect(taskTitles).not.toContain("Bug Task Alpha");
    expect(taskTitles).not.toContain("Bug Task Beta");
    expect(taskTitles).not.toContain("Feature Task Alpha");
    expect(taskTitles).not.toContain("Feature Task Beta");

    // Test priority + category combination
    await switchBaseView(page, "Bugs • High priority");
    const bugHighPriorityTitles = await getBaseTaskTitles(page);

    expect(bugHighPriorityTitles).toContain("Bug Task Alpha");
    expect(bugHighPriorityTitles).not.toContain("Bug Task Beta"); // Medium priority
    expect(bugHighPriorityTitles).not.toContain("Feature Task Alpha"); // Different category
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

    // Create tasks that should appear (matches all filters)
    await createTask(page, {
      title: "Urgent Feature in Area",
      category: "Feature",
      priority: "Urgent",
      areas: ["Work Projects"],
      done: false,
    });

    // Create tasks that should NOT appear (various filter mismatches)

    // Wrong area
    await createTask(page, {
      title: "Urgent Feature Wrong Area",
      category: "Feature",
      priority: "Urgent",
      areas: ["Personal"],
      done: false,
    });

    // Wrong category
    await createTask(page, {
      title: "Urgent Bug in Area",
      category: "Bug",
      priority: "Urgent",
      areas: ["Work Projects"],
      done: false,
    });

    // Wrong priority
    await createTask(page, {
      title: "High Feature in Area",
      category: "Feature",
      priority: "High",
      areas: ["Work Projects"],
      done: false,
    });

    // Done status (should be filtered out)
    await createTask(page, {
      title: "Urgent Feature Done",
      category: "Feature",
      priority: "Urgent",
      areas: ["Work Projects"],
      done: true,
    });

    // Parent task (has no parent itself - should be visible)
    await createTask(page, {
      title: "Urgent Feature Parent",
      category: "Feature",
      priority: "Urgent",
      areas: ["Work Projects"],
      done: false,
    });

    // Child of parent task (has a parent - should be filtered out)
    await createTask(page, {
      title: "Urgent Feature Child",
      category: "Feature",
      priority: "Urgent",
      areas: ["Work Projects"],
      parentTask: "Urgent Feature Parent",
      done: false,
    });

    // Another matching task to verify multiple results
    await createTask(page, {
      title: "Another Urgent Feature",
      category: "Feature",
      priority: "Urgent",
      areas: ["Work Projects"],
      done: false,
    });

    // Wait for the last task to be processed
    await waitForFileProcessed(page, "Tasks/Another Urgent Feature.md");

    // Regenerate bases to include new tasks
    await regenerateBases(page);

    // Open the area file which embeds the base
    await openFile(page, "Areas/Work Projects.md");
    await waitForBaseViewToLoad(page, 3000);

    // Switch to the specific priority + category view
    await switchBaseView(page, "Features • Urgent priority");
    const urgentFeatureTitles = await getBaseTaskTitles(page);

    // Should ONLY see tasks that match ALL filters:
    // - In Work Projects area
    // - Category = Feature
    // - Priority = Urgent
    // - Done = false
    // - Has no parent task (top-level tasks only)
    expect(urgentFeatureTitles).toContain("Urgent Feature in Area");
    expect(urgentFeatureTitles).toContain("Another Urgent Feature");
    expect(urgentFeatureTitles).toContain("Urgent Feature Parent"); // Parent task is top-level

    // Should NOT see tasks that fail any filter
    expect(urgentFeatureTitles).not.toContain("Urgent Feature Wrong Area"); // Wrong area
    expect(urgentFeatureTitles).not.toContain("Urgent Bug in Area"); // Wrong category
    expect(urgentFeatureTitles).not.toContain("High Feature in Area"); // Wrong priority
    expect(urgentFeatureTitles).not.toContain("Urgent Feature Done"); // Done
    expect(urgentFeatureTitles).not.toContain("Urgent Feature Child"); // Child task (has parent)

    // Verify we got exactly the right number of tasks (3 matching tasks)
    expect(urgentFeatureTitles.length).toBe(3);

    // Test another priority view to ensure filters work across different views
    await switchBaseView(page, "Bugs • Urgent priority");
    const urgentBugTitles = await getBaseTaskTitles(page);

    // Should see the Urgent Bug (even though it's not in the Feature view)
    expect(urgentBugTitles).toContain("Urgent Bug in Area");
    expect(urgentBugTitles).not.toContain("Urgent Feature in Area"); // Different category
  });
});
