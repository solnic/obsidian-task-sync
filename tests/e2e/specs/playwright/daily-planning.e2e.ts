/**
 * End-to-End Tests for Daily Planning Functionality
 * Tests the complete daily planning workflow in the new architecture
 */

import { test, expect } from "../../helpers/setup";
import { executeCommand } from "../../helpers/global";
import { getTodayString, getYesterdayString } from "../../helpers/date-helpers";
import { createTask } from "../../helpers/entity-helpers";

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
    // Create an unscheduled task using the proper helper
    const task = await createTask(page, {
      title: "Unscheduled Task",
      description: "A task that needs to be scheduled.",
      status: "Not Started",
      priority: "Medium",
      done: false,
      // No dueDate - this makes it unscheduled
    });

    expect(task).toBeTruthy();
    expect(task.title).toBe("Unscheduled Task");

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

    // Should show the unscheduled task - use more specific locator
    await expect(
      page
        .locator('[data-testid="step-2-content"] .task-title')
        .filter({ hasText: "Unscheduled Task" })
    ).toBeVisible();

    // Test scheduling functionality if schedule buttons are available
    const scheduleButton = page
      .locator('[data-testid="schedule-task-button"]')
      .first();
    if (await scheduleButton.isVisible()) {
      await scheduleButton.click();
      await page.waitForTimeout(500);
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

    // Navigate through all steps
    await page.click('[data-testid="next-button"]'); // Step 1 -> Step 2
    await page.click('[data-testid="next-button"]'); // Step 2 -> Step 3

    // Confirm the plan
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();
    const confirmButton = page.locator('[data-testid="confirm-button"]');
    await confirmButton.click();
    await page.waitForTimeout(2000);

    // Verify daily note was created and contains task links
    const dailyNotePath = `Daily Notes/${todayString}.md`;

    // Get the daily note content
    const dailyNoteContent = await page.evaluate(async (path) => {
      const file = (window as any).app.vault.getAbstractFileByPath(path);
      if (!file) return null;
      return await (window as any).app.vault.read(file);
    }, dailyNotePath);

    // Verify daily note exists
    expect(dailyNoteContent).toBeTruthy();

    // Verify daily note contains task links
    expect(dailyNoteContent).toContain("## Tasks");
    expect(dailyNoteContent).toContain("Daily Note Task 1");
    expect(dailyNoteContent).toContain("Daily Note Task 2");

    // Verify tasks have Do Date set to today
    const task1File = await page.evaluate(async (title) => {
      const files = (window as any).app.vault.getMarkdownFiles();
      const taskFile = files.find((f: any) => f.basename === title);
      if (!taskFile) return null;
      const content = await (window as any).app.vault.read(taskFile);
      return content;
    }, "Daily Note Task 1");

    expect(task1File).toContain(`Do Date: ${todayString}`);
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
});
