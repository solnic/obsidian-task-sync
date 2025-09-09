/**
 * E2E tests for Context Tab View functionality
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import { setupE2ETestHooks, executeCommand } from "../helpers/shared-context";
import {
  createTestFolders,
  waitForTaskSyncPlugin,
  waitForElementVisible,
  isElementVisible,
  fileExists,
  getFileContent,
} from "../helpers/task-sync-setup";
import {
  createTask,
  createArea,
  createProject,
} from "../helpers/entity-helpers";

describe("Context Tab View", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
    await waitForTaskSyncPlugin(context.page);
  });

  beforeEach(async () => {
    // Open the context tab view before each test
    await executeCommand(context, "Task Sync: Open Context Tab");
    await waitForElementVisible(context.page, ".context-tab-view");
  });

  test("should display empty state when no file is open", async () => {
    // Make sure no file is active
    await context.page.evaluate(() => {
      const app = (window as any).app;
      app.workspace.activeLeaf?.detach();
    });

    // Wait for context to update
    await context.page.waitForTimeout(500);

    // Check empty state
    await waitForElementVisible(context.page, ".context-tab-empty");

    const emptyTitle = await context.page.textContent(".context-tab-empty h3");
    expect(emptyTitle).toBe("No Entity Selected");

    const emptyDescription = await context.page.textContent(
      ".context-tab-empty p"
    );
    expect(emptyDescription).toContain("Open a task, project, or area file");

    // Check that create task button is present
    await waitForElementVisible(
      context.page,
      ".context-tab-empty .task-sync-button"
    );
    const createTaskButtonText = await context.page.textContent(
      ".context-tab-empty .task-sync-button"
    );
    expect(createTaskButtonText).toBe("Create Task");
  });

  test("should display task properties when task file is open", async () => {
    // Create a test task
    const taskName = "Test Context Task";
    await createTask(context, {
      title: taskName,
      category: "Feature",
      priority: "High",
      status: "In Progress",
      project: "Test Project",
      areas: ["Development"],
    });

    // Open the task file
    await context.page.evaluate(
      async ({ name }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(`Tasks/${name}.md`);
        if (file) {
          await app.workspace.getLeaf().openFile(file);
        }
      },
      { name: taskName }
    );

    // Wait for context to update
    await context.page.waitForTimeout(1000);

    // Check that entity details are displayed
    await waitForElementVisible(context.page, ".context-tab-entity");

    // Check entity title
    const entityTitle = await context.page.textContent(".entity-title");
    expect(entityTitle).toBe(taskName);

    // Check entity type indicator
    const typeIndicator = await context.page.textContent(
      ".entity-type-indicator"
    );
    expect(typeIndicator).toBe("Task");

    // Check properties are displayed
    await waitForElementVisible(context.page, ".properties-list");

    // Check specific properties
    await waitForElementVisible(
      context.page,
      '[data-testid="property-Category"]'
    );
    await waitForElementVisible(
      context.page,
      '[data-testid="property-Priority"]'
    );
    await waitForElementVisible(
      context.page,
      '[data-testid="property-Status"]'
    );

    // Check that badges are rendered for category, priority, and status
    await waitForElementVisible(
      context.page,
      '[data-testid="property-Category"] .property-badge-container'
    );
    await waitForElementVisible(
      context.page,
      '[data-testid="property-Priority"] .property-badge-container'
    );
    await waitForElementVisible(
      context.page,
      '[data-testid="property-Status"] .property-badge-container'
    );
  });

  test("should display project properties when project file is open", async () => {
    // Create a test project
    const projectName = "Test Context Project";
    await createProject(context, {
      name: projectName,
      description: "Test project for context view",
      areas: ["Work", "Development"],
    });

    // Open the project file
    await context.page.evaluate(
      async ({ name }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(`Projects/${name}.md`);
        if (file) {
          await app.workspace.getLeaf().openFile(file);
        }
      },
      { name: projectName }
    );

    // Wait for context to update
    await context.page.waitForTimeout(1000);

    // Check that entity details are displayed
    await waitForElementVisible(context.page, ".context-tab-entity");

    // Check entity title
    const entityTitle = await context.page.textContent(".entity-title");
    expect(entityTitle).toBe(projectName);

    // Check entity type indicator
    const typeIndicator = await context.page.textContent(
      ".entity-type-indicator"
    );
    expect(typeIndicator).toBe("Project");

    // Check that areas are displayed as array items
    await waitForElementVisible(context.page, '[data-testid="property-Areas"]');

    const arrayItems = await context.page
      .locator('[data-testid="property-Areas"] .array-item')
      .count();
    expect(arrayItems).toBe(2);
  });

  test("should display area properties when area file is open", async () => {
    // Create a test area
    const areaName = "Test Context Area";
    await createArea(context, {
      name: areaName,
      description: "Test area for context view",
    });

    // Open the area file
    await context.page.evaluate(
      async ({ name }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(`Areas/${name}.md`);
        if (file) {
          await app.workspace.getLeaf().openFile(file);
        }
      },
      { name: areaName }
    );

    // Wait for context to update
    await context.page.waitForTimeout(1000);

    // Check that entity details are displayed
    await waitForElementVisible(context.page, ".context-tab-entity");

    // Check entity title
    const entityTitle = await context.page.textContent(".entity-title");
    expect(entityTitle).toBe(areaName);

    // Check entity type indicator
    const typeIndicator = await context.page.textContent(
      ".entity-type-indicator"
    );
    expect(typeIndicator).toBe("Area");
  });

  test("should display action buttons and handle clicks", async () => {
    // Create a test task
    const taskName = "Test Action Task";
    await createTask(context, {
      title: taskName,
      category: "Feature",
    });

    // Open the task file
    await context.page.evaluate(
      async ({ name }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(`Tasks/${name}.md`);
        if (file) {
          await app.workspace.getLeaf().openFile(file);
        }
      },
      { name: taskName }
    );

    // Wait for context to update
    await context.page.waitForTimeout(1000);

    // Check that actions section is displayed
    await waitForElementVisible(context.page, ".entity-actions");

    // Check that action buttons are present
    await waitForElementVisible(
      context.page,
      '[data-testid="edit-entity-button"]'
    );
    const editButtonText = await context.page.textContent(
      '[data-testid="edit-entity-button"]'
    );
    expect(editButtonText).toContain("Edit");

    await waitForElementVisible(
      context.page,
      '[data-testid="create-task-button"]'
    );
    const createTaskButtonText = await context.page.textContent(
      '[data-testid="create-task-button"]'
    );
    expect(createTaskButtonText).toContain("Create Task");

    await waitForElementVisible(
      context.page,
      '[data-testid="refresh-bases-button"]'
    );
    const refreshBasesButtonText = await context.page.textContent(
      '[data-testid="refresh-bases-button"]'
    );
    expect(refreshBasesButtonText).toContain("Refresh Bases");

    await waitForElementVisible(
      context.page,
      '[data-testid="delete-entity-button"]'
    );
    const deleteButtonText = await context.page.textContent(
      '[data-testid="delete-entity-button"]'
    );
    expect(deleteButtonText).toContain("Delete");

    // Test create task button click (should open task creation modal)
    await context.page.click('[data-testid="create-task-button"]');

    // Wait for task creation modal to appear
    await waitForElementVisible(context.page, ".task-sync-create-task", 3000);

    // Close the modal
    await context.page.keyboard.press("Escape");
    await context.page.waitForTimeout(500);
  });

  test("should update context when switching between files", async () => {
    // Create test entities
    const taskName = "Switch Test Task";
    const projectName = "Switch Test Project";

    await createTask(context, {
      title: taskName,
      category: "Feature",
    });

    await createProject(context, {
      name: projectName,
      description: "Test project for switching",
    });

    // Open task file first
    await context.page.evaluate(
      async ({ name }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(`Tasks/${name}.md`);
        if (file) {
          await app.workspace.getLeaf().openFile(file);
        }
      },
      { name: taskName }
    );

    await context.page.waitForTimeout(1000);

    // Check task context
    let entityTitle = await context.page.textContent(".entity-title");
    expect(entityTitle).toBe(taskName);

    let typeIndicator = await context.page.textContent(
      ".entity-type-indicator"
    );
    expect(typeIndicator).toBe("Task");

    // Switch to project file
    await context.page.evaluate(
      async ({ name }) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(`Projects/${name}.md`);
        if (file) {
          await app.workspace.getLeaf().openFile(file);
        }
      },
      { name: projectName }
    );

    await context.page.waitForTimeout(1000);

    // Check project context
    entityTitle = await context.page.textContent(".entity-title");
    expect(entityTitle).toBe(projectName);

    typeIndicator = await context.page.textContent(".entity-type-indicator");
    expect(typeIndicator).toBe("Project");
  });
});
