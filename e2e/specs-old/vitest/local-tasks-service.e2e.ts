/**
 * E2E tests for LocalTasksService component
 * Tests that local tasks from the vault are displayed and can be searched
 */

import { test, expect, describe, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import {
  waitForAddToTodayOperation,
  enableIntegration,
  openView,
  switchToTaskService,
  toggleSidebar,
  getTaskByTitle,
} from "../../helpers/global";
import { createTask, updateEntity } from "../../helpers/entity-helpers";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";

describe("LocalTasksService", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test("should display local tasks from vault", async () => {
    // Create some test tasks
    await createTask(context.page, {
      title: "Local Task 1",
      category: "Feature",
      priority: "High",
      status: "In Progress",
    });

    await createTask(context.page, {
      title: "Local Task 2",
      category: "Bug",
      priority: "Medium",
      status: "Backlog",
    });

    // Open Tasks view and switch to local service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
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
    await createTask(context.page, {
      title: "Search Test Task",
      category: "Feature",
    });

    await createTask(context.page, {
      title: "Another Task",
      category: "Bug",
    });

    // Open Tasks view and switch to local service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
    });

    // Use search input
    const searchInput = context.page.locator(
      '[data-testid="local-search-input"]'
    );
    await searchInput.fill("Search Test");

    // Wait for filtering to apply using smart waiting
    await context.page.waitForFunction(
      () => {
        const allTasks = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        const visibleTasks = Array.from(allTasks).filter(
          (task) => (task as HTMLElement).offsetParent !== null
        );
        return visibleTasks.length === 1;
      },
      { timeout: 5000 }
    );

    // Verify only matching task is shown
    const allTasks = context.page.locator('[data-testid^="local-task-item-"]');
    const visibleTasks = allTasks.filter({ hasText: "Search Test Task" });
    const visibleCount = await visibleTasks.count();
    expect(visibleCount).toBe(1);

    const visibleTaskText = await visibleTasks.first().textContent();
    expect(visibleTaskText).toContain("Search Test Task");
  });

  test("should show context indicator and detect daily note mode", async () => {
    // Create a test task
    await createTask(context.page, {
      title: "Context Test Task",
      category: "Feature",
    });

    // Enable GitHub integration first
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    // Stub GitHub APIs
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Open Tasks view and switch to GitHub service (which shows context widget)
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

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

    // Check no context message
    const noContext = await contextWidget.locator(".no-context").textContent();
    expect(noContext).toBe("No context");

    // Switch back to local service to test local task functionality
    await switchToTaskService(context.page, "local");

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
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
    // Create a test task using the helper
    await createTask(context.page, {
      title: "Daily Planning Task",
      category: "Feature",
      priority: "High",
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

    // Enable GitHub integration first
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    // Stub GitHub APIs
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Open Tasks view and switch to GitHub service to check context widget
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

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

    // Switch to local service to test day planning functionality
    await switchToTaskService(context.page, "local");

    // Wait for tasks to load
    await context.page.waitForSelector(
      '[data-testid="local-task-item-daily-planning-task"]',
      {
        timeout: 5000,
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
      5000
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
    await createTask(context.page, {
      title: taskTitle,
      priority: "Low",
      status: "Backlog",
    });

    // Open Tasks view and switch to local service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Wait for the task to appear in the view
    const taskTestId = `local-task-item-${taskTitle
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
    await context.page.waitForSelector(`[data-testid="${taskTestId}"]`, {
      timeout: 5000,
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
      { timeout: 5000 }
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

    // Wait for files to be created using smart waiting
    await context.page.waitForFunction(
      (titles) => {
        const app = (window as any).app;
        return titles.every((title: string) =>
          app.vault.getAbstractFileByPath(`Tasks/${title}.md`)
        );
      },
      taskTitles,
      { timeout: 5000 }
    );

    // Simulate plugin restart by disabling and re-enabling
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const pluginManager = app.plugins;

      // Disable plugin
      await pluginManager.disablePlugin("obsidian-task-sync");

      // Re-enable plugin (this should trigger store refresh)
      await pluginManager.enablePlugin("obsidian-task-sync");
    });

    // Get task count after plugin restart
    const finalTaskCount = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.getCachedTasks().length;
    });

    // Should have loaded all tasks including the 3 new ones (plus any existing from previous tests)
    expect(finalTaskCount).toBeGreaterThanOrEqual(3);

    // Open Tasks view and verify tasks are displayed
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Verify all tasks are displayed in the UI
    const taskItems = context.page.locator('[data-testid^="local-task-item-"]');

    // Wait for tasks to be loaded
    await context.page.waitForFunction(
      (expectedCount) => {
        const items = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return items.length >= expectedCount;
      },
      3,
      { timeout: 5000 }
    );

    const taskCount = await taskItems.count();
    expect(taskCount).toBeGreaterThanOrEqual(3);

    // Verify our test tasks are present
    const taskTexts = await taskItems.allTextContents();
    const allTaskText = taskTexts.join(" ");

    for (const title of taskTitles) {
      expect(allTaskText).toContain(title);
    }
  });

  test("should not display imported badge for non-imported tasks", async () => {
    // Create a regular task (not imported)
    await createTask(context.page, {
      title: "Regular Local Task",
      category: "Feature",
      priority: "Medium",
      status: "Backlog",
    });

    // Open Tasks view and switch to local service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
    });

    // Find the regular task item
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
      .filter({ hasText: "Regular Local Task" })
      .first();
    await taskItem.waitFor({ state: "visible", timeout: 5000 });

    // Check that the task does NOT have the imported badge
    const importedBadge = taskItem.locator(".imported-badge");
    const badgeCount = await importedBadge.count();
    expect(badgeCount).toBe(0);
  });

  test("should handle missing Tasks folder gracefully", async () => {
    // Delete the Tasks folder to simulate the error condition
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (tasksFolder) {
        await app.vault.delete(tasksFolder, true);
      }
    });

    // Open Tasks view and switch to local service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Should show empty state instead of crashing
    const emptyMessage = context.page.locator(".task-sync-empty-message");
    await emptyMessage.waitFor({ state: "visible", timeout: 5000 });

    const messageText = await emptyMessage.textContent();
    expect(messageText).toContain("No tasks found");

    // Verify no task items are shown
    const taskItems = context.page.locator('[data-testid^="local-task-item-"]');
    const taskCount = await taskItems.count();
    expect(taskCount).toBe(0);
  });

  test("should display schedule badges for tasks with Do Date", async () => {
    // Create a task with a Do Date (scheduled task)
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.noteManagers.getTaskManager().createTaskFile({
        title: "Scheduled Local Task",
        description: "A task with a Do Date",
        done: false,
        doDate: new Date(), // Schedule for today
      });
    });

    // Open Tasks view and switch to local service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
    });

    // Find the scheduled task item
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
      .filter({ hasText: "Scheduled Local Task" })
      .first();
    await taskItem.waitFor({ state: "visible", timeout: 5000 });

    // Check that the task has the scheduled badge
    const scheduledBadge = taskItem.locator(".scheduled-badge");
    await scheduledBadge.waitFor({ state: "visible", timeout: 5000 });

    const badgeText = await scheduledBadge.textContent();
    expect(badgeText).toContain("✓ scheduled");
    expect(badgeText).toContain("Today");
  });

  test("should update schedule badge when Do Date is changed in task file", async () => {
    // Create a task without a Do Date initially
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.noteManagers.getTaskManager().createTaskFile({
        title: "Reactivity Test Task",
        description: "A task to test Do Date reactivity",
        done: false,
      });
    });

    // Open Tasks view and switch to local service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid^="local-task-item-"]');

    // Find the task item
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
      .filter({ hasText: "Reactivity Test Task" })
      .first();

    await taskItem.waitFor({ state: "visible" });

    // Initially, there should be no scheduled badge
    const initialScheduledBadge = taskItem.locator(".scheduled-badge");
    const initialBadgeCount = await initialScheduledBadge.count();
    expect(initialBadgeCount).toBe(0);

    // Now modify the task file to add a Do Date
    const todayString = new Date().toISOString().split("T")[0];
    const task = await getTaskByTitle(context.page, "Reactivity Test Task");
    await updateEntity(context.page, task, { doDate: todayString });

    // Wait for the change to propagate and the scheduled badge to appear
    const scheduledBadge = taskItem.locator(".scheduled-badge");
    await scheduledBadge.waitFor({ state: "visible" });

    const badgeText = await scheduledBadge.textContent();
    expect(badgeText).toContain("✓ scheduled");
    expect(badgeText).toContain("Today");
  });

  test("should not show 'Added to today' button state for scheduled tasks", async () => {
    // Create a test task
    await createTask(context.page, {
      title: "Button State Test Task",
      category: "Feature",
      priority: "Medium",
      status: "Backlog",
    });

    // Open Tasks view and switch to local service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "local");

    // Wait for tasks to load
    await context.page.waitForSelector('[data-testid^="local-task-item-"]');

    // Find the task item
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
      .filter({ hasText: "Button State Test Task" })
      .first();
    await taskItem.waitFor({ state: "visible" });

    // Hover over the task to show action buttons
    await taskItem.hover();

    // Initially, there should be no button states showing - only action buttons
    const addedToTodayButton = taskItem.locator(
      'button:has-text("✓ Added to today")'
    );
    const addedToTodayButtonCount = await addedToTodayButton.count();
    expect(addedToTodayButtonCount).toBe(0);

    const scheduledForTodayButton = taskItem.locator(
      'button:has-text("✓ Scheduled for today")'
    );
    const scheduledForTodayButtonCount = await scheduledForTodayButton.count();
    expect(scheduledForTodayButtonCount).toBe(0);

    const scheduledButton = taskItem.locator('button:has-text("✓ Scheduled")');
    const scheduledButtonCount = await scheduledButton.count();
    expect(scheduledButtonCount).toBe(0);

    // There should be no disabled "Add to today" buttons
    const disabledAddToTodayButton = taskItem.locator(
      'button[disabled]:has-text("Add to today")'
    );
    const disabledAddToTodayButtonCount =
      await disabledAddToTodayButton.count();
    expect(disabledAddToTodayButtonCount).toBe(0);

    // Verify that action buttons (like "Open") are still visible
    const openButton = taskItem.locator('button:has-text("Open")');
    const openButtonCount = await openButton.count();
    expect(openButtonCount).toBe(1);
  });

  test("should use source data for createdAt/updatedAt when available", async () => {
    // Enable GitHub integration
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    // Stub GitHub APIs with fixture containing specific timestamps
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "source-timestamps-issue",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Open Tasks view and switch to GitHub service
    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    // Import the GitHub issue via UI
    await clickIssueImportButton(context.page, 555);
    await waitForIssueImportComplete(context.page, 555);

    // Switch to Local Tasks view to verify the imported task
    await switchToTaskService(context.page, "local");

    // Wait for the imported task to appear in Local Tasks view
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
    });

    // Find our imported task
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
      .filter({ hasText: "GitHub Issue with Source Timestamps" });

    await taskItem.waitFor({ state: "visible", timeout: 5000 });

    // Check that the task shows source timestamps from GitHub (2024-01-01 and 2024-01-02)
    // instead of the current file creation/modification times

    // Check the title attributes which contain the absolute dates
    const createdTimestamp = taskItem.locator(".task-sync-timestamp").nth(1);
    const updatedTimestamp = taskItem.locator(".task-sync-timestamp").nth(0);

    const createdTitle = await createdTimestamp.getAttribute("title");
    const updatedTitle = await updatedTimestamp.getAttribute("title");

    // Verify the timestamps are from GitHub source data (2024) not file system
    expect(createdTitle).toContain("January 1st 2024");
    expect(updatedTitle).toContain("January 2nd 2024");
  });
});
