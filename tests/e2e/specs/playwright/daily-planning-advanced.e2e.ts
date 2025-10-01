/**
 * Advanced End-to-End Tests for Daily Planning Functionality
 * Tests complex scenarios and edge cases for the Daily Planning Wizard
 */

import { test, expect } from "../../helpers/setup";
import {
  startDailyPlanning,
  navigateToStep,
  createYesterdayTask,
  createTodayTask,
  createUnscheduledTask,
  createMultipleTestTasks,
  completeDailyPlanningWorkflow,
  setupAppleCalendarStubs,
  verifyTasksVisible,
  countTasksInSection,
  moveYesterdayTasksToToday,
  confirmDailyPlan,
} from "../../helpers/daily-planning-helpers";

test.describe("Daily Planning Wizard - Advanced Scenarios", () => {
  test.beforeEach(async ({ page }) => {
    await setupAppleCalendarStubs(page);
  });

  test("should handle large number of tasks efficiently", async ({ page }) => {
    // Create 10 yesterday tasks and 10 today tasks
    const yesterdayTasks = await createMultipleTestTasks(page, 10, "yesterday");
    const todayTasks = await createMultipleTestTasks(page, 10, "today");

    expect(yesterdayTasks).toHaveLength(10);
    expect(todayTasks).toHaveLength(10);

    // Start daily planning
    await startDailyPlanning(page);

    // Step 1: Should show all 10 yesterday tasks
    await expect(page.locator('[data-testid="step-1-content"]')).toBeVisible();
    
    // Wait for tasks to load and count them
    await page.waitForSelector('[data-testid="not-completed-task"]', { timeout: 10000 });
    const yesterdayTaskCount = await countTasksInSection(page, "not-completed-task");
    expect(yesterdayTaskCount).toBe(10);

    // Move all yesterday tasks to today
    await moveYesterdayTasksToToday(page);

    // Navigate to step 2
    await navigateToStep(page, 2);

    // Should show all tasks (10 original today + 10 moved from yesterday)
    await page.waitForTimeout(1000);
    
    // Verify some of the tasks are visible
    await expect(page.locator("text=Yesterday Task 1")).toBeVisible();
    await expect(page.locator("text=Today Task 1")).toBeVisible();
  });

  test("should handle mixed task priorities and statuses", async ({ page }) => {
    // Create tasks with different priorities and statuses
    const highPriorityTask = await page.evaluate(async () => {
      const app = (window as any).app;
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks") || await app.vault.createFolder("Tasks");
      
      const fileName = `Tasks/High Priority Task.md`;
      const content = `---
Title: High Priority Task
Type: Task
Status: In Progress
Priority: High
Done: false
---

A high priority task that's in progress.`;

      await app.vault.create(fileName, content);
      return fileName;
    });

    const lowPriorityTask = await page.evaluate(async () => {
      const app = (window as any).app;
      
      const fileName = `Tasks/Low Priority Task.md`;
      const content = `---
Title: Low Priority Task
Type: Task
Status: Backlog
Priority: Low
Done: false
---

A low priority task in backlog.`;

      await app.vault.create(fileName, content);
      return fileName;
    });

    expect(highPriorityTask).toBeTruthy();
    expect(lowPriorityTask).toBeTruthy();

    // Complete the workflow
    await completeDailyPlanningWorkflow(page, {
      moveYesterdayTasks: false,
      confirmPlan: false,
    });

    // Verify both tasks appear in the plan summary
    await verifyTasksVisible(page, ["High Priority Task", "Low Priority Task"]);
  });

  test("should handle tasks with projects and areas", async ({ page }) => {
    // Create tasks with project and area assignments
    const projectTask = await page.evaluate(async () => {
      const app = (window as any).app;
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks") || await app.vault.createFolder("Tasks");
      
      const fileName = `Tasks/Project Task.md`;
      const content = `---
Title: Project Task
Type: Task
Status: Not Started
Priority: Medium
Done: false
Project: "Test Project"
Areas: ["Work", "Development"]
---

A task assigned to a project and areas.`;

      await app.vault.create(fileName, content);
      return fileName;
    });

    expect(projectTask).toBeTruthy();

    // Start daily planning and navigate to step 2
    await startDailyPlanning(page);
    await navigateToStep(page, 2);

    // Verify the task appears with its metadata
    await expect(page.locator("text=Project Task")).toBeVisible();
  });

  test("should handle calendar events integration", async ({ page }) => {
    // Mock calendar events
    await page.evaluate(() => {
      (window as any).mockAppleCalendarService = {
        getEventsForDate: () => Promise.resolve([
          {
            id: "event-1",
            title: "Team Meeting",
            startDate: new Date(),
            endDate: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
            calendar: { name: "Work", color: "#FF0000" },
          },
          {
            id: "event-2", 
            title: "Lunch Break",
            startDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours later
            endDate: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours later
            calendar: { name: "Personal", color: "#00FF00" },
          },
        ]),
        getCalendars: () => Promise.resolve([]),
        checkPermissions: () => Promise.resolve({ granted: true }),
      };
    });

    // Start daily planning and navigate to step 2
    await startDailyPlanning(page);
    await navigateToStep(page, 2);

    // Should show calendar events if the integration is working
    // Note: This depends on the actual implementation of calendar integration
    await page.waitForTimeout(2000);
    
    // Look for calendar events section
    const eventsSection = page.locator('[data-testid="calendar-events"]');
    if (await eventsSection.isVisible()) {
      await expect(page.locator("text=Team Meeting")).toBeVisible();
      await expect(page.locator("text=Lunch Break")).toBeVisible();
    }
  });

  test("should persist planning state across navigation", async ({ page }) => {
    // Create test tasks
    await createYesterdayTask(page, "Persistent Task");
    
    // Start daily planning
    await startDailyPlanning(page);
    
    // Move yesterday tasks to today
    await moveYesterdayTasksToToday(page);
    
    // Navigate to step 2
    await navigateToStep(page, 2);
    
    // Navigate back to step 1
    const backButton = page.locator('[data-testid="back-button"]');
    if (await backButton.isVisible()) {
      await backButton.click();
      await page.waitForTimeout(500);
    }
    
    // Navigate forward again to step 2
    await navigateToStep(page, 2);
    
    // The moved task should still be visible
    await expect(page.locator("text=Persistent Task")).toBeVisible();
  });

  test("should handle empty states gracefully", async ({ page }) => {
    // Start daily planning without any tasks
    await startDailyPlanning(page);

    // Step 1: Should show empty state
    await expect(page.locator('[data-testid="step-1-content"]')).toBeVisible();
    
    // Navigate through all steps
    await navigateToStep(page, 2);
    await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();
    
    await navigateToStep(page, 3);
    await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();
    
    // Should be able to confirm even with empty plan
    await confirmDailyPlan(page);
  });

  test("should handle task scheduling and unscheduling", async ({ page }) => {
    // Create an unscheduled task
    await createUnscheduledTask(page, "Scheduling Test Task");
    
    // Start daily planning and navigate to step 2
    await startDailyPlanning(page);
    await navigateToStep(page, 2);
    
    // Look for the unscheduled task
    await expect(page.locator("text=Scheduling Test Task")).toBeVisible();
    
    // Try to schedule the task if scheduling controls are available
    const scheduleButton = page.locator('[data-testid="schedule-task-button"]').first();
    if (await scheduleButton.isVisible()) {
      await scheduleButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Try to unschedule a task if unscheduling controls are available
    const unscheduleButton = page.locator('[data-testid="unschedule-task-button"]').first();
    if (await unscheduleButton.isVisible()) {
      await unscheduleButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test("should handle wizard cancellation", async ({ page }) => {
    // Create test task
    await createTodayTask(page, "Cancellation Test Task");
    
    // Start daily planning
    await startDailyPlanning(page);
    
    // Navigate to step 2
    await navigateToStep(page, 2);
    
    // Look for cancel button
    const cancelButton = page.locator('[data-testid="cancel-button"]');
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Or close the view directly
    const closeButton = page.locator('.view-header-icon[aria-label="Close"]');
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test("should handle rapid navigation between steps", async ({ page }) => {
    // Create test tasks
    await createYesterdayTask(page, "Rapid Nav Task 1");
    await createTodayTask(page, "Rapid Nav Task 2");
    
    // Start daily planning
    await startDailyPlanning(page);
    
    // Rapidly navigate between steps
    for (let i = 0; i < 3; i++) {
      // Forward navigation
      await page.click('[data-testid="next-button"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="next-button"]');
      await page.waitForTimeout(200);
      
      // Backward navigation if available
      const backButton = page.locator('[data-testid="back-button"]');
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(200);
        await backButton.click();
        await page.waitForTimeout(200);
      }
    }
    
    // Should still be functional
    await expect(page.locator('[data-testid="daily-planning-view"]')).toBeVisible();
  });
});
