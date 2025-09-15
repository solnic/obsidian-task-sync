/**
 * E2E tests for LocalTasksService component
 * Tests that local tasks from the vault are displayed and can be searched
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import {
  createTestFolders,
  waitForAddToTodayOperation,
} from "../helpers/task-sync-setup";
import { toggleSidebar } from "../helpers/plugin-setup";
import { createTask } from "../helpers/entity-helpers";

describe("LocalTasksService", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
  });

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
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
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 10000,
    });

    // Verify tasks are displayed
    const taskItems = context.page.locator('[data-testid^="local-task-item-"]');
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
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
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
      '[data-testid^="local-task-item-"]:visible'
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

    // Open Tasks view and switch to GitHub service (which shows context widget)
    await openTasksView(context.page);
    const githubTab = context.page.locator('[data-testid="service-github"]');
    await githubTab.click();

    // Wait for GitHub service to load
    await context.page.waitForSelector('[data-testid="github-service"]', {
      timeout: 10000,
    });

    // Should show context widget in tasks view for GitHub service
    await context.page.waitForSelector(
      '[data-testid="tasks-view"] .context-widget',
      {
        state: "visible",
        timeout: 5000,
      }
    );

    // Should show context widget (not in daily note mode)
    const contextWidget = context.page.locator(
      '[data-testid="tasks-view"] .context-widget'
    );

    // Action labels are no longer displayed (replaced by icons)

    // Check no context message
    const noContext = await contextWidget.locator(".no-context").textContent();
    expect(noContext).toBe("No context");

    // Switch back to local service to test local task functionality
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 10000,
    });

    // Initially should show "Open" button on hover (not in daily note mode)
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
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

      // Delete existing daily note if it exists
      const existingFile = app.vault.getAbstractFileByPath(path);
      if (existingFile) {
        await app.vault.delete(existingFile);
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

    // Open Tasks view and switch to GitHub service to check context widget
    await openTasksView(context.page);
    const githubTab = context.page.locator('[data-testid="service-github"]');
    await githubTab.click();

    // Wait for GitHub service to load
    await context.page.waitForSelector('[data-testid="github-service"]', {
      timeout: 10000,
    });

    // Wait for the context to update to daily note mode
    await context.page.waitForSelector(
      '[data-testid="tasks-view"] .context-widget.context-type-daily',
      {
        state: "visible",
        timeout: 5000,
      }
    );

    // Verify we're in daily note mode
    const contextWidget = context.page.locator(
      '[data-testid="tasks-view"] .context-widget.context-type-daily'
    );

    // Check service name
    const serviceName = await contextWidget
      .locator(".service-name")
      .textContent();
    expect(serviceName).toBe("GitHub");

    // Action labels are no longer displayed (replaced by icons)

    // Switch to local service to test day planning functionality
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for tasks to load
    await context.page.waitForSelector(
      '[data-testid="local-task-item-daily-planning-task"]',
      {
        timeout: 10000,
      }
    );

    // Should now be in day planning mode - hover over the specific task to see "Add to today" button
    const taskItem = context.page.locator(
      '[data-testid="local-task-item-daily-planning-task"]'
    );
    await taskItem.hover();

    // Wait for "Add to today" button to appear
    await context.page.waitForSelector('[data-testid="add-to-today-button"]', {
      state: "visible",
      timeout: 5000,
    });

    // Wait a moment for the button to be fully interactive
    await context.page.waitForTimeout(200);

    // Click the "Add to today" button
    const addToTodayButton = context.page.locator(
      '[data-testid="add-to-today-button"]'
    );
    await addToTodayButton.click();

    // Wait for the add to today operation to complete
    await waitForAddToTodayOperation(
      context.page,
      dailyNotePath,
      "- [ ] [[Daily Planning Task]]",
      10000
    );

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

  test("should reflect front-matter property changes in Local Tasks view", async () => {
    // Create a test task
    const taskTitle = "Front-matter Update Test Task";
    await createTask(context, {
      title: taskTitle,
      priority: "Low",
      status: "Backlog",
    });

    // Open Tasks view and switch to local service
    await openTasksView(context.page);
    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for the task to appear in the view
    const taskTestId = `local-task-item-${taskTitle
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
    await context.page.waitForSelector(`[data-testid="${taskTestId}"]`, {
      timeout: 10000,
    });

    // Verify initial state - should show "Low" priority
    const taskItem = context.page.locator(`[data-testid="${taskTestId}"]`);
    const initialContent = await taskItem.textContent();
    expect(initialContent).toContain("Low");

    // Update the task's front-matter directly
    await context.page.evaluate(async (title) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`Tasks/${title}.md`);

      if (file) {
        await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
          frontmatter.Priority = "High";
          frontmatter.Status = "In Progress";
        });
      }
    }, taskTitle);

    // Wait for the change to be processed and reflected in the UI
    // The system should automatically refresh when front-matter changes
    await context.page.waitForFunction(
      (testId) => {
        const element = document.querySelector(`[data-testid="${testId}"]`);
        return (
          element && element.textContent && element.textContent.includes("High")
        );
      },
      taskTestId,
      { timeout: 10000 }
    );

    // Verify the priority has been updated in the UI
    const updatedContent = await taskItem.textContent();
    expect(updatedContent).toContain("High");
    expect(updatedContent).toContain("In Progress");
  });

  test("should refresh stores and load all existing tasks on plugin initialization", async () => {
    // Create tasks directly in the vault (simulating existing files)
    const taskTitles = [
      "Store Refresh Test Task 1",
      "Store Refresh Test Task 2",
      "Store Refresh Test Task 3",
    ];

    // Create tasks directly using vault API (bypassing plugin)
    for (const title of taskTitles) {
      await context.page.evaluate(async (taskTitle) => {
        const app = (window as any).app;
        const content = `---
Title: ${taskTitle}
Type: Task
Category: Feature
Priority: Medium
Status: Backlog
Done: false
---

This is a test task created directly in the vault.`;
        await app.vault.create(`Tasks/${taskTitle}.md`, content);
      }, title);
    }

    // Wait for files to be created
    await context.page.waitForTimeout(1000);

    // Simulate plugin restart by disabling and re-enabling
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const pluginManager = app.plugins;

      // Disable plugin
      await pluginManager.disablePlugin("obsidian-task-sync");

      // Re-enable plugin (this should trigger store refresh)
      await pluginManager.enablePlugin("obsidian-task-sync");
    });

    // Wait for plugin to fully initialize
    await context.page.waitForTimeout(3000);

    // Wait for all store refreshes to complete after plugin restart
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      await plugin.waitForStoreRefresh();
    });

    // Get task count after plugin restart
    const finalTaskCount = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedTasks().length;
    });

    // Should have loaded all tasks including the 3 new ones (plus any existing from previous tests)
    expect(finalTaskCount).toBeGreaterThanOrEqual(3);

    // Ensure right sidebar is open and Tasks view is accessible
    await toggleSidebar(context.page, "right", true);
    await context.page.waitForTimeout(1000);

    // Open Tasks view and verify tasks are displayed
    await openTasksView(context.page);

    // Wait for Tasks view to be fully loaded
    await context.page.waitForSelector('[data-testid="service-local"]', {
      state: "visible",
      timeout: 10000,
    });

    const localTab = context.page.locator('[data-testid="service-local"]');
    await localTab.click();

    // Wait for tasks to appear in UI
    await context.page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length >= 3;
      },
      { timeout: 10000 }
    );

    // Verify all tasks are displayed in the UI
    const taskItems = context.page.locator('[data-testid^="local-task-item-"]');
    const taskCount = await taskItems.count();

    expect(taskCount).toBeGreaterThanOrEqual(3);

    // Verify our test tasks are present
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
