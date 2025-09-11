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

  test("should add task to today's daily note in day planning mode", async () => {
    // Create a test task directly using plugin API
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskData = {
        title: "Daily Planning Task",
        category: "Feature",
        priority: "High",
      };

      await plugin.createTask(taskData);
    });

    // Create a daily note to simulate day planning mode
    const today = new Date().toISOString().split("T")[0];
    const dailyNotePath = `Daily Notes/${today}.md`;

    await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const content = `# ${new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}\n\n## Notes\n\n## Tasks\n\n## Reflections\n`;

      // Ensure Daily Notes folder exists
      const folder = app.vault.getAbstractFileByPath("Daily Notes");
      if (!folder) {
        await app.vault.createFolder("Daily Notes");
      }

      // Create the daily note
      await app.vault.create(path, content);
    }, dailyNotePath);

    // Open the daily note to activate day planning mode
    await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    }, dailyNotePath);

    // Open Tasks view and switch to local service
    await openTasksView(context.page);
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid="local-task-item"]', {
      timeout: 10000,
    });

    // Wait for the context to update to daily note mode
    await context.page.waitForSelector(".context-badge.daily-note", {
      state: "visible",
      timeout: 5000,
    });

    // Verify we're in daily note mode
    const dailyNoteBadge = context.page.locator(".context-badge.daily-note");
    const badgeText = await dailyNoteBadge.textContent();
    expect(badgeText).toContain("Daily Note Mode");

    // Should now be in day planning mode - hover over task to see "Add to today" button
    const taskItem = context.page
      .locator('[data-testid="local-task-item"]')
      .first();
    await taskItem.hover();

    // Wait for "Add to today" button to appear
    await context.page.waitForSelector('[data-testid="add-to-today-button"]', {
      state: "visible",
      timeout: 5000,
    });

    // Click the "Add to today" button
    const addToTodayButton = context.page.locator(
      '[data-testid="add-to-today-button"]'
    );
    await addToTodayButton.click();

    // Verify the task was added to the daily note
    const dailyNoteContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        return await app.vault.read(file);
      }
      return "";
    }, dailyNotePath);

    expect(dailyNoteContent).toContain("- [ ] [[Daily Planning Task]]");
  });

  test("should load all tasks on first load even with slow metadata cache", async () => {
    // Create multiple tasks to test loading
    const taskTitles = [
      "Metadata Cache Test Task 1",
      "Metadata Cache Test Task 2",
      "Metadata Cache Test Task 3",
      "Metadata Cache Test Task 4",
      "Metadata Cache Test Task 5",
    ];

    // Create tasks using the helper
    for (const title of taskTitles) {
      await createTask(context, {
        title,
        category: "Feature",
        priority: "Medium",
        status: "Backlog",
      });
      // Add a small delay between task creation to avoid metadata cache race conditions
      await context.page.waitForTimeout(100);
    }

    // Wait for metadata cache to update for all files
    await context.page.waitForTimeout(2000);

    // Wait for all store refreshes to complete after task creation
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      await plugin.waitForStoreRefresh();
    });

    // Get task count after all refreshes are complete
    const finalTaskCount = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedTasks().length;
    });

    // Open Tasks view and switch to local service
    await openTasksView(context.page);
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for all 5 tasks to load
    await context.page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid="local-task-item"]'
        );
        return taskItems.length === 5;
      },
      { timeout: 10000 }
    );

    // Scroll to ensure all tasks are visible
    await context.page.evaluate(() => {
      const tasksContainer = document.querySelector(".tasks-list");
      if (tasksContainer) {
        tasksContainer.scrollTop = tasksContainer.scrollHeight;
      }
    });

    // Verify all tasks are loaded in the UI
    const taskItems = context.page.locator('[data-testid="local-task-item"]');
    const taskCount = await taskItems.count();

    // Should have exactly 5 tasks
    expect(taskCount).toBe(5);

    // Should match the cached task count (all tasks should be loaded)
    expect(taskCount).toBe(finalTaskCount);

    // Verify that we have the expected number of tasks
    expect(taskCount).toBe(5);
    expect(taskCount).toBe(finalTaskCount);

    // Verify all our test tasks are present with correct titles
    const taskTexts = await taskItems.allTextContents();
    const allTaskText = taskTexts.join(" ");

    for (const title of taskTitles) {
      expect(allTaskText).toContain(title);
    }
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
