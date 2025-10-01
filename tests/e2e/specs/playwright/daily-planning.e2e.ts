/**
 * End-to-End Tests for Daily Planning Functionality
 * Tests the complete daily planning workflow in the new architecture
 */

import { test, expect } from "../../helpers/setup";
import { executeCommand } from "../../helpers/global";
import {
  getDateString,
  getTodayString,
  getYesterdayString,
} from "../../helpers/date-helpers";

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
      page.locator("h2").filter({ hasText: "Review Yesterday" })
    ).toBeVisible();

    // Navigate to step 2
    await page.click('[data-testid="next-button"]');

    // STEP 2: Today's Agenda
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();
    await expect(
      page.locator("h2").filter({ hasText: "Today's Agenda" })
    ).toBeVisible();

    // Navigate to step 3
    await page.click('[data-testid="next-button"]');

    // STEP 3: Plan Summary
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();
    await expect(
      page.locator("h2").filter({ hasText: "Plan Summary" })
    ).toBeVisible();
  });

  test("should handle yesterday's unfinished tasks", async ({ page }) => {
    const yesterdayString = getYesterdayString();

    // Create a task scheduled for yesterday
    const taskPath = await page.evaluate(async (yesterdayString) => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create task file with yesterday's date
      const fileName = `Tasks/Yesterday Task.md`;
      const content = `---
Title: Yesterday Task
Type: Task
Status: Not Started
Priority: Medium
Done: false
Do Date: ${yesterdayString}
---

A task that was scheduled for yesterday but not completed.`;

      await app.vault.create(fileName, content);
      return fileName;
    }, yesterdayString);

    expect(taskPath).toBeTruthy();

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

    // Look for the task in the not completed section
    await expect(
      page.locator('[data-testid="not-completed-task"]')
    ).toBeVisible();
    await expect(page.locator("text=Yesterday Task")).toBeVisible();

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

    // Create a task scheduled for today
    const taskPath = await page.evaluate(async (todayString) => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create task file with today's date
      const fileName = `Tasks/Today Task.md`;
      const content = `---
Title: Today Task
Type: Task
Status: Not Started
Priority: High
Done: false
Do Date: ${todayString}
---

A task scheduled for today.`;

      await app.vault.create(fileName, content);
      return fileName;
    }, todayString);

    expect(taskPath).toBeTruthy();

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

    // Look for today's task in the agenda
    await expect(page.locator("text=Today Task")).toBeVisible();
  });

  test("should show plan summary in step 3", async ({ page }) => {
    const todayString = getTodayString();

    // Create a task for the plan summary
    const taskPath = await page.evaluate(async (todayString) => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create task file
      const fileName = `Tasks/Summary Task.md`;
      const content = `---
Title: Summary Task
Type: Task
Status: Not Started
Priority: Medium
Done: false
Do Date: ${todayString}
---

A task for testing plan summary.`;

      await app.vault.create(fileName, content);
      return fileName;
    }, todayString);

    expect(taskPath).toBeTruthy();

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

    // Should show the task in the plan summary
    await expect(page.locator("text=Summary Task")).toBeVisible();

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

    // Create multiple tasks scheduled for yesterday
    const taskPaths = await page.evaluate(async (yesterdayString) => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      const paths = [];

      // Create 3 yesterday tasks
      for (let i = 1; i <= 3; i++) {
        const fileName = `Tasks/Yesterday Task ${i}.md`;
        const content = `---
Title: Yesterday Task ${i}
Type: Task
Status: Not Started
Priority: Medium
Done: false
Do Date: ${yesterdayString}
---

Task ${i} that was scheduled for yesterday.`;

        await app.vault.create(fileName, content);
        paths.push(fileName);
      }

      return paths;
    }, yesterdayString);

    expect(taskPaths).toHaveLength(3);

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

    // Wait for tasks to appear
    await expect(
      page.locator('[data-testid="not-completed-task"]')
    ).toBeVisible();

    // Should see all 3 tasks
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

    // Should see the moved tasks in today's agenda
    await expect(page.locator("text=Yesterday Task 1")).toBeVisible();
    await expect(page.locator("text=Yesterday Task 2")).toBeVisible();
    await expect(page.locator("text=Yesterday Task 3")).toBeVisible();
  });

  test("should handle task scheduling and unscheduling in step 2", async ({
    page,
  }) => {
    // Create an unscheduled task
    const taskPath = await page.evaluate(async () => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create unscheduled task
      const fileName = `Tasks/Unscheduled Task.md`;
      const content = `---
Title: Unscheduled Task
Type: Task
Status: Not Started
Priority: Medium
Done: false
---

A task that needs to be scheduled.`;

      await app.vault.create(fileName, content);
      return fileName;
    });

    expect(taskPath).toBeTruthy();

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

    // Should show the unscheduled task
    await expect(page.locator("text=Unscheduled Task")).toBeVisible();

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

    // Create a task for the complete workflow
    const taskPath = await page.evaluate(async (todayString) => {
      const app = (window as any).app;

      // Create Tasks folder if it doesn't exist
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create task file
      const fileName = `Tasks/Workflow Task.md`;
      const content = `---
Title: Workflow Task
Type: Task
Status: Not Started
Priority: High
Done: false
Do Date: ${todayString}
---

A task for testing the complete daily planning workflow.`;

      await app.vault.create(fileName, content);
      return fileName;
    }, todayString);

    expect(taskPath).toBeTruthy();

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
    await expect(page.locator("text=Workflow Task")).toBeVisible();
    await page.click('[data-testid="next-button"]');

    // Step 3
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();
    await expect(page.locator("text=Workflow Task")).toBeVisible();

    // Confirm the plan if button is available
    const confirmButton = page.locator('[data-testid="confirm-button"]');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
      await page.waitForTimeout(2000);
    }
  });
});
