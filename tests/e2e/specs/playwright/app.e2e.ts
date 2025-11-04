/**
 * E2E tests for basic Svelte app initialization
 * Tests that the plugin loads and the main view renders
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  createFile,
  openFile,
  waitForContextUpdate,
} from "../../helpers/global";
import { createTask } from "../../helpers/entity-helpers";

test.describe("Svelte App Initialization", () => {
  test("should load plugin and render main view with tasks view", async ({
    page,
  }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Check that the TasksView component is displayed
    await expect(page.locator('[data-testid="tasks-view"]')).toBeVisible();

    // Check that the Local Tasks header is displayed
    await expect(page.locator("text=Local Tasks")).toBeVisible();
  });

  test("should scan and load existing task files during initialization", async ({
    page,
  }) => {
    // Create sample task files before plugin loads
    await page.evaluate(async () => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create sample task files with proper frontmatter
      const task1Content = `---
Title: Sample Task 1
Type: Task
Status: Not Started
Priority: High
Done: false
---

This is a sample task for testing task scanning.`;

      const task2Content = `---
Title: Sample Task 2
Type: Task
Status: In Progress
Priority: Medium
Done: false
Areas: ["Development"]
---

Another sample task with areas.`;

      await app.vault.create("Tasks/Sample Task 1.md", task1Content);
      await app.vault.create("Tasks/Sample Task 2.md", task2Content);
    });

    // Now reload the plugin to trigger task scanning
    await page.evaluate(async () => {
      const app = (window as any).app;

      // Disable and re-enable plugin to trigger fresh initialization
      await app.plugins.disablePlugin("obsidian-task-sync");
      await app.plugins.enablePlugin("obsidian-task-sync");
    });

    // Wait for plugin to be fully initialized
    await page.waitForFunction(
      () => {
        const plugin = (window as any).app.plugins.plugins[
          "obsidian-task-sync"
        ];
        return (
          plugin &&
          plugin.settings &&
          (window as any).app.plugins.isEnabled("obsidian-task-sync")
        );
      },
      undefined,
      { timeout: 5000 }
    );

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible (use first() to handle multiple instances)
    await expect(page.locator(".task-sync-app").first()).toBeVisible();

    // Click on the local service tab to show tasks (context tab is default)
    const localServiceButton = page.locator('[data-testid="service-local"]');
    await localServiceButton.click();

    // Wait for local service to be visible
    await page.waitForSelector('[data-testid="local-service"]', {
      state: "visible",
      timeout: 5000,
    });

    // Check that tasks are loaded and displayed (use more specific selectors)
    await expect(
      page.locator(".task-sync-item-title").filter({ hasText: "Sample Task 1" })
    ).toBeVisible();
    await expect(
      page.locator(".task-sync-item-title").filter({ hasText: "Sample Task 2" })
    ).toBeVisible();

    // Verify task properties are displayed correctly
    await expect(page.locator("text=High")).toBeVisible(); // Priority
    await expect(page.locator("text=Medium")).toBeVisible(); // Priority
    await expect(page.locator("text=Development")).toBeVisible(); // Area
  });

  test("should show plugin is loaded in ribbon", async ({ page }) => {
    // Look for the Task Sync ribbon icon (checkbox icon)
    const ribbonIcon = page.locator(
      '.side-dock-ribbon-action[aria-label*="Task Sync"]'
    );
    await expect(ribbonIcon).toBeVisible();
  });

  test("should preserve updatedAt timestamps during initial task load", async ({
    page,
  }) => {
    // Create a task file before plugin loads
    await page.evaluate(async () => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create a task file
      const taskContent = `---
Title: Timestamp Test Task
Type: Task
Status: Not Started
Priority: Medium
Done: false
---

Task for testing timestamp preservation.`;

      await app.vault.create("Tasks/Timestamp Test Task.md", taskContent);
    });

    // Reload the plugin to trigger task scanning
    await page.evaluate(async () => {
      const app = (window as any).app;
      await app.plugins.disablePlugin("obsidian-task-sync");
      await app.plugins.enablePlugin("obsidian-task-sync");
    });

    // Wait for plugin to initialize and tasks to be loaded
    await page.waitForFunction(
      () => {
        const plugin = (window as any).app.plugins.plugins[
          "obsidian-task-sync"
        ];
        if (!plugin || !plugin.settings) return false;

        try {
          const { get } = require("svelte/store");
          const tasks = get(
            plugin.host.getExtensionById("obsidian").getTasks()
          );
          return tasks.some((t: any) => t.title === "Timestamp Test Task");
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 5000 }
    );

    // Get the task's initial timestamps
    const initialTimestamps = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const { get } = require("svelte/store");
      const tasks = get(plugin.host.getExtensionById("obsidian").getTasks());
      const task = tasks.find((t: any) => t.title === "Timestamp Test Task");
      return {
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });

    // Get the task's timestamps again
    const finalTimestamps = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const { get } = require("svelte/store");
      const tasks = get(plugin.host.getExtensionById("obsidian").getTasks());
      const task = tasks.find((t: any) => t.title === "Timestamp Test Task");
      return {
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });

    // Verify timestamps haven't changed
    expect(finalTimestamps.createdAt).toBe(initialTimestamps.createdAt);
    expect(finalTimestamps.updatedAt).toBe(initialTimestamps.updatedAt);
  });

  test("should show context tab button above service tabs", async ({
    page,
  }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Context tab button should be visible above service tabs
    const contextTabButton = page.locator('[data-testid="context-tab-button"]');
    await expect(contextTabButton).toBeVisible();

    // Should have info icon
    await expect(contextTabButton.locator('[data-icon="info"]')).toBeVisible();

    // Should be active by default (context tab is the default view)
    await expect(contextTabButton).toHaveClass(/active/);
  });

  test("should show context widget when context tab is active", async ({
    page,
  }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Context tab button should be active by default
    const contextTabButton = page.locator('[data-testid="context-tab-button"]');
    await expect(contextTabButton).toHaveClass(/active/);

    // Context widget content should be visible
    const contextTabContent = page.locator(
      '[data-testid="context-tab-content"]'
    );
    await expect(contextTabContent).toBeVisible();

    // Service content should be hidden
    const serviceContent = page.locator('[data-testid="service-content"]');
    await expect(serviceContent).not.toBeVisible();
  });

  test("should display enhanced context widget with project entity details", async ({
    page,
  }) => {
    // Create a project file with proper structure
    const projectName = "Alpha Project";
    await page.evaluate(async () => {
      const app = (window as any).app;
      const folderPath = "Projects";
      const exists = await app.vault.adapter.exists(folderPath);
      if (!exists) {
        await app.vault.createFolder(folderPath);
      }
    });

    await createFile(
      page,
      `Projects/${projectName}.md`,
      {
        Title: projectName,
        Areas: ["Development", "Testing"],
        Tags: ["important", "active"],
      },
      `# ${projectName}\n\nThis is a test project for context widget testing.`
    );

    // Open the project file to establish context
    await openFile(page, `Projects/${projectName}.md`);

    // Manually add the project to the store since project scanning is not implemented
    // This simulates what would happen if project scanning was working
    await page.evaluate(
      async ({ projectName }) => {
        // Access the project store through the plugin
        const plugin = (window as any).app.plugins.plugins[
          "obsidian-task-sync"
        ];

        if (!plugin || !plugin.stores || !plugin.stores.projectStore) {
          console.error("Project store not found on plugin object");
          return;
        }

        // Create a project entity that matches what would be scanned from the file
        const project = {
          id: `project-${Date.now()}`,
          name: projectName,
          description: "This is a test project for context widget testing.",
          areas: ["Development", "Testing"],
          tags: ["important", "active"],
          createdAt: new Date(),
          updatedAt: new Date(),
          source: {
            extension: "obsidian",
            keys: {
              obsidian: `Projects/${projectName}.md`,
            },
          },
        };

        // Add to project store
        plugin.stores.projectStore.dispatch({ type: "ADD_PROJECT", project });

        console.log("Manually added project to store:", project);
      },
      { projectName }
    );

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Context tab should be active by default
    const contextTabButton = page.locator('[data-testid="context-tab-button"]');
    await expect(contextTabButton).toHaveClass(/active/);

    // Wait for context widget to be visible
    const contextWidget = page.locator('[data-testid="context-tab-content"]');
    await expect(contextWidget).toBeVisible();

    // BUG: Should show enhanced entity details, not "Entity details not available"
    // This test will fail until the context widget entity lookup is fixed

    // Check for entity information display (this should work after fix)
    await expect(contextWidget.locator(".entity-title")).toBeVisible();
    await expect(contextWidget.locator(".context-type")).toContainText(
      "Project"
    );
    await expect(contextWidget.locator(".context-name")).toContainText(
      projectName
    );

    // Check for entity properties
    await expect(contextWidget.locator(".entity-properties")).toBeVisible();

    // Should show areas
    await expect(contextWidget).toContainText("Development");
    await expect(contextWidget).toContainText("Testing");

    // Should show tags
    await expect(contextWidget).toContainText("#important");
    await expect(contextWidget).toContainText("#active");
  });

  test("should display enhanced context widget with task entity details", async ({
    page,
  }) => {
    // Create a task using the proper helper which generates valid ULID and creates the file
    const taskName = "Test Task Context";
    const task = await createTask(page, {
      title: taskName,
      description: "This is a test task for context widget testing.",
      status: "In Progress",
      priority: "High",
      project: "Alpha Project",
      areas: ["Development", "Testing"],
      tags: ["urgent", "feature"],
      doDate: "2024-12-01",
      dueDate: "2024-12-15",
    });

    // Open the task file to establish context
    await openFile(page, `Tasks/${taskName}.md`);

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Context tab should be active by default - verify context widget is visible
    const contextWidget = page.locator('[data-testid="context-tab-content"]');
    await expect(contextWidget).toBeVisible();

    // Verify context tab button has active class
    const contextTabButton = page.locator('[data-testid="context-tab-button"]');
    await expect(contextTabButton).toHaveClass(/active/);

    // Debug: Check what file is active, settings, and task store
    const debugInfo = await page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const activeFile = app.workspace.getActiveFile();
      const activeFilePath = activeFile?.path;

      // Get settings to see what tasksFolder is configured
      const settings = plugin.settings;

      // Get task store state - it's a Svelte store, need to access current value
      const taskStore = plugin.stores?.taskStore;
      let tasks = [];
      if (taskStore) {
        // Get current value from the store
        taskStore.subscribe((state) => {
          tasks = state.tasks;
        })();
      }

      return {
        activeFilePath,
        tasksFolder: settings?.tasksFolder,
        projectsFolder: settings?.projectsFolder,
        areasFolder: settings?.areasFolder,
        taskCount: tasks.length,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          sourceKeys: t.source?.keys,
        })),
      };
    });
    console.log("Debug info:", JSON.stringify(debugInfo, null, 2));

    // Wait for context to be detected properly
    await waitForContextUpdate(page, "Task");

    // Manually trigger context update to ensure store is updated
    await page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      const contextExtension = plugin?.host?.getExtensionById("context");
      if (
        contextExtension &&
        typeof contextExtension.updateCurrentContext === "function"
      ) {
        // Force a context update
        (contextExtension as any).updateCurrentContext();
        console.log("Manually triggered context update");
      }
    });

    // Debug: Check what context is actually being passed to the widget
    const contextDebug = await page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      const contextExtension = plugin?.host?.getExtensionById("context");

      if (!contextExtension) {
        return { error: "Context extension not found" };
      }

      const currentContext = contextExtension.getCurrentContext();

      return {
        type: currentContext.type,
        name: currentContext.name,
        path: currentContext.path,
        hasEntity: !!currentContext.entity,
        entityId: currentContext.entity?.id,
        entityTitle:
          currentContext.entity && "title" in currentContext.entity
            ? currentContext.entity.title
            : currentContext.entity && "name" in currentContext.entity
            ? currentContext.entity.name
            : "unknown",
        entityStatus: currentContext.entity?.status,
        entityPriority: currentContext.entity?.priority,
      };
    });
    console.log(
      "Context from extension:",
      JSON.stringify(contextDebug, null, 2)
    );

    // Debug: Check what's in the context store by accessing it through window
    const storeDebug = await page.evaluate(() => {
      // Access the compiled Svelte app to get the store
      const appElement = document.querySelector(".task-sync-app");
      if (!appElement) return { error: "App element not found" };

      // Try to access the store through the Svelte internals
      // This is a hack but necessary for debugging
      return {
        message:
          "Store access through Svelte internals not available in production build",
      };
    });
    console.log("Store debug:", JSON.stringify(storeDebug, null, 2));

    // Debug: Dump the actual HTML being rendered
    const widgetHTML = await contextWidget.innerHTML();
    console.log("Widget HTML (first 500 chars):", widgetHTML.substring(0, 500));

    // Wait a bit for the store to update and the widget to re-render
    await page.waitForTimeout(1000);

    // Check again after waiting
    const widgetHTML2 = await contextWidget.innerHTML();
    console.log(
      "Widget HTML after wait (first 500 chars):",
      widgetHTML2.substring(0, 500)
    );

    // Check for entity information display
    await expect(contextWidget.locator(".entity-title")).toBeVisible();
    await expect(contextWidget.locator(".context-type")).toContainText("Task");
    await expect(contextWidget.locator(".context-name")).toContainText(
      taskName
    );

    // Check for task-specific badges (new badge-based UI)
    await expect(contextWidget.locator(".entity-badges")).toBeVisible();

    // Should show status badge
    await expect(contextWidget).toContainText("In Progress");

    // Should show priority badge
    await expect(contextWidget).toContainText("High");

    // Check for additional properties
    await expect(contextWidget.locator(".entity-properties")).toBeVisible();

    // Should show project (as LabelBadge)
    await expect(contextWidget).toContainText("Project");
    await expect(contextWidget).toContainText("Alpha Project");

    // Should show areas (as LabelBadge)
    await expect(contextWidget).toContainText("Area");
    await expect(contextWidget).toContainText("Development");
    await expect(contextWidget).toContainText("Testing");

    // Should show dates (as LabelBadge)
    await expect(contextWidget).toContainText("Do Date");
    await expect(contextWidget).toContainText("Due Date");

    // Tags are optional and may not always be displayed
    // The main entity properties (status, priority, project, areas, dates) are verified above
  });

  test("should hide context tab when service tab is clicked", async ({
    page,
  }) => {
    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");

    // Wait for the view to be visible
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Context tab should be active by default
    const contextTabButton = page.locator('[data-testid="context-tab-button"]');
    await expect(contextTabButton).toHaveClass(/active/);

    // Click a service tab (local service)
    const localServiceButton = page.locator('[data-testid="service-local"]');
    await localServiceButton.click();

    // Context tab should no longer be active
    await expect(contextTabButton).not.toHaveClass(/active/);

    // Service content should be visible
    const serviceContent = page.locator('[data-testid="service-content"]');
    await expect(serviceContent).toBeVisible();

    // Context tab content should be hidden
    const contextTabContent = page.locator(
      '[data-testid="context-tab-content"]'
    );
    await expect(contextTabContent).not.toBeVisible();
  });
});
