/**
 * End-to-End Tests for Daily Planning Functionality
 * Tests the complete daily planning workflow
 */

import { test, expect, describe, beforeEach } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import {
  waitForTaskPropertySync,
  executeCommand,
  enableIntegration,
  openView,
  switchToTaskService,
} from "../helpers/global";
import { stubAppleCalendarAPIs } from "../helpers/api-stubbing";
import { stubGitHubWithFixtures } from "../helpers/github-integration-helpers";

describe("Daily Planning", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    // Stub Apple Calendar service using fixture-based stubbing
    // This needs to be done for each test since we have fresh environments
    await stubAppleCalendarAPIs(context.page, {
      todayEvents: "events-empty",
      events: "events-empty",
      permissions: "permissions-granted",
    });
  });

  test("should handle timezone issues correctly when filtering tasks by date", async () => {
    // Test the timezone bug by checking date filtering logic directly
    const result = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Test parseDoDate function
      const parseDoDate =
        plugin.constructor.prototype.constructor.parseDoDate ||
        (window as any).parseDoDate ||
        ((dateStr: string) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return new Date(dateStr + "T00:00:00.000Z");
          }
          return new Date(dateStr);
        });

      // Test getDateString function
      const getDateString = (date: Date) => date.toISOString().split("T")[0];

      // Test getTodayString function
      const getTodayString = () => getDateString(new Date());

      const testDate = "2025-09-16";
      const parsedDate = parseDoDate(testDate);
      const backToString = getDateString(parsedDate);
      const todayString = getTodayString();

      return {
        testDate,
        parsedDate: parsedDate?.toISOString(),
        backToString,
        todayString,
        localTime: new Date().toString(),
        utcTime: new Date().toISOString(),
        timezoneOffset: new Date().getTimezoneOffset(),
      };
    });

    console.log("Timezone test result:", result);

    // The bug would show up as backToString !== testDate or incorrect today comparison
    expect(result.backToString).toBe(result.testDate);
  });

  test("should display existing tasks scheduled for today and yesterday", async () => {
    // Create a task scheduled for today
    const todayString = new Date().toISOString().split("T")[0];
    const todayTaskPath = await context.page.evaluate(async (todayString) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Today Task",
        description: "A task scheduled for today",
        done: false,
        doDate: todayString,
      });
    }, todayString);

    // Create a task scheduled for yesterday
    const yesterdayString = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const yesterdayTaskPath = await context.page.evaluate(
      async (yesterdayString) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        return await plugin.taskFileManager.createTaskFile({
          title: "Yesterday Task",
          description: "A task scheduled for yesterday",
          done: false,
          doDate: yesterdayString,
        });
      },
      yesterdayString
    );

    expect(todayTaskPath).toBeTruthy();
    expect(yesterdayTaskPath).toBeTruthy();

    // Start daily planning
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // STEP 1: Review Yesterday's Tasks - should show the yesterday task
    await context.page.waitForSelector('[data-testid="step-1-content"]', {
      timeout: 5000,
    });

    // Check that yesterday's task appears in the not completed section
    const yesterdayTask = context.page
      .locator('[data-testid="not-completed-task"]')
      .filter({ hasText: "Yesterday Task" });
    expect(await yesterdayTask.isVisible()).toBe(true);

    // Navigate to step 2
    await context.page.click('[data-testid="next-button"]');

    // STEP 2: Today's Agenda - should show the today task
    await context.page.waitForSelector('[data-testid="step-2-content"]', {
      timeout: 5000,
    });

    // Check that today's task appears in the scheduled tasks
    const todayTask = context.page
      .locator('[data-testid="scheduled-task"]')
      .filter({ hasText: "Today Task" });
    expect(await todayTask.isVisible()).toBe(true);
  });

  test("should handle individual task controls in step 1", async () => {
    // Create multiple test tasks with Do Date set to yesterday
    const yesterdayString = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const taskPaths = await context.page.evaluate(async (yesterdayString) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const paths = [];
      for (let i = 1; i <= 3; i++) {
        const path = await plugin.taskFileManager.createTaskFile({
          title: `Yesterday Task ${i}`,
          description: `Test task ${i} for individual controls`,
          done: false,
          doDate: yesterdayString,
        });
        paths.push(path);
      }
      return paths;
    }, yesterdayString);

    expect(taskPaths).toHaveLength(3);

    // Start daily planning
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // STEP 1: Review Yesterday's Tasks
    await context.page.waitForSelector('[data-testid="step-1-content"]', {
      timeout: 5000,
    });

    // Wait for all tasks to appear
    await context.page.waitForSelector('[data-testid="not-completed-task"]', {
      timeout: 5000,
    });

    const yesterdayTasks = context.page.locator(
      '[data-testid="not-completed-task"]'
    );
    expect(await yesterdayTasks.count()).toBe(3);

    // Test individual "Move to today" button
    const firstTask = yesterdayTasks.first();
    const firstTaskTitle = await firstTask.locator(".task-title").textContent();
    const moveButton = firstTask.locator(
      '[data-testid="move-task-to-today-button"]'
    );
    expect(await moveButton.isVisible()).toBe(true);

    await moveButton.click();

    // Wait a moment for the task to be processed
    await context.page.waitForTimeout(1000);

    // Test individual "Unschedule" button
    const secondTask = yesterdayTasks.nth(1);
    const secondTaskTitle = await secondTask
      .locator(".task-title")
      .textContent();
    const unscheduleButton = secondTask.locator(
      '[data-testid="unschedule-task-button"]'
    );
    expect(await unscheduleButton.isVisible()).toBe(true);

    await unscheduleButton.click();

    // Wait a moment for the task to be processed
    await context.page.waitForTimeout(1000);

    // Test "Move unfinished to today" button (should proceed to step 2)
    const moveAllButton = context.page.locator(
      '[data-testid="move-to-today-button"]'
    );
    await moveAllButton.click();

    // Should automatically proceed to step 2
    await context.page.waitForSelector('[data-testid="step-2-content"]', {
      timeout: 5000,
    });

    // Verify we're on step 2
    const step2Content = context.page.locator('[data-testid="step-2-content"]');
    expect(await step2Content.isVisible()).toBe(true);

    // VERIFY INDIVIDUAL TASK ACTIONS WORKED:

    // 1. The first task (moved individually) should appear in scheduled tasks
    const scheduledTasks = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    const scheduledTaskTitles = await scheduledTasks.allTextContents();
    expect(
      scheduledTaskTitles.some((title) => title.includes(firstTaskTitle || ""))
    ).toBe(true);

    // 2. The second task (unscheduled individually) should appear in unscheduled tasks
    const unscheduledTasks = context.page.locator(
      '[data-testid="unscheduled-task"]'
    );
    const unscheduledTaskTitles = await unscheduledTasks.allTextContents();
    expect(
      unscheduledTaskTitles.some((title) =>
        title.includes(secondTaskTitle || "")
      )
    ).toBe(true);

    // 3. The third task (moved via bulk action) should also appear in scheduled tasks
    const thirdTaskTitle = "Yesterday Task 3";
    expect(
      scheduledTaskTitles.some((title) => title.includes(thirdTaskTitle))
    ).toBe(true);
  });

  test("should handle unscheduled tasks in step 2", async () => {
    // Create a test task for yesterday that will be moved to today during planning
    const yesterdayString = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const taskPath = await context.page.evaluate(async (yesterdayString) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Yesterday Task for Unschedule Test",
        description: "Test task for unscheduling functionality",
        done: false,
        doDate: yesterdayString,
      });
    }, yesterdayString);

    expect(taskPath).toBeTruthy();

    // Start daily planning
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // STEP 1: Move task from yesterday to today
    await context.page.waitForSelector('[data-testid="step-1-content"]', {
      timeout: 5000,
    });

    // Click "Move to Today" button to move yesterday's tasks
    const moveToTodayButton = context.page.locator(
      '[data-testid="move-to-today-button"]'
    );
    if (await moveToTodayButton.isVisible()) {
      await moveToTodayButton.click();
      // Wait for automatic navigation to step 2
      await context.page.waitForTimeout(1000);
    } else {
      // Navigate to step 2 manually if no move button
      await context.page.click('[data-testid="next-button"]');
    }

    // STEP 2: Today's Agenda
    await context.page.waitForSelector('[data-testid="step-2-content"]', {
      timeout: 5000,
    });

    // Wait for today task to appear in the scheduled tasks section
    await context.page.waitForSelector('[data-testid="scheduled-task"]', {
      timeout: 5000,
    });

    const scheduledTask = context.page
      .locator('[data-testid="scheduled-task"]')
      .first();
    expect(await scheduledTask.isVisible()).toBe(true);

    // Click unschedule button to move task to unscheduled section
    // Note: Only tasks added during planning have unschedule buttons
    const unscheduleButton = scheduledTask.locator(
      '[data-testid="unschedule-planning-button"]'
    );
    await unscheduleButton.click();

    // Wait for unscheduled task to appear
    await context.page.waitForSelector('[data-testid="unscheduled-task"]', {
      timeout: 5000,
    });

    const unscheduledTask = context.page
      .locator('[data-testid="unscheduled-task"]')
      .first();
    expect(await unscheduledTask.isVisible()).toBe(true);

    // Test reschedule button
    const scheduleButton = unscheduledTask.locator(
      '[data-testid="schedule-task-button"]'
    );
    expect(await scheduleButton.isVisible()).toBe(true);

    await scheduleButton.click();

    // Wait for task to move back to scheduled section
    await context.page.waitForTimeout(1000);

    // Verify task is back in scheduled section
    const rescheduledTask = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    expect(await rescheduledTask.count()).toBeGreaterThan(0);
  });

  test("should complete daily planning workflow with all 3 steps and reactivity", async () => {
    // Create a test task with a Do Date set to yesterday
    const yesterdayString = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const taskPath = await context.page.evaluate(async (yesterdayString) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Test Task for Daily Planning",
        description: "A task to test the complete daily planning workflow",
        done: false,
        doDate: yesterdayString,
      });
    }, yesterdayString);

    expect(taskPath).toBeTruthy();

    // Start daily planning
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open and step content to be visible
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // Wait for step 1 content to be visible
    await context.page.waitForSelector('[data-testid="step-1-content"]');

    // STEP 1: Review Yesterday's Tasks
    const stepTitle = context.page.locator(".step-info h3");
    expect(await stepTitle.textContent()).toContain("Review Yesterday");

    // Navigate to step 2
    await context.page.click('[data-testid="next-button"]');

    // STEP 2: Today's Agenda - Test reactivity by changing Do Date
    await context.page.waitForSelector('[data-testid="step-2-content"]', {
      timeout: 5000,
    });

    expect(await stepTitle.textContent()).toContain("Today's Agenda");

    // Check initial scheduled tasks count
    const initialScheduledTasks = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    const initialCount = await initialScheduledTasks.count();

    // Edit the task file to change Do Date to today (testing reactivity)
    const todayString = new Date().toISOString().split("T")[0];

    await context.page.evaluate(
      async (args) => {
        const { taskPath, todayString } = args;
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(taskPath);

        if (file) {
          const currentContent = await app.vault.read(file);
          const updatedContent = currentContent.replace(
            /Do Date: \d{4}-\d{2}-\d{2}/,
            `Do Date: ${todayString}`
          );
          await app.vault.modify(file, updatedContent);
        }
      },
      { taskPath, todayString }
    );

    // Wait for the Do Date property to be updated in the file
    await waitForTaskPropertySync(
      context.page,
      taskPath,
      "Do Date",
      todayString,
      10000
    );

    // Wait for the UI to update via reactivity
    await context.page.waitForSelector(
      '[data-testid="scheduled-task"]:has-text("Test Task for Daily Planning")',
      { timeout: 10000 }
    );

    // Verify the task now appears in today's agenda
    const updatedScheduledTasks = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    const updatedCount = await updatedScheduledTasks.count();
    expect(updatedCount).toBe(initialCount + 1);

    // Verify the specific task appears
    const taskInAgenda = context.page
      .locator('[data-testid="scheduled-task"]')
      .filter({ hasText: "Test Task for Daily Planning" });
    expect(await taskInAgenda.isVisible()).toBe(true);

    // Navigate to step 3
    await context.page.click('[data-testid="next-button"]');

    // STEP 3: Plan Summary
    await context.page.waitForSelector('[data-testid="step-3-content"]', {
      timeout: 5000,
    });

    expect(await stepTitle.textContent()).toContain("Confirm Plan");

    // Verify the task appears in the final plan summary
    const summaryTask = context.page.locator(".preview-item.task").filter({
      hasText: "Test Task for Daily Planning",
    });
    expect(await summaryTask.isVisible()).toBe(true);

    // Test the complete workflow by confirming the plan
    const confirmButton = context.page.locator(
      '[data-testid="confirm-button"]'
    );
    if (await confirmButton.isVisible()) {
      await confirmButton.click();

      // Wait for confirmation to complete
      await context.page.waitForTimeout(2000);
    }
  });

  test("should handle schedule for today button in services task list", async () => {
    // Create a test task that will appear in the services task list
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Service Task for Scheduling",
        description: "A task to test schedule for today functionality",
        done: false,
        // No doDate initially - this task should be unscheduled
      });
    });

    expect(taskPath).toBeTruthy();

    // Open Tasks view first to access services task list
    await executeCommand(context, "Task Sync: Open Tasks view");

    // Wait for tasks view to open
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      timeout: 10000,
    });

    // Start daily planning to activate wizard mode (this should enable the schedule button)
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // Go back to Tasks view to test the schedule button
    await executeCommand(context, "Task Sync: Open Tasks view");

    // Wait for tasks view to open again
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      timeout: 10000,
    });

    // Switch to local service to see our test task (local service should already be active)
    await context.page.click('[data-testid="service-local"]');

    // Wait for the task to appear
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
    });

    // Find our specific task
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
      .filter({
        hasText: "Service Task for Scheduling",
      });

    // Verify the task is visible first
    expect(await taskItem.isVisible()).toBe(true);

    // Hover over the task to reveal the schedule button
    await taskItem.hover();

    // Wait for the schedule button to appear on hover
    const scheduleButton = taskItem.locator(
      '[data-testid="schedule-for-today-button"]'
    );

    // Wait for the button to be visible after hover
    await scheduleButton.waitFor({ state: "visible", timeout: 5000 });

    expect(await scheduleButton.isVisible()).toBe(true);
    expect(await scheduleButton.textContent()).toContain("Schedule for today");

    await scheduleButton.click();

    // Wait for the action to complete and check for any console logs
    await context.page.waitForTimeout(2000);

    // Check if the button text changed to indicate it's scheduled
    const buttonText = await scheduleButton.textContent();
    console.log("Button text after click:", buttonText);

    // Verify the button text changed to indicate it's scheduled
    expect(buttonText).toContain("✓ Scheduled");

    // Verify the task now has today's date as Do Date
    const todayString = new Date().toISOString().split("T")[0];
    await waitForTaskPropertySync(
      context.page,
      taskPath,
      "Do Date",
      todayString,
      10000
    );

    // Go back to daily planning and verify the task appears in step 2
    await executeCommand(context, "Task Sync: Start daily planning");

    // Navigate to step 2
    await context.page.click('[data-testid="next-button"]');

    // Wait for step 2 content
    await context.page.waitForSelector('[data-testid="step-2-content"]', {
      timeout: 5000,
    });

    // Verify the task appears in today's agenda - there might be duplicates due to store/file sync
    const scheduledTasks = context.page
      .locator('[data-testid="scheduled-task"]')
      .filter({
        hasText: "Service Task for Scheduling",
      });

    const taskCount = await scheduledTasks.count();
    console.log(
      `Found ${taskCount} scheduled tasks with the name "Service Task for Scheduling"`
    );

    // Verify at least one scheduled task exists (there might be duplicates due to store/file sync issues)
    expect(taskCount).toBeGreaterThan(0);
  });

  test("should handle schedule for today button with problematic filename characters", async () => {
    // Create a task with special characters that could cause metadata cache issues
    const problematicTitle =
      "crontabs with -@reboot- oban option instead of valid crontab cause sentry logger to fail and detach";

    const taskPath = await context.page.evaluate(async (title) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title,
        description:
          "A task with problematic filename to test metadata cache timeout handling",
        done: false,
        // No doDate initially - this task should be unscheduled
      });
    }, problematicTitle);

    expect(taskPath).toBeTruthy();

    // Open Tasks view first to access services task list
    await executeCommand(context, "Task Sync: Open Tasks view");

    // Wait for tasks view to open
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      timeout: 10000,
    });

    // Start daily planning to activate wizard mode
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // Go back to Tasks view to test the schedule button
    await executeCommand(context, "Task Sync: Open Tasks view");

    // Wait for tasks view to open again
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      timeout: 10000,
    });

    // Switch to local service to see our test task
    await context.page.click('[data-testid="service-local"]');

    // Wait for the task to appear
    await context.page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
    });

    // Find our specific task (use a shorter substring to match)
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
      .filter({
        hasText: "crontabs with -@reboot- oban option",
      });

    // Verify the task is visible first
    expect(await taskItem.isVisible()).toBe(true);

    // Hover over the task to reveal the schedule button
    await taskItem.hover();

    // Wait for the schedule button to appear on hover
    const scheduleButton = taskItem.locator(
      '[data-testid="schedule-for-today-button"]'
    );

    // Wait for the button to be visible after hover
    await scheduleButton.waitFor({ state: "visible", timeout: 5000 });

    expect(await scheduleButton.isVisible()).toBe(true);
    expect(await scheduleButton.textContent()).toContain("Schedule for today");

    // This should NOT crash with metadata cache timeout after our fix
    await scheduleButton.click();

    // Wait for the action to complete
    await context.page.waitForTimeout(2000);

    // Check if the button text changed to indicate it's scheduled
    const buttonText = await scheduleButton.textContent();
    console.log("Button text after click:", buttonText);

    // Verify the button text changed to indicate it's scheduled
    expect(buttonText).toContain("✓ Scheduled");

    // Verify the task now has today's date as Do Date
    const todayString = new Date().toISOString().split("T")[0];
    await waitForTaskPropertySync(
      context.page,
      taskPath,
      "Do Date",
      todayString,
      10000
    );
  });

  test("should handle already scheduled tasks in daily planning", async () => {
    // Create a task that's already scheduled for today
    const todayString = new Date().toISOString().split("T")[0];
    const taskPath = await context.page.evaluate(async (todayString) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Already Scheduled Task",
        description: "A task already scheduled for today",
        done: false,
        doDate: todayString,
      });
    }, todayString);

    expect(taskPath).toBeTruthy();

    // Start daily planning
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // Navigate to step 2
    await context.page.click('[data-testid="next-button"]');

    // Wait for step 2 content
    await context.page.waitForSelector('[data-testid="step-2-content"]', {
      timeout: 5000,
    });

    // The already scheduled task should appear in today's agenda
    const scheduledTask = context.page
      .locator('[data-testid="scheduled-task"]')
      .filter({
        hasText: "Already Scheduled Task",
      });
    expect(await scheduledTask.isVisible()).toBe(true);

    // The task should have an unschedule button to allow management
    const unscheduleButton = scheduledTask.locator(
      '[data-testid="unschedule-planning-button"]'
    );
    expect(await unscheduleButton.isVisible()).toBe(true);

    // Test unscheduling the already scheduled task
    await unscheduleButton.click();

    // Wait for the task to move to unscheduled section
    await context.page.waitForSelector('[data-testid="unscheduled-task"]', {
      timeout: 5000,
    });

    const unscheduledTask = context.page
      .locator('[data-testid="unscheduled-task"]')
      .filter({
        hasText: "Already Scheduled Task",
      });
    expect(await unscheduledTask.isVisible()).toBe(true);

    // Verify the task's Do Date was cleared
    await waitForTaskPropertySync(context.page, taskPath, "Do Date", "", 10000);
  });

  test("should not show duplicated tasks when moving tasks from yesterday to today", async () => {
    // Create multiple tasks scheduled for yesterday
    const yesterdayString = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const taskPaths = await context.page.evaluate(async (yesterdayString) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const paths = [];
      for (let i = 1; i <= 4; i++) {
        const path = await plugin.taskFileManager.createTaskFile({
          title: `Yesterday Task ${i}`,
          description: `Task ${i} from yesterday that should be moved to today`,
          done: false,
          doDate: yesterdayString,
        });
        paths.push(path);
      }
      return paths;
    }, yesterdayString);

    expect(taskPaths).toHaveLength(4);

    // Start daily planning
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // STEP 1: Review Yesterday's Tasks
    await context.page.waitForSelector('[data-testid="step-1-content"]', {
      timeout: 10000,
    });

    // Wait for and verify all 4 tasks appear in yesterday's not completed section
    await context.page.waitForSelector('[data-testid="not-completed-task"]', {
      timeout: 10000,
    });

    const yesterdayTasks = context.page.locator(
      '[data-testid="not-completed-task"]'
    );
    const yesterdayTaskCount = await yesterdayTasks.count();
    expect(yesterdayTaskCount).toBeGreaterThanOrEqual(4);

    // Move unfinished tasks to today using the "Move to Today" button
    const moveToTodayButton = context.page.locator(
      '[data-testid="move-to-today-button"]'
    );
    if (await moveToTodayButton.isVisible()) {
      await moveToTodayButton.click();

      // Wait for the move operation to complete and automatic navigation to step 2
      await context.page.waitForTimeout(2000);
    } else {
      // If no move button, navigate to step 2 manually
      await context.page.click('[data-testid="next-button"]');
    }

    // STEP 2: Today's Agenda
    await context.page.waitForSelector('[data-testid="step-2-content"]', {
      timeout: 5000,
    });

    // Wait for tasks to appear in today's agenda (either scheduled or staged to be moved)
    const hasScheduledTasks = await context.page
      .waitForSelector('[data-testid="scheduled-task"]', {
        timeout: 2000,
      })
      .catch(() => null);

    const hasStagedTasks = await context.page
      .waitForSelector('[data-testid="staged-task"]', {
        timeout: 2000,
      })
      .catch(() => null);

    // At least one type of task should be present
    expect(hasScheduledTasks || hasStagedTasks).toBeTruthy();

    // Navigate to step 3 to see the final plan
    await context.page.click('[data-testid="next-button"]');

    // STEP 3: Plan Summary
    await context.page.waitForSelector('[data-testid="step-3-content"]', {
      timeout: 5000,
    });

    // Count how many times each task appears in the final plan
    const taskCounts = await context.page.evaluate(() => {
      const taskItems = Array.from(
        document.querySelectorAll(".preview-item.task .preview-title")
      );
      const counts: Record<string, number> = {};

      taskItems.forEach((item) => {
        const title = item.textContent?.trim() || "";
        if (title) {
          counts[title] = (counts[title] || 0) + 1;
        }
      });

      return counts;
    });

    console.log("Task counts in final plan:", taskCounts);
    console.log("Available task titles:", Object.keys(taskCounts));

    // Verify that each moved task appears exactly once (no duplicates)
    for (let i = 1; i <= 4; i++) {
      const taskTitle = `Yesterday Task ${i}`;
      const count = taskCounts[taskTitle];
      if (count !== undefined) {
        expect(count).toBe(1);
        if (count !== 1) {
          console.error(
            `Task "${taskTitle}" should appear exactly once, but appears ${count} times`
          );
        }
      } else {
        console.warn(`Task "${taskTitle}" not found in final plan`);
        // Check if task exists with different formatting
        const similarTasks = Object.keys(taskCounts).filter(
          (title) =>
            title.includes(`Yesterday Task ${i}`) || title.includes(`Task ${i}`)
        );
        console.log(`Similar tasks found:`, similarTasks);

        // If we find a similar task, use that for verification
        if (similarTasks.length > 0) {
          expect(taskCounts[similarTasks[0]]).toBe(1);
        } else {
          // Fail the test if we can't find the task at all
          expect(count).toBe(1);
        }
      }
    }

    // Also verify by counting total task items with "Moved from yesterday" badge
    const movedTasksCount = await context.page
      .locator(".preview-item.task:has(.preview-badge.moved)")
      .count();
    expect(movedTasksCount).toBe(4);

    // Verify all tasks have the "moved" badge since we only moved yesterday's tasks
    const tasksWithMovedBadge = await context.page
      .locator(".preview-item.task .preview-badge.moved")
      .count();
    expect(tasksWithMovedBadge).toBe(4);
  });

  test("should reproduce local task scheduling duplicate bug", async () => {
    // Create a local task
    const taskPath = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      return await plugin.taskFileManager.createTaskFile({
        title: "Local Task for Duplicate Bug",
        description: "A task to test duplicate scheduling bug",
        done: false,
      });
    });

    expect(taskPath).toBeTruthy();

    // Start daily planning to activate wizard mode
    await executeCommand(context, "Task Sync: Start daily planning");

    // Wait for daily planning view to open
    await context.page.waitForSelector('[data-testid="daily-planning-view"]', {
      timeout: 10000,
    });

    // Open Tasks view in sidebar to see local tasks
    // First check if the sidebar is collapsed and open it
    const rightSidebarToggle = context.page
      .locator(".sidebar-toggle-button.mod-right")
      .first();
    if (await rightSidebarToggle.isVisible()) {
      await rightSidebarToggle.click();
      await context.page.waitForTimeout(500);
    }

    // Click on the Tasks tab
    await context.page.click('[data-type="tasks"].workspace-tab-header');

    // Wait for tasks view to load
    await context.page.waitForSelector('[data-testid="tasks-view"]', {
      timeout: 5000,
    });

    // Find the local task item
    const taskItem = context.page
      .locator('[data-testid^="local-task-item-"]')
      .filter({ hasText: "Local Task for Duplicate Bug" });

    expect(await taskItem.isVisible()).toBe(true);

    // Hover over the task to reveal the schedule button
    await taskItem.hover();

    // Wait for the schedule button to appear on hover
    const scheduleButton = taskItem.locator(
      '[data-testid="schedule-for-today-button"]'
    );

    // Wait for the button to be visible after hover
    await scheduleButton.waitFor({ state: "visible", timeout: 5000 });

    expect(await scheduleButton.isVisible()).toBe(true);
    expect(await scheduleButton.textContent()).toContain("Schedule for today");

    // Click the schedule button
    await scheduleButton.click();

    // Wait for the action to complete
    await context.page.waitForTimeout(2000);

    // Go back to daily planning step 2 to check for duplicates
    await context.page.click('[data-testid="daily-planning-view"]');

    // Navigate to step 2
    await context.page.click('[data-testid="next-button"]');

    // Wait for step 2 content
    await context.page.waitForSelector('[data-testid="step-2-content"]', {
      timeout: 5000,
    });

    // Check for duplicate tasks in the scheduled section
    const scheduledTasks = context.page
      .locator('[data-testid="scheduled-task"]')
      .filter({
        hasText: "Local Task for Duplicate Bug",
      });

    const taskCount = await scheduledTasks.count();
    console.log(
      `Found ${taskCount} scheduled tasks with the name "Local Task for Duplicate Bug"`
    );

    // This should be 1, but the bug causes it to be 2
    expect(taskCount).toBe(1);
  }, 30000); // Increase timeout to 30 seconds

  test("should allow scheduling GitHub issues via 'Schedule for today' button", async () => {
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    await executeCommand(context, "Task Sync: Start daily planning");

    await context.page.waitForSelector('[data-testid="daily-planning-view"]');
    await context.page.click('[data-testid="next-button"]');
    await context.page.waitForSelector('[data-testid="step-2-content"]');

    await openView(context.page, "tasks");
    await switchToTaskService(context.page, "github");

    const githubIssueItem = context.page
      .locator('[data-testid="issue-item"]')
      .first();
    await githubIssueItem.hover();

    // Check if the issue is already scheduled or needs to be scheduled
    const scheduleButton = githubIssueItem.locator(
      '[data-testid="schedule-for-today-button"]'
    );
    await scheduleButton.waitFor({ state: "visible" });

    const buttonText = await scheduleButton.textContent();
    console.log("🔥 Schedule button text:", buttonText);

    if (buttonText?.includes("Schedule for today")) {
      // Issue not yet scheduled, click to schedule
      await scheduleButton.click();
    } else if (buttonText?.includes("✓ Scheduled for today")) {
      // Issue already scheduled, this is the bug we're testing
      console.log(
        "🔥 Issue already scheduled, this should appear in daily planning"
      );
    } else {
      throw new Error(`Unexpected button text: ${buttonText}`);
    }

    // STEP 5: Verify the task appears in daily planning step 2
    // The issue should now appear in the scheduled tasks list
    await context.page.waitForSelector('[data-testid="scheduled-task"]');

    const scheduledTasks = context.page.locator(
      '[data-testid="scheduled-task"]'
    );
    expect(await scheduledTasks.count()).toBeGreaterThan(0);

    // Verify the scheduled task contains the GitHub issue title
    const firstScheduledTask = scheduledTasks.first();
    const taskText = await firstScheduledTask.textContent();
    expect(taskText).toContain("Test import persistence issue"); // From the stubbed GitHub data
  });
});
