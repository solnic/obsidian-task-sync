import { test, expect, describe } from "vitest";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
} from "../helpers/task-sync-setup";
import {
  setupE2ETestHooks,
  openFile,
  waitForBaseView,
} from "../helpers/shared-context";
import { createTask, createArea } from "../helpers/entity-helpers";

describe("Bases Integration UI", () => {
  const context = setupE2ETestHooks();

  async function setupTest() {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);

    // Enable base generation for testing
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.autoGenerateBases = true;
        plugin.settings.autoUpdateBaseViews = true;
        plugin.settings.areaBasesEnabled = true;
        plugin.settings.projectBasesEnabled = true;
        plugin.settings.autoSyncAreaProjectBases = true;
        await plugin.saveSettings();
      }
    });
  }

  test("should display tasks correctly in area base UI", async () => {
    await setupTest();

    // Create an area using the helper (this will automatically create the base file)
    await createArea(context, {
      name: "Development",
      description: "This is the Development area.",
    });

    // Create tasks assigned to the area using the helpers
    await createTask(
      context,
      {
        title: "Fix Login Bug",
        category: "Bug",
        priority: "High",
        areas: ["Development"],
        status: "In Progress",
        tags: ["bug", "authentication"],
      },
      "Fix the login authentication issue.",
    );

    await createTask(
      context,
      {
        title: "Add User Dashboard",
        category: "Feature",
        priority: "Medium",
        areas: ["Development"],
        status: "Backlog",
        tags: ["feature", "ui"],
      },
      "Create a user dashboard with analytics.",
    );

    await createTask(
      context,
      {
        title: "Update Documentation",
        category: "Task",
        priority: "Low",
        areas: ["Development"],
        status: "Backlog",
        tags: ["documentation"],
      },
      "Update the project documentation.",
    );

    await openFile(context, "Areas/Development.md");
    await waitForBaseView(context);

    const allTaskTitles = await context.page
      .locator(".bases-view .bases-table-cell .internal-link")
      .allTextContents();
    const allTaskText = allTaskTitles.join(" ");

    expect(allTaskText).toContain("Fix Login Bug");
    expect(allTaskText).toContain("Add User Dashboard");
    expect(allTaskText).toContain("Update Documentation");
  });

  test("should display parent-child task relationships correctly in UI", async () => {
    await setupTest();

    // Create an area using the helper (this will automatically create the base file)
    await createArea(context, {
      name: "Development",
      description: "Development area for testing parent-child relationships.",
    });

    // Create a parent task using the helper (this will automatically create the parent task base)
    const epicTask = await createTask(
      context,
      {
        title: "Epic Feature Development",
        category: "Feature",
        priority: "High",
        areas: ["Development"],
        status: "In Progress",
        tags: ["epic", "feature"],
      },
      "{{tasks}}",
    );

    // Create child tasks that reference the parent task
    await createTask(
      context,
      {
        title: "Design UI Components",
        category: "Task",
        priority: "Medium",
        areas: ["Development"],
        status: "In Progress",
        parentTask: "Epic Feature Development",
        tags: ["design", "ui"],
      },
      "Design the UI components for the epic feature.",
    );

    await createTask(
      context,
      {
        title: "Implement Backend API",
        category: "Task",
        priority: "High",
        areas: ["Development"],
        status: "Backlog",
        parentTask: "Epic Feature Development",
        tags: ["backend", "api"],
      },
      "Implement the backend API for the epic feature.",
    );

    // Test 1: Open parent task and verify child tasks appear in its base
    await openFile(context, epicTask.filePath);
    await waitForBaseView(context);

    // Verify the parent task base shows child tasks
    const parentBaseView = context.page.locator(".bases-view");
    expect(await parentBaseView.isVisible()).toBe(true);

    // Check that child tasks appear in the parent task base view
    const childTaskTitles = await parentBaseView
      .locator(".bases-table-cell .internal-link")
      .allTextContents();
    const childTaskText = childTaskTitles.join(" ");
    expect(childTaskText).toContain("Design UI Components");
    expect(childTaskText).toContain("Implement Backend API");

    // Test 2: Open area and verify only parent task appears (child tasks filtered out)
    await openFile(context, "Areas/Development.md");
    await waitForBaseView(context);

    const areaBaseView = context.page.locator(".bases-view");
    expect(await areaBaseView.isVisible()).toBe(true);

    const areaTaskTitles = await areaBaseView
      .locator(".bases-table-cell .internal-link")
      .allTextContents();
    const areaTaskText = areaTaskTitles.join(" ");

    // Parent task should appear in area view
    expect(areaTaskText).toContain("Epic Feature Development");

    // Child tasks should be filtered out from area view
    expect(areaTaskText).not.toContain("Design UI Components");
    expect(areaTaskText).not.toContain("Implement Backend API");
  });

  test("should display project tasks correctly in project base UI", async () => {
    await setupTest();

    // Create a project with base embedding
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create(
        "Projects/Mobile App.md",
        `---
Name: Mobile App
Type: Project
Areas: ["[[Development]]"]
---

# Mobile App Project

Mobile application development project.

![[Bases/Mobile App.base]]
`,
      );
    });

    // Create tasks assigned to the project
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create(
        "Tasks/Mobile Login Screen.md",
        `---
Title: Mobile Login Screen
Type: Task
Category: Feature
Priority: High
Areas: ["[[Development]]"]
Project: "[[Mobile App]]"
Done: false
Status: In Progress
Parent task:
tags: [mobile, ui]
---

Create the login screen for mobile app.
`,
      );

      await app.vault.create(
        "Tasks/Mobile API Integration.md",
        `---
Title: Mobile API Integration
Type: Task
Category: Task
Priority: Medium
Areas: ["[[Development]]"]
Project: "[[Mobile App]]"
Done: true
Status: Done
Parent task:
tags: [mobile, api]
---

Integrate mobile app with backend API.
`,
      );

      await app.vault.create(
        "Tasks/Mobile Testing.md",
        `---
Title: Mobile Testing
Type: Task
Category: Bug
Priority: High
Areas: ["[[Development]]"]
Project: "[[Mobile App]]"
Done: false
Status: Backlog
Parent task:
tags: [mobile, testing]
---

Test the mobile application functionality.
`,
      );
    });

    // Regenerate bases to create the project base
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        await plugin.regenerateBases();
      }
    });

    // Open the project file
    await openFile(context, "Projects/Mobile App.md");

    // Wait for the base view to load
    await waitForBaseView(context);

    // Check that all project tasks appear in the base view
    const taskTitles = await context.page
      .locator(".bases-view .bases-table-cell .internal-link")
      .allTextContents();
    const taskTitleText = taskTitles.join(" ");
    expect(taskTitleText).toContain("Mobile Login Screen");
    expect(taskTitleText).toContain("Mobile API Integration");
    expect(taskTitleText).toContain("Mobile Testing");
  });

  test("should filter tasks correctly by task type in base UI views", async () => {
    await setupTest();

    // Create an area with base embedding
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create(
        "Areas/Development.md",
        `---
Name: Development
Type: Area
Areas: []
---

# Development Area

![[Bases/Development.base]]
`,
      );
    });

    // Create tasks of different types
    await context.page.evaluate(async () => {
      const app = (window as any).app;

      await app.vault.create(
        "Tasks/Critical Bug Fix.md",
        `---
Title: Critical Bug Fix
Type: Task
Category: Bug
Priority: Urgent
Areas: ["[[Development]]"]
Project:
Done: false
Status: In Progress
Parent task:
tags: [bug, critical]
---

Fix critical production bug.
`,
      );

      await app.vault.create(
        "Tasks/New Feature Request.md",
        `---
Title: New Feature Request
Type: Task
Category: Feature
Priority: Low
Areas: ["[[Development]]"]
Project:
Done: false
Status: Backlog
Parent task:
tags: [feature, enhancement]
---

Implement new feature based on user feedback.
`,
      );

      await app.vault.create(
        "Tasks/Code Refactoring.md",
        `---
Title: Code Refactoring
Type: Task
Category: Improvement
Priority: Medium
Areas: ["[[Development]]"]
Project:
Done: false
Status: Backlog
Parent task:
tags: [refactor, improvement]
---

Refactor legacy code for better maintainability.
`,
      );
    });

    // Regenerate bases to create the area base with type-specific views
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        await plugin.regenerateBases();
      }
    });

    await openFile(context, "Areas/Development.md");
    await waitForBaseView(context);

    // Verify the base view is visible
    const baseViewExists = await context.page
      .locator(".bases-view")
      .isVisible();
    expect(baseViewExists).toBe(true);

    // Test main Tasks view shows all tasks
    const allTaskTitles = await context.page
      .locator(".bases-view .bases-table-cell .internal-link")
      .allTextContents();
    const allTaskText = allTaskTitles.join(" ");
    expect(allTaskText).toContain("Critical Bug Fix");
    expect(allTaskText).toContain("New Feature Request");
    expect(allTaskText).toContain("Code Refactoring");

    // TODO: Add tests for switching between different views (All Bugs, All Features, etc.)
    // This would require understanding how to interact with base view tabs/filters
    // For now, we verify that all tasks appear in the main view
  });
});
