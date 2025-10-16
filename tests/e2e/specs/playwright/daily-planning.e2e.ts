/**
 * End-to-End Tests for Daily Planning Functionality
 * Tests the complete daily planning workflow in the new architecture
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  openView,
  enableIntegration,
  switchToTaskService,
  selectFromDropdown,
} from "../../helpers/global";
import { getTodayString, getYesterdayString } from "../../helpers/date-helpers";
import { createTask } from "../../helpers/entity-helpers";
import { stubGitHubWithFixtures } from "../../helpers/github-integration-helpers";

test.describe("Daily Planning Wizard", () => {
  test.beforeEach(async ({ page }) => {
    // Stub Apple Calendar APIs for consistent testing
    await page.evaluate(() => {
      // Mock Apple Calendar service to return empty events
      (window as any).mockAppleCalendarService = {
        getEventsForDate: () => Promise.resolve([]),
        getCalendars: () => Promise.resolve([]),
        checkPermissions: () => Promise.resolve({ granted: true }),
      };
    });
  });

  test("should preserve schedule state when reopening wizard after confirmation", async ({
    page,
  }) => {
    const todayString = getTodayString();

    // Create 2 tasks for today
    const task1 = await createTask(page, {
      title: "Task 1 - Keep scheduled",
      description: "This task should remain scheduled",
      status: "Not Started",
      priority: "High",
      done: false,
      doDate: todayString,
    });

    const task2 = await createTask(page, {
      title: "Task 2 - Will be unscheduled",
      description: "This task will be unscheduled during planning",
      status: "Not Started",
      priority: "Medium",
      done: false,
      doDate: todayString,
    });

    expect(task1).toBeTruthy();
    expect(task2).toBeTruthy();

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate to step 2 (Today's Agenda)
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Verify initial state: Task 1 and Task 2 should be in today's tasks
    await expect(
      page.locator(".task-item").filter({ hasText: "Task 1 - Keep scheduled" })
    ).toBeVisible();
    await expect(
      page
        .locator(".task-item")
        .filter({ hasText: "Task 2 - Will be unscheduled" })
    ).toBeVisible();

    // Unschedule Task 2
    const task2Item = page
      .locator(".task-item")
      .filter({ hasText: "Task 2 - Will be unscheduled" });
    await task2Item
      .locator('[data-testid="unschedule-planning-button"]')
      .click();

    // Verify Task 2 moved to "Staged for unscheduling" section
    await expect(
      page
        .locator('[data-testid="unscheduled-task"]')
        .filter({ hasText: "Task 2 - Will be unscheduled" })
    ).toBeVisible();

    // Navigate to step 3 (Plan Summary)
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();

    // Verify the final plan shows only Task 1 (Task 2 was unscheduled)
    await expect(
      page
        .locator(".preview-item.task")
        .filter({ hasText: "Task 1 - Keep scheduled" })
    ).toBeVisible();
    await expect(
      page
        .locator(".preview-item.task")
        .filter({ hasText: "Task 2 - Will be unscheduled" })
    ).not.toBeVisible();

    // Confirm the plan
    await page.click('[data-testid="confirm-button"]');

    // Wait for confirmation and daily note to open
    await page.waitForTimeout(2000);

    // NOW THE CRITICAL TEST: Reopen the daily planning wizard
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open again
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate to step 2 (Today's Agenda)
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // CRITICAL ASSERTION: The schedule state should match what was confirmed
    // Task 1 should be visible in today's tasks
    await expect(
      page.locator(".task-item").filter({ hasText: "Task 1 - Keep scheduled" })
    ).toBeVisible();

    // Task 2 should NOT be in today's tasks (it was unscheduled)
    // This is the bug - currently Task 2 will reappear because the wizard
    // loads from task store (which still has Task 2 with doDate=today)
    // instead of from the schedule (which has the correct state)
    const task2Count = await page
      .locator(".task-item")
      .filter({ hasText: "Task 2 - Will be unscheduled" })
      .count();

    // This should be 0, but if the bug exists, it will be > 0
    expect(task2Count).toBe(0);

    // Navigate to step 3 to verify final plan
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();

    // Final plan should show only Task 1
    await expect(
      page
        .locator(".preview-item.task")
        .filter({ hasText: "Task 1 - Keep scheduled" })
    ).toBeVisible();
    await expect(
      page
        .locator(".preview-item.task")
        .filter({ hasText: "Task 2 - Will be unscheduled" })
    ).not.toBeVisible();
  });

  test("should open daily planning wizard and display all 3 steps", async ({
    page,
  }) => {
    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // STEP 1: Review Yesterday's Tasks
    await expect(page.locator('[data-testid="step-1-content"]')).toBeVisible();
    await expect(
      page.locator("h3").filter({ hasText: "Review Yesterday" })
    ).toBeVisible();

    // Navigate to step 2
    await page.click('[data-testid="next-button"]');

    // STEP 2: Today's Agenda
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();
    await expect(
      page.locator("h3").filter({ hasText: "Today's Agenda" })
    ).toBeVisible();

    // Navigate to step 3
    await page.click('[data-testid="next-button"]');

    // STEP 3: Plan Summary
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();
    await expect(
      page.locator("h3").filter({ hasText: "Plan Summary" })
    ).toBeVisible();
  });

  test("should handle yesterday's unfinished tasks", async ({ page }) => {
    const yesterdayString = getYesterdayString();

    // Create a task scheduled for yesterday using the proper helper
    // Note: Daily planning uses doDate, not dueDate
    const task = await createTask(page, {
      title: "Yesterday Task",
      description: "A task that was scheduled for yesterday but not completed.",
      status: "Not Started",
      priority: "Medium",
      done: false,
      doDate: yesterdayString,
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Yesterday Task");

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // STEP 1: Should show yesterday's unfinished task
    await expect(page.locator('[data-testid="step-1-content"]')).toBeVisible();

    // Look for the task in the not completed section - use more specific locator
    await expect(
      page.locator('[data-testid="not-completed-task"]')
    ).toBeVisible();

    // Use more specific locator within the not-completed-task element
    await expect(
      page
        .locator('[data-testid="not-completed-task"] .task-title')
        .filter({ hasText: "Yesterday Task" })
    ).toBeVisible();

    // Click "Move to Today" button
    const moveToTodayButton = page.locator(
      '[data-testid="move-to-today-button"]'
    );
    if (await moveToTodayButton.isVisible()) {
      await moveToTodayButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test("should display today's scheduled tasks in step 2", async ({ page }) => {
    const todayString = getTodayString();

    // Create a task scheduled for today using the proper helper
    // Note: Daily planning uses doDate, not dueDate
    const task = await createTask(page, {
      title: "Today Task",
      description: "A task scheduled for today.",
      status: "Not Started",
      priority: "High",
      done: false,
      doDate: todayString,
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Today Task");

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate to step 2
    await page.click('[data-testid="next-button"]');

    // STEP 2: Should show today's scheduled task
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Look for today's task in the agenda - use more specific locator
    await expect(
      page
        .locator('[data-testid="step-2-content"] .task-title')
        .filter({ hasText: "Today Task" })
    ).toBeVisible();
  });

  test("should show plan summary in step 3", async ({ page }) => {
    const todayString = getTodayString();

    // Create a task for the plan summary using the proper helper
    // Note: Daily planning uses doDate, not dueDate
    const task = await createTask(page, {
      title: "Summary Task",
      description: "A task for testing plan summary.",
      status: "Not Started",
      priority: "Medium",
      done: false,
      doDate: todayString,
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Summary Task");

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate through steps to reach step 3
    await page.click('[data-testid="next-button"]');
    await page.click('[data-testid="next-button"]');

    // STEP 3: Plan Summary
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();

    // Should show the task in the plan summary - use more specific locator
    await expect(
      page
        .locator('[data-testid="step-3-content"] .preview-title')
        .filter({ hasText: "Summary Task" })
    ).toBeVisible();

    // Should have a confirm button
    await expect(page.locator('[data-testid="confirm-button"]')).toBeVisible();
  });

  test("should handle empty state when no tasks exist", async ({ page }) => {
    // Start daily planning without creating any tasks
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // STEP 1: Should show empty state for yesterday's tasks
    await expect(page.locator('[data-testid="step-1-content"]')).toBeVisible();

    // Navigate to step 2
    await page.click('[data-testid="next-button"]');

    // STEP 2: Should show empty state for today's agenda
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Navigate to step 3
    await page.click('[data-testid="next-button"]');

    // STEP 3: Should show empty plan summary
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();
  });

  test("should close daily planning view when command is executed again", async ({
    page,
  }) => {
    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Execute command again to activate existing view
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // View should still be visible (activated, not closed)
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible();
  });

  test("should handle multiple yesterday tasks and move them to today", async ({
    page,
  }) => {
    const yesterdayString = getYesterdayString();

    // Create multiple tasks scheduled for yesterday using the proper helper
    // Note: Daily planning uses doDate, not dueDate
    const tasks = [];
    for (let i = 1; i <= 3; i++) {
      const task = await createTask(page, {
        title: `Yesterday Task ${i}`,
        description: `Task ${i} that was scheduled for yesterday.`,
        status: "Not Started",
        priority: "Medium",
        done: false,
        doDate: yesterdayString,
      });
      tasks.push(task);
    }

    expect(tasks).toHaveLength(3);
    expect(tasks[0].title).toBe("Yesterday Task 1");
    expect(tasks[1].title).toBe("Yesterday Task 2");
    expect(tasks[2].title).toBe("Yesterday Task 3");

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // STEP 1: Should show all 3 yesterday tasks
    await expect(page.locator('[data-testid="step-1-content"]')).toBeVisible();

    // Wait for tasks to appear and check count
    const yesterdayTasks = page.locator('[data-testid="not-completed-task"]');
    await expect(yesterdayTasks).toHaveCount(3);

    // Move all tasks to today
    const moveToTodayButton = page.locator(
      '[data-testid="move-to-today-button"]'
    );
    if (await moveToTodayButton.isVisible()) {
      await moveToTodayButton.click();
      await page.waitForTimeout(1000);
    }

    // Navigate to step 2 to verify tasks were moved
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Should see the moved tasks in today's agenda - use more specific locators
    await expect(
      page
        .locator('[data-testid="step-2-content"] .task-title')
        .filter({ hasText: "Yesterday Task 1" })
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="step-2-content"] .task-title')
        .filter({ hasText: "Yesterday Task 2" })
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="step-2-content"] .task-title')
        .filter({ hasText: "Yesterday Task 3" })
    ).toBeVisible();
  });

  test("should handle task scheduling and unscheduling in step 2", async ({
    page,
  }) => {
    const todayString = getTodayString();

    // Create a task scheduled for today that we can unschedule in step 2
    const task = await createTask(page, {
      title: "Task to Unschedule",
      description: "A task that will be unscheduled in step 2.",
      status: "Not Started",
      priority: "Medium",
      done: false,
      doDate: todayString, // Schedule it for today first
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Task to Unschedule");

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate to step 2
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Should show the scheduled task in today's tasks
    await expect(
      page
        .locator('[data-testid="step-2-content"] .task-title')
        .filter({ hasText: "Task to Unschedule" })
    ).toBeVisible();

    // Test unscheduling functionality - click unschedule button
    const unscheduleButton = page
      .locator('[data-testid="unschedule-planning-button"]')
      .first();
    if (await unscheduleButton.isVisible()) {
      await unscheduleButton.click();
      await page.waitForTimeout(500);

      // After unscheduling, the task should appear in the staged for unscheduling section
      await expect(
        page
          .locator(
            '[data-testid="step-2-content"] [data-testid="unscheduled-task"] .task-title'
          )
          .filter({ hasText: "Task to Unschedule" })
      ).toBeVisible();

      // Test re-scheduling functionality
      const rescheduleButton = page
        .locator('[data-testid="schedule-task-button"]')
        .first();
      if (await rescheduleButton.isVisible()) {
        await rescheduleButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test("should complete full workflow and confirm plan", async ({ page }) => {
    const todayString = getTodayString();

    // Create a task for the complete workflow using the proper helper
    // Note: Daily planning uses doDate, not dueDate
    const task = await createTask(page, {
      title: "Workflow Task",
      description: "A task for testing the complete daily planning workflow.",
      status: "Not Started",
      priority: "High",
      done: false,
      doDate: todayString,
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Workflow Task");

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate through all steps
    // Step 1
    await expect(page.locator('[data-testid="step-1-content"]')).toBeVisible();
    await page.click('[data-testid="next-button"]');

    // Step 2
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();
    await expect(
      page
        .locator('[data-testid="step-2-content"] .task-title')
        .filter({ hasText: "Workflow Task" })
    ).toBeVisible();
    await page.click('[data-testid="next-button"]');

    // Step 3
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();
    await expect(
      page
        .locator('[data-testid="step-3-content"] .preview-title')
        .filter({ hasText: "Workflow Task" })
    ).toBeVisible();

    // Confirm the plan if button is available
    const confirmButton = page.locator('[data-testid="confirm-button"]');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test("should update daily note when confirming schedule", async ({
    page,
  }) => {
    const todayString = getTodayString();

    // Create tasks for the daily plan
    const task1 = await createTask(page, {
      title: "Daily Note Task 1",
      description: "First task to add to daily note.",
      status: "Not Started",
      priority: "High",
      done: false,
      doDate: todayString,
    });

    const task2 = await createTask(page, {
      title: "Daily Note Task 2",
      description: "Second task to add to daily note.",
      status: "Not Started",
      priority: "Medium",
      done: false,
      doDate: todayString,
    });

    // Create a third task scheduled for today that we will UNSCHEDULE during planning
    const task3 = await createTask(page, {
      title: "Task to Unschedule",
      description: "Task with doDate that will be unscheduled during planning.",
      status: "Not Started",
      priority: "Low",
      done: false,
      doDate: todayString, // This task HAS doDate set
    });

    expect(task1).toBeTruthy();
    expect(task2).toBeTruthy();
    expect(task3).toBeTruthy();

    const dailyNotePath = `Daily Notes/${todayString}.md`;

    // BUG 1: Verify daily note does NOT exist before starting planning
    const dailyNoteBeforePlanning = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    expect(dailyNoteBeforePlanning).toBeNull();

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // BUG 1: Verify daily note is still empty/doesn't contain tasks after starting wizard
    const dailyNoteAfterStart = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    // Daily note may be created but should NOT contain any tasks yet
    if (dailyNoteAfterStart) {
      expect(dailyNoteAfterStart).not.toContain("Daily Note Task 1");
      expect(dailyNoteAfterStart).not.toContain("Daily Note Task 2");
      expect(dailyNoteAfterStart).not.toContain("Task to Unschedule");
    }

    // Navigate to step 2
    await page.click('[data-testid="next-button"]'); // Step 1 -> Step 2

    // Wait for step 2 to be visible
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // BUG 2: Unschedule task3 during planning - it should NOT appear in daily note after confirm
    // Find task3 in the scheduled tasks section
    const scheduledTasksSection = page.locator(
      '[data-testid="step-2-content"]'
    );
    const task3Item = scheduledTasksSection
      .locator(".task-item")
      .filter({ hasText: "Task to Unschedule" });

    // Click the "Unschedule" button for this task
    const unscheduleButton = task3Item.locator(
      'button[data-testid="unschedule-planning-button"]'
    );
    await expect(unscheduleButton).toBeVisible();
    await unscheduleButton.click();
    await page.waitForTimeout(500);

    // Navigate to step 3
    await page.click('[data-testid="next-button"]'); // Step 2 -> Step 3

    // BUG 2: Verify daily note still doesn't contain the unscheduled task before confirming
    const dailyNoteBeforeConfirm = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    if (dailyNoteBeforeConfirm) {
      expect(dailyNoteBeforeConfirm).not.toContain("Task to Unschedule");
    }

    // Confirm the plan
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();
    const confirmButton = page.locator('[data-testid="confirm-button"]');
    await confirmButton.click();
    await page.waitForTimeout(2000);

    // NOW verify daily note was created and contains task links
    const dailyNoteContent = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    // Verify daily note exists
    expect(dailyNoteContent).toBeTruthy();

    // Verify daily note contains task links for task1 and task2
    expect(dailyNoteContent).toContain("## Today's Tasks");
    expect(dailyNoteContent).toContain("Daily Note Task 1");
    expect(dailyNoteContent).toContain("Daily Note Task 2");

    // BUG 2: Verify daily note does NOT contain the unscheduled task
    expect(dailyNoteContent).not.toContain("Task to Unschedule");

    // Verify tasks have Do Date set to today
    const task1File = await page.evaluate(async (title) => {
      const files = (window as any).app.vault.getMarkdownFiles();
      const taskFile = files.find((f: any) => f.basename === title);
      if (!taskFile) return null;
      const content = await (window as any).app.vault.read(taskFile);
      return content;
    }, "Daily Note Task 1");

    expect(task1File).toContain(`Do Date: ${todayString}`);

    // Verify task3 does NOT have Do Date anymore (it was unscheduled)
    const task3File = await page.evaluate(async (title) => {
      const files = (window as any).app.vault.getMarkdownFiles();
      const taskFile = files.find((f: any) => f.basename === title);
      if (!taskFile) return null;
      const content = await (window as any).app.vault.read(taskFile);
      return content;
    }, "Task to Unschedule");

    // Task3 should not have Do Date set (or it should be empty/null)
    expect(task3File).not.toContain(`Do Date: ${todayString}`);
  });

  test("should close wizard when cancel button is clicked", async ({
    page,
  }) => {
    const todayString = getTodayString();

    // Create a task for the daily plan
    const task = await createTask(page, {
      title: "Cancel Test Task",
      description: "Task for testing cancel functionality.",
      status: "Not Started",
      priority: "Medium",
      done: false,
      doDate: todayString,
    });

    expect(task).toBeTruthy();

    // Start daily planning
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Click cancel button
    const cancelButton = page.locator('[data-testid="cancel-button"]');
    await cancelButton.click();
    await page.waitForTimeout(1000);

    // Verify wizard is closed
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).not.toBeVisible();
  });

  test("should reflect freshly imported tasks when using 'Schedule for today'", async ({
    page,
  }) => {
    // This test reproduces the bug where "Schedule for today" imports and stages tasks
    // but they don't appear in the Daily Planning UI until refresh

    // Start daily planning first
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate to step 2 (Today's Agenda)
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Verify no tasks are initially scheduled
    const initialTaskCount = await page
      .locator('[data-testid="scheduled-task"]')
      .count();
    expect(initialTaskCount).toBe(0);

    // Create a task using the "Schedule for today" functionality
    // This simulates importing a GitHub issue with "Schedule for today"
    const importedTask = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Create a task and immediately stage it for today (simulating GitHub import)
      const taskOperations = plugin.operations.taskOperations;
      const createdTask = await taskOperations.create({
        title: "Freshly Imported Task",
        description: "A task imported via 'Schedule for today'",
        status: "Not Started",
        priority: "Medium",
        done: false,
      });

      // Stage the task for today (this is what "Schedule for today" does)
      const dailyPlanningExtension =
        plugin.host.getExtensionById("daily-planning");
      if (dailyPlanningExtension) {
        dailyPlanningExtension.scheduleTaskForToday(createdTask.id);
      }

      return createdTask;
    });

    expect(importedTask).toBeTruthy();
    expect(importedTask.title).toBe("Freshly Imported Task");

    // BUG: The task should now appear in the Daily Planning UI without needing to refresh
    // Wait a moment for reactivity to kick in
    await page.waitForTimeout(1000);

    // The task should appear in today's tasks section
    await expect(
      page
        .locator('[data-testid="scheduled-task"] .task-title')
        .filter({ hasText: "Freshly Imported Task" })
    ).toBeVisible({ timeout: 5000 });

    // Verify the task count has increased
    const updatedTaskCount = await page
      .locator('[data-testid="scheduled-task"]')
      .count();
    expect(updatedTaskCount).toBe(1);
  });

  test("should discover daily note location from Daily Notes core plugin", async ({
    page,
  }) => {
    // This test verifies that the system uses Daily Notes core plugin settings
    // when Periodic Notes is disabled

    await openView(page, "task-sync-main");

    // Disable Periodic Notes plugin to ensure Daily Notes core plugin is used
    await page.evaluate(async () => {
      const app = (window as any).app;
      const periodicNotesPlugin = app.plugins.plugins["periodic-notes"];
      if (periodicNotesPlugin) {
        await app.plugins.disablePlugin("periodic-notes");
      }
    });

    // Start daily planning to trigger daily note discovery
    await executeCommand(page, "Task Sync: Start Daily Planning");
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible();

    // Navigate to step 3 and confirm the plan to trigger daily note creation
    await page.click('[data-testid="next-button"]');
    await page.click('[data-testid="next-button"]');
    await page.click('[data-testid="confirm-button"]');

    // Wait for daily note operations to complete
    await page.waitForTimeout(2000);

    // Check if daily note was created in the Daily Notes core plugin folder
    const dailyNoteInfo = await page.evaluate(async () => {
      const app = (window as any).app;
      const today = new Date();
      const dateString =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");

      // Check if daily note exists in the Daily Notes core plugin folder
      const dailyNotesPath = `Daily Notes/${dateString}.md`;
      const dailyNotesFile = app.vault.getAbstractFileByPath(dailyNotesPath);

      // Check if it was incorrectly created in Periodic Notes folder
      const periodicNotesPath = `Periodic Daily Notes/${dateString}.md`;
      const periodicNotesFile =
        app.vault.getAbstractFileByPath(periodicNotesPath);

      return {
        dailyNotesExists: !!dailyNotesFile,
        periodicNotesExists: !!periodicNotesFile,
        dailyNotesPath,
        periodicNotesPath,
      };
    });

    // The daily note should be created in the Daily Notes core plugin folder
    expect(dailyNoteInfo.dailyNotesExists).toBe(true);

    // The daily note should NOT be created in the Periodic Notes folder
    expect(dailyNoteInfo.periodicNotesExists).toBe(false);
  });

  test("should discover daily note location from Periodic Notes plugin", async ({
    page,
  }) => {
    // This test verifies that the system uses Periodic Notes plugin settings
    // when Daily Notes core plugin is disabled

    await openView(page, "task-sync-main");

    // Disable Daily Notes core plugin to ensure Periodic Notes plugin is used
    await page.evaluate(async () => {
      const app = (window as any).app;

      // Disable Daily Notes core plugin
      const dailyNotesPlugin = app.internalPlugins.plugins["daily-notes"];
      if (dailyNotesPlugin && dailyNotesPlugin.enabled) {
        dailyNotesPlugin.enabled = false;
        await app.internalPlugins.saveConfig();
      }

      // Ensure Periodic Notes plugin is enabled
      const periodicNotesPluginEnabled =
        app.plugins.isEnabled("periodic-notes");
      if (!periodicNotesPluginEnabled) {
        await app.plugins.enablePlugin("periodic-notes");
      }
      console.log(
        "Periodic Notes plugin enabled:",
        app.plugins.isEnabled("periodic-notes")
      );
    });

    // Start daily planning to trigger daily note discovery
    await executeCommand(page, "Task Sync: Start Daily Planning");
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible();

    // Navigate to step 3 and confirm the plan to trigger daily note creation
    await page.click('[data-testid="next-button"]');
    await page.click('[data-testid="next-button"]');
    await page.click('[data-testid="confirm-button"]');

    // Wait for daily note operations to complete
    await page.waitForTimeout(2000);

    // Check if daily note was created in the Periodic Notes plugin folder
    const dailyNoteInfo = await page.evaluate(async () => {
      const app = (window as any).app;
      const today = new Date();
      const dateString =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");

      // Check if daily note exists in the Periodic Notes plugin folder
      const periodicNotesPath = `Periodic Daily Notes/${dateString}.md`;
      const periodicNotesFile =
        app.vault.getAbstractFileByPath(periodicNotesPath);

      // Check if it was incorrectly created in Daily Notes core plugin folder
      const dailyNotesPath = `Daily Notes/${dateString}.md`;
      const dailyNotesFile = app.vault.getAbstractFileByPath(dailyNotesPath);

      // Debug: Check plugin states and discovery utility
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const dailyNoteFeature =
        plugin?.host?.obsidianExtension?.dailyNoteFeature;

      let discoveredPath = null;
      let discoveredSettings = null;
      if (dailyNoteFeature) {
        try {
          discoveredPath = await dailyNoteFeature.getTodayDailyNotePath();
          // Also test the discovery utility directly
          const { discoverDailyNoteSettings } =
            plugin.host.obsidianExtension.constructor;
          if (discoverDailyNoteSettings) {
            discoveredSettings = discoverDailyNoteSettings(app, "Fallback");
          }
        } catch (error) {
          console.error("Discovery error:", error);
        }
      }

      return {
        periodicNotesExists: !!periodicNotesFile,
        dailyNotesExists: !!dailyNotesFile,
        periodicNotesPath,
        dailyNotesPath,
        discoveredPath,
        discoveredSettings,
        dailyNotesPluginEnabled:
          app.internalPlugins.plugins["daily-notes"]?.enabled,
        periodicNotesPluginEnabled: app.plugins.isEnabled("periodic-notes"),
      };
    });

    // The daily note should be created in the Periodic Notes plugin folder
    expect(dailyNoteInfo.periodicNotesExists).toBe(true);

    // The daily note should NOT be created in the Daily Notes core plugin folder
    expect(dailyNoteInfo.dailyNotesExists).toBe(false);
  });

  test("should include imported tasks in daily note when confirming plan", async ({
    page,
  }) => {
    const todayString = getTodayString();

    // Set up GitHub integration
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service to be ready
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    // Start Daily Planning wizard
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for daily planning view to open
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({
      timeout: 10000,
    });

    // Navigate to step 2 (Today's Agenda)
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();

    // Import a GitHub issue while in the wizard
    // First, switch to the Tasks view tab (wizard stays open in background)
    const tasksViewTab = page.locator('[data-testid="tasks-view-tab"]');
    await tasksViewTab.click();

    // Switch to GitHub service
    await switchToTaskService(page, "github");
    await selectFromDropdown(page, "organization-filter", "solnic");
    await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

    // Wait for issues to load
    await expect(
      page.locator('[data-testid="github-issues-list"]')
    ).toBeVisible({ timeout: 10000 });

    // Find the first issue and import it
    const firstIssue = page
      .locator('[data-testid="github-issue-item"]')
      .first();
    await firstIssue.waitFor({ state: "visible", timeout: 10000 });
    await firstIssue.hover();

    // Click "Schedule for today" button (should be visible because wizard is active)
    const scheduleButton = page
      .locator('[data-testid="schedule-for-today-button"]')
      .first();
    await scheduleButton.waitFor({ state: "visible", timeout: 10000 });
    await scheduleButton.click();

    // Wait for import to complete
    await page.waitForTimeout(2000);

    // Now complete the daily planning wizard
    // Use the command palette to navigate directly to confirm
    await executeCommand(page, "Task Sync: Start Daily Planning");

    // Wait for wizard to be visible
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({ timeout: 10000 });

    // We should be on step 2 still, navigate to step 3
    await page.click('[data-testid="next-button"]');
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible({
      timeout: 10000,
    });

    // Confirm the plan
    const confirmButton = page.locator('[data-testid="confirm-button"]');
    await confirmButton.waitFor({ state: "visible", timeout: 10000 });
    await confirmButton.click();
    await page.waitForTimeout(2000);

    // Verify daily note was created and contains the imported task
    const dailyNotePath = `Daily Notes/${todayString}.md`;

    const dailyNoteContent = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    // Verify daily note exists
    expect(dailyNoteContent).toBeTruthy();

    // Verify daily note contains an imported GitHub issue
    // The test imports whichever issue is first in the list (depends on sort order)
    // Could be any of: "First test issue", "Second test issue", "Third test issue"
    const hasTestIssue =
      dailyNoteContent.includes("First test issue") ||
      dailyNoteContent.includes("Second test issue") ||
      dailyNoteContent.includes("Third test issue");
    expect(hasTestIssue).toBe(true);

    // Verify the task link format is correct
    expect(dailyNoteContent).toContain("## Today's Tasks");
    expect(dailyNoteContent).toContain("- [ ] [[Tasks/");
  });

  test("should not duplicate tasks when confirming schedule multiple times (idempotency)", async ({
    page,
  }) => {
    const todayString = getTodayString();

    // Create 2 tasks for today
    const task1 = await createTask(page, {
      title: "Idempotency Test Task 1",
      description: "First task for idempotency test",
      status: "Not Started",
      priority: "High",
      done: false,
      doDate: todayString,
    });

    const task2 = await createTask(page, {
      title: "Idempotency Test Task 2",
      description: "Second task for idempotency test",
      status: "Not Started",
      priority: "Medium",
      done: false,
      doDate: todayString,
    });

    expect(task1).toBeTruthy();
    expect(task2).toBeTruthy();

    const dailyNotePath = `Daily Notes/${todayString}.md`;

    // FIRST CONFIRMATION: Start daily planning and confirm
    await executeCommand(page, "Task Sync: Start Daily Planning");
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({ timeout: 10000 });

    // Navigate through wizard to confirmation
    await page.click('[data-testid="next-button"]'); // Step 2
    await page.click('[data-testid="next-button"]'); // Step 3
    await page.click('[data-testid="confirm-button"]'); // Confirm

    // Wait for daily note to be updated
    await page.waitForTimeout(2000);

    // Read daily note content after first confirmation
    const dailyNoteContentAfterFirst = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    expect(dailyNoteContentAfterFirst).toBeTruthy();
    expect(dailyNoteContentAfterFirst).toContain("Idempotency Test Task 1");
    expect(dailyNoteContentAfterFirst).toContain("Idempotency Test Task 2");

    // Count task LINKS (lines with checkboxes) after first confirmation
    // Use a more specific pattern that matches the full task link line
    const task1CountFirst = (
      dailyNoteContentAfterFirst!.match(
        /^- \[ \] \[\[.*Idempotency Test Task 1.*\]\]$/gm
      ) || []
    ).length;
    const task2CountFirst = (
      dailyNoteContentAfterFirst!.match(
        /^- \[ \] \[\[.*Idempotency Test Task 2.*\]\]$/gm
      ) || []
    ).length;

    expect(task1CountFirst).toBe(1);
    expect(task2CountFirst).toBe(1);

    // SECOND CONFIRMATION: Reopen wizard and confirm again
    await executeCommand(page, "Task Sync: Start Daily Planning");
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({ timeout: 10000 });

    // Navigate through wizard to confirmation again
    await page.click('[data-testid="next-button"]'); // Step 2
    await page.click('[data-testid="next-button"]'); // Step 3
    await page.click('[data-testid="confirm-button"]'); // Confirm again

    // Wait for any potential updates
    await page.waitForTimeout(2000);

    // Read daily note content after second confirmation
    const dailyNoteContentAfterSecond = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    expect(dailyNoteContentAfterSecond).toBeTruthy();

    // CRITICAL ASSERTION: Task link count should remain the same (no duplicates)
    const task1CountSecond = (
      dailyNoteContentAfterSecond!.match(
        /^- \[ \] \[\[.*Idempotency Test Task 1.*\]\]$/gm
      ) || []
    ).length;
    const task2CountSecond = (
      dailyNoteContentAfterSecond!.match(
        /^- \[ \] \[\[.*Idempotency Test Task 2.*\]\]$/gm
      ) || []
    ).length;

    // These should still be 1, not 2 or more
    expect(task1CountSecond).toBe(1);
    expect(task2CountSecond).toBe(1);

    // Verify content is identical after both confirmations
    expect(dailyNoteContentAfterSecond).toBe(dailyNoteContentAfterFirst);

    // THIRD CONFIRMATION: One more time to be absolutely sure
    await executeCommand(page, "Task Sync: Start Daily Planning");
    await expect(
      page.locator('[data-testid="daily-planning-view"]')
    ).toBeVisible({ timeout: 10000 });

    await page.click('[data-testid="next-button"]'); // Step 2
    await page.click('[data-testid="next-button"]'); // Step 3
    await page.click('[data-testid="confirm-button"]'); // Confirm third time

    await page.waitForTimeout(2000);

    // Read daily note content after third confirmation
    const dailyNoteContentAfterThird = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    expect(dailyNoteContentAfterThird).toBeTruthy();

    // Final assertion: Still only 1 task link for each task
    const task1CountThird = (
      dailyNoteContentAfterThird!.match(
        /^- \[ \] \[\[.*Idempotency Test Task 1.*\]\]$/gm
      ) || []
    ).length;
    const task2CountThird = (
      dailyNoteContentAfterThird!.match(
        /^- \[ \] \[\[.*Idempotency Test Task 2.*\]\]$/gm
      ) || []
    ).length;

    expect(task1CountThird).toBe(1);
    expect(task2CountThird).toBe(1);

    // Content should be identical across all confirmations
    expect(dailyNoteContentAfterThird).toBe(dailyNoteContentAfterFirst);
  });
});
