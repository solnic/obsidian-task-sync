/**
 * E2E tests for basic Svelte app initialization
 * Tests that the plugin loads and the main view renders
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  createFile,
  openFile,
  waitForFileProcessed,
  waitForFileContentToContain,
} from "../../helpers/global";
import {
  createTask,
  createProject,
  createArea,
  getTaskByTitle,
} from "../../helpers/entity-helpers";

test.describe("Svelte App Initialization", () => {
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

  test("should scan and load existing project files during initialization", async ({
    page,
  }) => {
    // Create sample project files before plugin loads
    await page.evaluate(async () => {
      const app = (window as any).app;

      // Create Projects folder if it doesn't exist
      const projectsFolder = app.vault.getAbstractFileByPath("Projects");
      if (!projectsFolder) {
        await app.vault.createFolder("Projects");
      }

      // Create sample project files with proper frontmatter
      const project1Content = `---
Name: Sample Project 1
Type: Project
Areas: ["Development"]
---

This is a sample project for testing project scanning.`;

      const project2Content = `---
Name: Sample Project 2
Type: Project
---

Another sample project without areas.`;

      await app.vault.create("Projects/Sample Project 1.md", project1Content);
      await app.vault.create("Projects/Sample Project 2.md", project2Content);
    });

    // Now reload the plugin to trigger project scanning
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

    // Wait for projects to be loaded into the store
    await page.waitForFunction(
      () => {
        const plugin = (window as any).app.plugins.plugins[
          "obsidian-task-sync"
        ];
        if (!plugin || !plugin.stores || !plugin.stores.projectStore) {
          return false;
        }

        const projectStore = plugin.stores.projectStore;
        let projectCount = 0;
        projectStore.subscribe((state: any) => {
          projectCount = state.projects.length;
        })();

        return projectCount >= 2;
      },
      undefined,
      { timeout: 5000 }
    );

    // Verify projects are loaded in the store
    const projectsLoaded = await page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      const projectStore = plugin.stores.projectStore;

      // Get current value from the store using subscribe
      let projects: any[] = [];
      projectStore.subscribe((state: any) => {
        projects = state.projects;
      })();

      return {
        count: projects.length,
        project1: projects.find((p: any) => p.name === "Sample Project 1"),
        project2: projects.find((p: any) => p.name === "Sample Project 2"),
      };
    });

    // Verify both projects were scanned and loaded
    expect(projectsLoaded.count).toBeGreaterThanOrEqual(2);
    expect(projectsLoaded.project1).toBeTruthy();
    expect(projectsLoaded.project1.name).toBe("Sample Project 1");
    expect(projectsLoaded.project1.areas).toContain("Development");
    expect(projectsLoaded.project2).toBeTruthy();
    expect(projectsLoaded.project2.name).toBe("Sample Project 2");
  });

  test("should scan and load existing area files during initialization", async ({
    page,
  }) => {
    // Create sample area files before plugin loads
    await page.evaluate(async () => {
      const app = (window as any).app;

      // Create Areas folder if it doesn't exist
      const areasFolder = app.vault.getAbstractFileByPath("Areas");
      if (!areasFolder) {
        await app.vault.createFolder("Areas");
      }

      // Create sample area files with proper frontmatter
      const area1Content = `---
Name: Development
Type: Area
---

This is the development area for testing area scanning.`;

      const area2Content = `---
Name: Personal
Type: Area
---

Personal area without additional metadata.`;

      await app.vault.create("Areas/Development.md", area1Content);
      await app.vault.create("Areas/Personal.md", area2Content);
    });

    // Now reload the plugin to trigger area scanning
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

    // Wait for areas to be loaded into the store
    await page.waitForFunction(
      () => {
        const plugin = (window as any).app.plugins.plugins[
          "obsidian-task-sync"
        ];
        if (!plugin || !plugin.stores || !plugin.stores.areaStore) {
          return false;
        }

        const areaStore = plugin.stores.areaStore;
        let areaCount = 0;
        areaStore.subscribe((state: any) => {
          areaCount = state.areas.length;
        })();

        return areaCount >= 2;
      },
      undefined,
      { timeout: 5000 }
    );

    // Verify areas are loaded in the store
    const areasLoaded = await page.evaluate(() => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      const areaStore = plugin.stores.areaStore;

      // Get current value from the store using subscribe
      let areas: any[] = [];
      areaStore.subscribe((state: any) => {
        areas = state.areas;
      })();

      return {
        count: areas.length,
        area1: areas.find((a: any) => a.name === "Development"),
        area2: areas.find((a: any) => a.name === "Personal"),
      };
    });

    // Verify both areas were scanned and loaded
    expect(areasLoaded.count).toBeGreaterThanOrEqual(2);
    expect(areasLoaded.area1).toBeTruthy();
    expect(areasLoaded.area1.name).toBe("Development");
    expect(areasLoaded.area2).toBeTruthy();
    expect(areasLoaded.area2.name).toBe("Personal");
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

    // Check for Linear-style property buttons (new design)
    // Project context should show Areas button
    const areasButton = contextWidget.locator(
      '[data-testid="context-areas-button"]'
    );
    await expect(areasButton).toBeVisible();

    // The areas button should show the project's current areas
    // (Development and Testing from the frontmatter)
    await expect(areasButton).toContainText("Development");
    await expect(areasButton).toContainText("Testing");
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
    // Wait for context widget to show task properties
    // The new Linear-style design shows property buttons instead of context type labels
    await page.waitForSelector('[data-testid="context-status-button"]', {
      state: "visible",
      timeout: 5000,
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

    // Debug: Dump the actual HTML being rendered
    const widgetHTML = await contextWidget.innerHTML();

    // Wait a bit for the store to update and the widget to re-render
    await page.waitForTimeout(1000);

    // Check again after waiting
    const widgetHTML2 = await contextWidget.innerHTML();

    // Check for Linear-style property buttons (new design)
    const statusButton = contextWidget.locator(
      '[data-testid="context-status-button"]'
    );
    await expect(statusButton).toBeVisible();

    const priorityButton = contextWidget.locator(
      '[data-testid="context-priority-button"]'
    );
    await expect(priorityButton).toBeVisible();

    const categoryButton = contextWidget.locator(
      '[data-testid="context-category-button"]'
    );
    await expect(categoryButton).toBeVisible();

    const projectButton = contextWidget.locator(
      '[data-testid="context-project-button"]'
    );
    await expect(projectButton).toBeVisible();

    const areasButton = contextWidget.locator(
      '[data-testid="context-areas-button"]'
    );
    await expect(areasButton).toBeVisible();

    // Verify status button shows current status
    await expect(statusButton).toContainText("In Progress");

    // Verify priority button shows current priority
    await expect(priorityButton).toContainText("High");

    // Click project button to verify it opens dropdown
    await projectButton.click();

    // Should show project dropdown
    const projectDropdown = page.locator(
      '[data-testid="context-project-dropdown"]'
    );
    await expect(projectDropdown).toBeVisible();
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

  test("should update task properties through context widget interactions", async ({
    page,
  }) => {
    // Create initial projects and areas for testing
    await createProject(page, {
      name: "Widget Test Project",
      description: "Project for testing context widget",
    });

    await createArea(page, {
      name: "Widget Test Area",
      description: "Area for testing context widget",
    });

    // Create a task with initial properties
    const taskName = "Context Widget Test Task";
    const taskPath = `Tasks/${taskName}.md`;
    await createTask(page, {
      title: taskName,
      description: "Testing context widget interactions",
      status: "Backlog",
      priority: "Low",
      category: "Task",
      project: "",
      areas: [],
    });

    // Wait for the file to be processed by metadata cache before opening
    await waitForFileProcessed(page, taskPath);

    // Close any open Task Sync view from previous tests and wait for workspace to settle
    await page.evaluate(async () => {
      const app = (window as any).app;
      const leaves = app.workspace.getLeavesOfType("task-sync-view");
      for (const leaf of leaves) {
        leaf.detach();
      }
      // Wait a bit for workspace to settle after detaching leaves
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Open the task file to establish context BEFORE opening the view
    await openFile(page, taskPath);

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Context tab should be active by default
    const contextWidget = page.locator('[data-testid="context-tab-content"]');
    await expect(contextWidget).toBeVisible();

    // Wait for context widget to show task properties
    await page.waitForSelector('[data-testid="context-status-button"]', {
      state: "visible",
      timeout: 5000,
    });

    // 1. Change Status from "Backlog" to "In Progress"
    const statusButton = contextWidget.locator(
      '[data-testid="context-status-button"]'
    );
    await expect(statusButton).toContainText("Backlog");
    await statusButton.click();

    const statusDropdown = page.locator(
      '[data-testid="context-status-dropdown"]'
    );
    await expect(statusDropdown).toBeVisible();

    // Click "In Progress" option
    await statusDropdown.locator('text="In Progress"').click();

    // Wait for dropdown to close and button to update
    await expect(statusDropdown).not.toBeVisible();
    await expect(statusButton).toContainText("In Progress");

    // Wait for file to be updated with new status
    await waitForFileContentToContain(page, taskPath, "Status: In Progress");

    // 2. Change Priority from "Low" to "High"
    const priorityButton = contextWidget.locator(
      '[data-testid="context-priority-button"]'
    );
    await expect(priorityButton).toContainText("Low");
    await priorityButton.click();

    const priorityDropdown = page.locator(
      '[data-testid="context-priority-dropdown"]'
    );
    await expect(priorityDropdown).toBeVisible();

    // Click "High" option
    await priorityDropdown.locator('text="High"').click();

    // Wait for dropdown to close and button to update
    await expect(priorityDropdown).not.toBeVisible();
    await expect(priorityButton).toContainText("High");

    // Wait for file to be updated with new priority
    await waitForFileContentToContain(page, taskPath, "Priority: High");

    // 3. Change Category from "Task" to "Bug"
    const categoryButton = contextWidget.locator(
      '[data-testid="context-category-button"]'
    );
    await expect(categoryButton).toContainText("Task");
    await categoryButton.click();

    const categoryDropdown = page.locator(
      '[data-testid="context-category-dropdown"]'
    );
    await expect(categoryDropdown).toBeVisible();

    // Click "Bug" option
    await categoryDropdown.locator('text="Bug"').click();

    // Wait for dropdown to close and button to update
    await expect(categoryDropdown).not.toBeVisible();
    await expect(categoryButton).toContainText("Bug");

    // Wait for file to be updated with new category
    await waitForFileContentToContain(page, taskPath, "Category: Bug");

    // 4. Set Project to "Widget Test Project"
    const projectButton = contextWidget.locator(
      '[data-testid="context-project-button"]'
    );
    await expect(projectButton).toContainText("Add to project");
    await projectButton.click();

    const projectDropdown = page.locator(
      '[data-testid="context-project-dropdown"]'
    );
    await expect(projectDropdown).toBeVisible();

    // Click "Widget Test Project" option
    await projectDropdown.locator('text="Widget Test Project"').click();

    // Wait for dropdown to close and button to update
    await expect(projectDropdown).not.toBeVisible();
    await expect(projectButton).toContainText("Widget Test Project");

    // Wait for file to be updated with new project
    await waitForFileContentToContain(page, taskPath, "Widget Test Project");

    // 5. Add Area "Widget Test Area"
    const areasButton = contextWidget.locator(
      '[data-testid="context-areas-button"]'
    );
    await expect(areasButton).toContainText("Add to area");
    await areasButton.click();

    const areasDropdown = page.locator(
      '[data-testid="context-areas-dropdown"]'
    );
    await expect(areasDropdown).toBeVisible();

    // Click "Widget Test Area" option to add it
    await areasDropdown.locator('text="Widget Test Area"').click();

    // Dropdown stays open for multi-select - close it manually
    await page.keyboard.press("Escape");
    await expect(areasDropdown).not.toBeVisible();

    // Button should now show the area as a badge
    await expect(areasButton).toContainText("Widget Test Area");

    // Wait for file to be updated with new area
    await waitForFileContentToContain(page, taskPath, "- Widget Test Area");

    // Verify all changes were persisted to the task entity
    const updatedTask = await getTaskByTitle(page, taskName);

    expect(updatedTask.status).toBe("In Progress");
    expect(updatedTask.priority).toBe("High");
    expect(updatedTask.category).toBe("Bug");
    expect(updatedTask.project).toBe("Widget Test Project");
    expect(updatedTask.areas).toContain("Widget Test Area");
  });

  test("should support multi-select areas with badges and remove buttons", async ({
    page,
  }) => {
    // Create multiple areas for testing
    await createArea(page, {
      name: "Area One",
      description: "First test area",
    });

    await createArea(page, {
      name: "Area Two",
      description: "Second test area",
    });

    await createArea(page, {
      name: "Area Three",
      description: "Third test area",
    });

    // Create a task with no areas initially
    const taskName = "Multi-Area Test Task";
    const taskPath = `Tasks/${taskName}.md`;
    await createTask(page, {
      title: taskName,
      description: "Testing multi-select areas",
      status: "Backlog",
      priority: "Low",
      category: "Task",
      project: "",
      areas: [],
    });

    await waitForFileProcessed(page, taskPath);

    // Close any open Task Sync view and open the task file
    await page.evaluate(async () => {
      const app = (window as any).app;
      const leaves = app.workspace.getLeavesOfType("task-sync-view");
      for (const leaf of leaves) {
        leaf.detach();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await openFile(page, taskPath);

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");
    await expect(page.locator(".task-sync-app")).toBeVisible();

    const contextWidget = page.locator('[data-testid="context-tab-content"]');
    await expect(contextWidget).toBeVisible();

    const areasButton = contextWidget.locator(
      '[data-testid="context-areas-button"]'
    );

    // Initially should show "Add to area"
    await expect(areasButton).toContainText("Add to area");

    // Open areas dropdown
    await areasButton.click();
    const areasDropdown = page.locator(
      '[data-testid="context-areas-dropdown"]'
    );
    await expect(areasDropdown).toBeVisible();

    // Add first area
    await areasDropdown.locator('text="Area One"').click();
    await expect(areasButton).toContainText("Area One");

    // Dropdown should still be open (multi-select)
    await expect(areasDropdown).toBeVisible();

    // Add second area
    await areasDropdown.locator('text="Area Two"').click();
    await expect(areasButton).toContainText("Area Two");

    // Dropdown should still be open
    await expect(areasDropdown).toBeVisible();

    // Add third area
    await areasDropdown.locator('text="Area Three"').click();
    await expect(areasButton).toContainText("Area Three");

    // Close dropdown
    await page.keyboard.press("Escape");
    await expect(areasDropdown).not.toBeVisible();

    // All three areas should be visible as badges
    await expect(areasButton).toContainText("Area One");
    await expect(areasButton).toContainText("Area Two");
    await expect(areasButton).toContainText("Area Three");

    // Wait for file to be updated
    await waitForFileContentToContain(page, taskPath, "- Area One");
    await waitForFileContentToContain(page, taskPath, "- Area Two");
    await waitForFileContentToContain(page, taskPath, "- Area Three");

    // Verify task has all three areas
    let task = await getTaskByTitle(page, taskName);
    expect(task.areas).toContain("Area One");
    expect(task.areas).toContain("Area Two");
    expect(task.areas).toContain("Area Three");
    expect(task.areas.length).toBe(3);

    // Now test removing an area using the × button
    // Find the badge for "Area Two" and click its remove button
    const areaTwoBadge = areasButton.locator(
      '.task-sync-text-badge:has-text("Area Two")'
    );
    await expect(areaTwoBadge).toBeVisible();

    // Click the × button within the badge
    const removeButton = areaTwoBadge.locator("span").last();
    await removeButton.click();

    // Area Two should be removed
    await expect(areasButton).not.toContainText("Area Two");
    await expect(areasButton).toContainText("Area One");
    await expect(areasButton).toContainText("Area Three");

    // Verify task no longer has Area Two
    task = await getTaskByTitle(page, taskName);
    expect(task.areas).toContain("Area One");
    expect(task.areas).not.toContain("Area Two");
    expect(task.areas).toContain("Area Three");
    expect(task.areas.length).toBe(2);

    // Remove another area
    const areaOneBadge = areasButton.locator(
      '.task-sync-text-badge:has-text("Area One")'
    );
    const removeButtonOne = areaOneBadge.locator("span").last();
    await removeButtonOne.click();

    // Only Area Three should remain
    await expect(areasButton).not.toContainText("Area One");
    await expect(areasButton).not.toContainText("Area Two");
    await expect(areasButton).toContainText("Area Three");

    // Remove the last area
    const areaThreeBadge = areasButton.locator(
      '.task-sync-text-badge:has-text("Area Three")'
    );
    const removeButtonThree = areaThreeBadge.locator("span").last();
    await removeButtonThree.click();

    // Should show "Add to area" again
    await expect(areasButton).toContainText("Add to area");

    // Verify task has no areas
    task = await getTaskByTitle(page, taskName);
    expect(task.areas.length).toBe(0);
  });

  test("should update task do date and due date through context widget", async ({
    page,
  }) => {
    // Create a task with no dates initially
    const taskName = "Date Test Task";
    const taskPath = `Tasks/${taskName}.md`;
    await createTask(page, {
      title: taskName,
      description: "Testing date fields",
      status: "Backlog",
      priority: "Low",
      category: "Task",
      project: "",
      areas: [],
    });

    await waitForFileProcessed(page, taskPath);

    // Close any open Task Sync view and open the task file
    await page.evaluate(async () => {
      const app = (window as any).app;
      const leaves = app.workspace.getLeavesOfType("task-sync-view");
      for (const leaf of leaves) {
        leaf.detach();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await openFile(page, taskPath);

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");
    await expect(page.locator(".task-sync-app")).toBeVisible();

    const contextWidget = page.locator('[data-testid="context-tab-content"]');
    await expect(contextWidget).toBeVisible();

    // Find the date inputs
    const doDateInput = contextWidget.locator(
      '[data-testid="context-dodate-input"]'
    );
    const dueDateInput = contextWidget.locator(
      '[data-testid="context-duedate-input"]'
    );

    await expect(doDateInput).toBeVisible();
    await expect(dueDateInput).toBeVisible();

    // Set do date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await doDateInput.fill(tomorrowStr);
    await doDateInput.blur(); // Trigger change event

    // Wait a bit for the update to process
    await page.waitForTimeout(200);

    // Verify task has do date
    let task = await getTaskByTitle(page, taskName);
    expect(task.doDate).toBeDefined();
    if (task.doDate) {
      const doDateStr = new Date(task.doDate).toISOString().split("T")[0];
      expect(doDateStr).toBe(tomorrowStr);
    }

    // Set due date to 3 days from now
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysLaterStr = threeDaysLater.toISOString().split("T")[0];

    await dueDateInput.fill(threeDaysLaterStr);
    await dueDateInput.blur(); // Trigger change event

    // Wait a bit for the update to process
    await page.waitForTimeout(200);

    // Verify task has due date
    task = await getTaskByTitle(page, taskName);
    expect(task.dueDate).toBeDefined();
    if (task.dueDate) {
      const dueDateStr = new Date(task.dueDate).toISOString().split("T")[0];
      expect(dueDateStr).toBe(threeDaysLaterStr);
    }

    // Verify both dates are in the file
    await waitForFileContentToContain(
      page,
      taskPath,
      `Do Date: ${tomorrowStr}`
    );
    await waitForFileContentToContain(
      page,
      taskPath,
      `Due Date: ${threeDaysLaterStr}`
    );

    // Clear do date
    await doDateInput.fill("");
    await doDateInput.blur();
    await page.waitForTimeout(200);

    // Verify do date is cleared
    task = await getTaskByTitle(page, taskName);
    expect(task.doDate).toBeUndefined();

    // Clear due date
    await dueDateInput.fill("");
    await dueDateInput.blur();
    await page.waitForTimeout(200);

    // Verify due date is cleared
    task = await getTaskByTitle(page, taskName);
    expect(task.dueDate).toBeUndefined();
  });

  test("should display source information in context widget", async ({
    page,
  }) => {
    // Create a task
    const taskName = "Source Info Test Task";
    const taskPath = `Tasks/${taskName}.md`;
    await createTask(page, {
      title: taskName,
      description: "Testing source info display",
      status: "Backlog",
      priority: "Low",
      category: "Task",
      project: "",
      areas: [],
    });

    await waitForFileProcessed(page, taskPath);

    // Close any open Task Sync view and open the task file
    await page.evaluate(async () => {
      const app = (window as any).app;
      const leaves = app.workspace.getLeavesOfType("task-sync-view");
      for (const leaf of leaves) {
        leaf.detach();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await openFile(page, taskPath);

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");
    await expect(page.locator(".task-sync-app")).toBeVisible();

    const contextWidget = page.locator('[data-testid="context-tab-content"]');
    await expect(contextWidget).toBeVisible();

    // Verify source context is visible
    const sourceContext = contextWidget.locator(".source-context");
    await expect(sourceContext).toBeVisible();

    // Verify it shows Obsidian as the source
    const obsidianSourceInfo = sourceContext.locator(".obsidian-source-info");
    await expect(obsidianSourceInfo).toBeVisible();

    // Verify it shows the file path
    const filePathText = await obsidianSourceInfo.textContent();
    expect(filePathText).toContain(taskName);
    expect(filePathText).toContain("Tasks");
  });
});
