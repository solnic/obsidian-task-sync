/**
 * E2E tests for LocalTasksService component
 * Tests that local tasks from the vault are displayed and can be searched
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createTestFolders } from "../helpers/task-sync-setup";
import { toggleSidebar } from "../helpers/plugin-setup";
import { createTask } from "../helpers/entity-helpers";

describe("LocalTasksService", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await createTestFolders(context.page);
    await toggleSidebar(context.page, "right", true);
  });

  test("should display local tasks service tab", async () => {
    // Open Tasks view
    await openTasksView(context.page);

    // Check that local service tab is visible
    await context.page.waitForSelector('[data-testid="service-local"]', {
      state: "visible",
      timeout: 10000,
    });

    // Click on local service tab
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Verify local tasks service content is displayed
    await context.page.waitForSelector('[data-testid="local-tasks-service"]', {
      state: "visible",
      timeout: 10000,
    });
  });

  test("should display local tasks from vault", async () => {
    // Create some test tasks
    await createTask(context, {
      title: "Local Task 1",
      category: "Feature",
      priority: "High",
      status: "In Progress",
    });

    await createTask(context, {
      title: "Local Task 2",
      category: "Bug",
      priority: "Medium",
      status: "Backlog",
    });

    // Open Tasks view and switch to local service
    await openTasksView(context.page);
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid="local-task-item"]', {
      timeout: 10000,
    });

    // Verify tasks are displayed
    const taskItems = context.page.locator('[data-testid="local-task-item"]');
    const taskCount = await taskItems.count();
    expect(taskCount).toBeGreaterThanOrEqual(2);

    // Check task content
    const taskTexts = await taskItems.allTextContents();
    const allTaskText = taskTexts.join(" ");
    expect(allTaskText).toContain("Local Task 1");
    expect(allTaskText).toContain("Local Task 2");
  });

  test("should filter tasks with search functionality", async () => {
    // Create test tasks with different titles
    await createTask(context, {
      title: "Search Test Task",
      category: "Feature",
    });

    await createTask(context, {
      title: "Another Task",
      category: "Bug",
    });

    // Open Tasks view and switch to local service
    await openTasksView(context.page);
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid="local-task-item"]', {
      timeout: 10000,
    });

    // Use search input
    const searchInput = context.page.locator(
      '[data-testid="local-search-input"]'
    );
    await searchInput.fill("Search Test");

    // Wait for filtering to apply
    await context.page.waitForTimeout(500);

    // Verify only matching task is shown
    const visibleTasks = context.page.locator(
      '[data-testid="local-task-item"]:visible'
    );
    const visibleCount = await visibleTasks.count();
    expect(visibleCount).toBe(1);

    const visibleTaskText = await visibleTasks.first().textContent();
    expect(visibleTaskText).toContain("Search Test Task");
  });

  test("should show context indicator and detect daily note mode", async () => {
    // Create a test task
    await createTask(context, {
      title: "Context Test Task",
      category: "Feature",
    });

    // Open Tasks view and switch to local service
    await openTasksView(context.page);
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid="local-task-item"]', {
      timeout: 10000,
    });

    // Should show context indicator
    await context.page.waitForSelector(".context-indicator", {
      state: "visible",
      timeout: 5000,
    });

    // Should show project/area mode by default (not a daily note)
    const projectAreaBadge = context.page.locator(
      ".context-badge.project-area"
    );
    await context.page.waitForSelector(".context-badge.project-area", {
      state: "visible",
      timeout: 5000,
    });

    const badgeText = await projectAreaBadge.textContent();
    expect(badgeText).toContain("Project/Area Mode");

    // Initially should show "Open" button on hover (not in daily note mode)
    const taskItem = context.page
      .locator('[data-testid="local-task-item"]')
      .first();
    await taskItem.hover();

    await context.page.waitForSelector('[data-testid="open-task-button"]', {
      state: "visible",
      timeout: 5000,
    });
  });
});

/**
 * Helper function to open Tasks view
 */
async function openTasksView(page: any): Promise<void> {
  // First ensure the view exists
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app?.plugins?.plugins?.["obsidian-task-sync"];

    if (plugin) {
      const existingLeaves = app.workspace.getLeavesOfType("tasks");
      if (existingLeaves.length === 0) {
        const rightLeaf = app.workspace.getRightLeaf(false);
        await rightLeaf.setViewState({
          type: "tasks",
          active: false,
        });
      }
    }
  });

  // Click on the Tasks tab in the right sidebar
  const tasksTab = page.locator('.workspace-tab-header[aria-label="Tasks"]');

  if (await tasksTab.isVisible()) {
    await tasksTab.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  } else {
    // Alternative: use command palette
    await page.keyboard.press("Control+p");
    await page.fill(".prompt-input", "Tasks");
    await page.keyboard.press("Enter");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
