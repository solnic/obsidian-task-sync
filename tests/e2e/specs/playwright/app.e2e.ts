/**
 * E2E tests for basic Svelte app initialization
 * Tests that the plugin loads and the main view renders
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  openFile,
  waitForFileProcessed,
  waitForFileContentToContain,
  waitForFileCreation,
  reloadPlugin,
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
    // Sample task files already exist in the pristine vault
    // (Sample Task 1.md and Sample Task 2.md)
    // Just reload the plugin to trigger task scanning
    await reloadPlugin(page);

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
    const task1Item = page.getByTestId("local-task-item-sample-task-1");
    await expect(task1Item.getByText("High")).toBeVisible(); // Priority

    const task2Item = page.getByTestId("local-task-item-sample-task-2");
    await expect(task2Item.getByText("Medium")).toBeVisible(); // Priority
    await expect(task2Item.getByText("Development")).toBeVisible(); // Area
  });

  test("should scan and load existing project files during initialization", async ({
    page,
  }) => {
    // Sample project files already exist in the pristine vault
    // (Sample Project 1.md and Sample Project 2.md)
    // Just reload the plugin to trigger project scanning
    await reloadPlugin(page);

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
    // Sample area files already exist in the pristine vault
    // (Development.md and Personal.md)
    // Just reload the plugin to trigger area scanning
    await reloadPlugin(page);

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

  test("should preserve timestamps when rescanning existing tasks", async ({
    page,
  }) => {
    // Use pre-existing task from pristine vault to test timestamp preservation
    // Get the task's initial timestamps
    const initialTask = await getTaskByTitle(page, "Sample Task 1");
    const initialTimestamps = {
      createdAt: new Date(initialTask.createdAt),
      updatedAt: new Date(initialTask.updatedAt),
    };

    // Reload the plugin to trigger task scanning
    await reloadPlugin(page);

    // Get the task's timestamps again after reload
    const finalTask = await getTaskByTitle(page, "Sample Task 1");
    const finalTimestamps = {
      createdAt: new Date(finalTask.createdAt),
      updatedAt: new Date(finalTask.updatedAt),
    };

    // Verify timestamps haven't changed significantly during rescan
    // Timestamps should be based on file.stat.ctime and file.stat.mtime
    // Allow small differences (up to 2 seconds) due to file system timing precision
    // and potential file touches during plugin reload
    const createdAtDiff = Math.abs(
      finalTimestamps.createdAt.getTime() - initialTimestamps.createdAt.getTime()
    );
    const updatedAtDiff = Math.abs(
      finalTimestamps.updatedAt.getTime() - initialTimestamps.updatedAt.getTime()
    );

    expect(createdAtDiff).toBeLessThan(2000); // Within 2 seconds
    expect(updatedAtDiff).toBeLessThan(2000); // Within 2 seconds
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
    // Create a project using entity helper
    const projectName = "Alpha Project";
    await createProject(page, {
      name: projectName,
      description: "This is a test project for context widget testing.",
      areas: ["Development", "Testing"],
    });

    // Open the project file to establish context
    await openFile(page, `Projects/${projectName}.md`);

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
    await createTask(page, {
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
    // Wait for context widget to show task properties
    // The new Linear-style design shows property buttons instead of context type labels
    await page.waitForSelector('[data-testid="context-status-button"]', {
      state: "visible",
      timeout: 5000,
    });

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

  test("should deactivate service tab when context tab is clicked", async ({
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

    // Service tab should be active
    await expect(localServiceButton).toHaveClass(/active/);

    // Context tab should not be active
    await expect(contextTabButton).not.toHaveClass(/active/);

    // Now click the context tab button
    await contextTabButton.click();

    // Context tab should be active again
    await expect(contextTabButton).toHaveClass(/active/);

    // BUG: Service tab should no longer be active
    await expect(localServiceButton).not.toHaveClass(/active/);

    // Context tab content should be visible
    const contextTabContent = page.locator(
      '[data-testid="context-tab-content"]'
    );
    await expect(contextTabContent).toBeVisible();

    // Service content should be hidden
    const serviceContent = page.locator('[data-testid="service-content"]');
    await expect(serviceContent).not.toBeVisible();
  });

  test("should update task properties through context widget interactions", async ({
    page,
  }) => {
    // Use pre-existing areas (Development, Personal) and create a project for testing
    // Note: Test vault already has Development and Personal areas from pristine vault
    await createProject(page, {
      name: "Widget Test Project",
      description: "Project for testing context widget",
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

    // 5. Add Area "Development" (pre-existing area from pristine vault)
    const areasButton = contextWidget.locator(
      '[data-testid="context-areas-button"]'
    );
    await expect(areasButton).toContainText("Add to area");
    await areasButton.click();

    const areasDropdown = page.locator(
      '[data-testid="context-areas-dropdown"]'
    );
    await expect(areasDropdown).toBeVisible();

    // Click "Development" option to add it (pre-existing area)
    await areasDropdown.locator('text="Development"').click();

    // Dropdown stays open for multi-select - close it manually
    await page.keyboard.press("Escape");
    await expect(areasDropdown).not.toBeVisible();

    // Button should now show the area as a badge
    await expect(areasButton).toContainText("Development");

    // Wait for file to be updated with new area
    await waitForFileContentToContain(page, taskPath, "- Development");

    // Verify all changes were persisted to the task entity
    const updatedTask = await getTaskByTitle(page, taskName);

    expect(updatedTask.status).toBe("In Progress");
    expect(updatedTask.priority).toBe("High");
    expect(updatedTask.category).toBe("Bug");
    expect(updatedTask.project).toBe("Widget Test Project");
    expect(updatedTask.areas).toContain("Development");
  });

  test("should support multi-select areas with badges and remove buttons", async ({
    page,
  }) => {
    // Use pre-existing areas (Development, Personal) and create one additional area
    // Note: Test vault already has Development and Personal areas from pristine vault
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

    // Add first area (Development - pre-existing)
    await areasDropdown.locator('text="Development"').click();
    await expect(areasButton).toContainText("Development");

    // Dropdown should still be open (multi-select)
    await expect(areasDropdown).toBeVisible();

    // Add second area (Personal - pre-existing)
    await areasDropdown.locator('text="Personal"').click();
    await expect(areasButton).toContainText("Personal");

    // Dropdown should still be open
    await expect(areasDropdown).toBeVisible();

    // Add third area
    await areasDropdown.locator('text="Area Three"').click();
    await expect(areasButton).toContainText("Area Three");

    // Close dropdown
    await page.keyboard.press("Escape");
    await expect(areasDropdown).not.toBeVisible();

    // All three areas should be visible as badges
    await expect(areasButton).toContainText("Development");
    await expect(areasButton).toContainText("Personal");
    await expect(areasButton).toContainText("Area Three");

    // Wait for file to be updated
    await waitForFileContentToContain(page, taskPath, "- Development");
    await waitForFileContentToContain(page, taskPath, "- Personal");
    await waitForFileContentToContain(page, taskPath, "- Area Three");

    // Verify task has all three areas
    let task = await getTaskByTitle(page, taskName);
    expect(task.areas).toContain("Development");
    expect(task.areas).toContain("Personal");
    expect(task.areas).toContain("Area Three");
    expect(task.areas.length).toBe(3);

    // Now test removing an area using the × button
    // Find the badge for "Personal" and click its remove button
    const personalBadge = areasButton.locator(
      '.task-sync-text-badge:has-text("Personal")'
    );
    await expect(personalBadge).toBeVisible();

    // Click the × button within the badge
    const removeButton = personalBadge.locator("span").last();
    await removeButton.click();

    // Personal should be removed
    await expect(areasButton).not.toContainText("Personal");
    await expect(areasButton).toContainText("Development");
    await expect(areasButton).toContainText("Area Three");

    // Verify task no longer has Personal
    task = await getTaskByTitle(page, taskName);
    expect(task.areas).toContain("Development");
    expect(task.areas).not.toContain("Personal");
    expect(task.areas).toContain("Area Three");
    expect(task.areas.length).toBe(2);

    // Remove another area
    const developmentBadge = areasButton.locator(
      '.task-sync-text-badge:has-text("Development")'
    );
    const removeButtonDev = developmentBadge.locator("span").last();
    await removeButtonDev.click();

    // Only Area Three should remain
    await expect(areasButton).not.toContainText("Development");
    await expect(areasButton).not.toContainText("Personal");
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

    // Wait for file to be updated with do date
    await waitForFileContentToContain(
      page,
      taskPath,
      `Do Date: ${tomorrowStr}`
    );

    // Wait for task entity to be updated with the new do date
    await page.waitForFunction(
      ({ title, expectedDate }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const task = plugin.query.findTaskByTitle(title);
        if (!task || !task.doDate) return false;
        const doDateStr = new Date(task.doDate).toISOString().split("T")[0];
        return doDateStr === expectedDate;
      },
      { title: taskName, expectedDate: tomorrowStr },
      { timeout: 5000 }
    );

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

    // Wait for file to be updated with due date
    await waitForFileContentToContain(
      page,
      taskPath,
      `Due Date: ${threeDaysLaterStr}`
    );

    // Wait for task entity to be updated with the new due date
    await page.waitForFunction(
      ({ title, expectedDate }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const task = plugin.query.findTaskByTitle(title);
        if (!task || !task.dueDate) return false;
        const dueDateStr = new Date(task.dueDate).toISOString().split("T")[0];
        return dueDateStr === expectedDate;
      },
      { title: taskName, expectedDate: threeDaysLaterStr },
      { timeout: 5000 }
    );

    // Verify task has due date
    task = await getTaskByTitle(page, taskName);
    expect(task.dueDate).toBeDefined();
    if (task.dueDate) {
      const dueDateStr = new Date(task.dueDate).toISOString().split("T")[0];
      expect(dueDateStr).toBe(threeDaysLaterStr);
    }

    // Clear do date
    await doDateInput.fill("");
    await doDateInput.blur();

    // Wait for task entity to have do date cleared
    await page.waitForFunction(
      ({ title }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const task = plugin.query.findTaskByTitle(title);
        return task && task.doDate === undefined;
      },
      { title: taskName },
      { timeout: 5000 }
    );

    // Verify do date is cleared
    task = await getTaskByTitle(page, taskName);
    expect(task.doDate).toBeUndefined();

    // Clear due date
    await dueDateInput.fill("");
    await dueDateInput.blur();

    // Wait for task entity to have due date cleared
    await page.waitForFunction(
      ({ title }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const task = plugin.query.findTaskByTitle(title);
        return task && task.dueDate === undefined;
      },
      { title: taskName },
      { timeout: 5000 }
    );

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

  test("should allow typing in project dropdown search", async ({ page }) => {
    // Increase timeout for this test as it creates multiple entities
    test.setTimeout(30000);

    // Create multiple projects to make search useful
    await createProject(page, { name: "Alpha Project" });
    await createProject(page, { name: "Beta Project" });
    await createProject(page, { name: "Gamma Project" });
    await createProject(page, { name: "Delta Project" });
    await createProject(page, { name: "Echo Project" });

    // Wait for Obsidian to finish processing all project files
    // This prevents race conditions where Obsidian is still opening the last project
    // when we try to open the task file
    await page.waitForTimeout(500);

    // Create a task
    const taskName = "Search Test Task";
    const taskPath = `Tasks/${taskName}.md`;
    await createTask(page, {
      title: taskName,
      status: "Backlog",
    });

    // Wait for file creation and processing, then open it
    await waitForFileCreation(page, taskPath);
    await waitForFileProcessed(page, taskPath);
    await openFile(page, taskPath);

    // Open the Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");
    await expect(page.locator(".task-sync-app")).toBeVisible();

    const contextWidget = page.locator('[data-testid="context-tab-content"]');
    await expect(contextWidget).toBeVisible();

    // Open project dropdown
    const projectButton = contextWidget.locator(
      '[data-testid="context-project-button"]'
    );
    await projectButton.click();

    const projectDropdown = page.locator(
      '[data-testid="context-project-dropdown"]'
    );
    await expect(projectDropdown).toBeVisible();

    // Find the search input
    const searchInput = projectDropdown.locator(
      '[data-testid="context-project-dropdown-search"]'
    );
    await expect(searchInput).toBeVisible();

    // Verify Echo Project is visible
    const echoOption = projectDropdown.locator('text="Echo Project"');
    await expect(echoOption).toBeVisible();

    // Type in the search input
    await searchInput.fill("Alpha");

    // Verify the dropdown is still visible and functional
    await expect(projectDropdown).toBeVisible();

    // Verify filtered results show only "Alpha Project"
    const alphaOption = projectDropdown.locator('text="Alpha Project"');
    await expect(alphaOption).toBeVisible();

    // Verify other projects are not visible
    const betaOption = projectDropdown.locator('text="Beta Project"');
    await expect(betaOption).not.toBeVisible();

    // Type more to further test
    await searchInput.fill("Bet");

    // Verify Beta is now visible
    await expect(projectDropdown.locator('text="Beta Project"')).toBeVisible();

    // Verify Alpha is not visible
    await expect(alphaOption).not.toBeVisible();

    // Clear search
    await searchInput.fill("");

    // All projects should be visible again
    await expect(alphaOption).toBeVisible();
    await expect(betaOption).toBeVisible();
  });
});
