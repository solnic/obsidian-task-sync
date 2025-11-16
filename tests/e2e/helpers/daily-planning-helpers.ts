/**
 * Helper functions for Daily Planning e2e tests
 * Provides reusable utilities for testing the Daily Planning Wizard
 */

import { expect } from "@playwright/test";
import { executeCommand, type ExtendedPage } from "./global";
import { getTodayString, getYesterdayString } from "./date-helpers";
import { createTask } from "./entity-helpers";

/**
 * Interface for creating test tasks
 */
export interface TestTaskProps {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  done?: boolean;
  doDate?: string;
  dueDate?: string;
  project?: string;
  areas?: string[];
}

/**
 * Create a test task using the proper entity creation helper
 */
export async function createTestTask(
  page: ExtendedPage,
  taskProps: TestTaskProps
): Promise<any> {
  // Convert TestTaskProps to the format expected by createTask
  const task = await createTask(page, {
    title: taskProps.title,
    description: taskProps.description,
    status: taskProps.status || "Not Started",
    priority: taskProps.priority || "Medium",
    done: taskProps.done || false,
    dueDate: taskProps.doDate || taskProps.dueDate,
    project: taskProps.project,
    areas: taskProps.areas,
  });

  return task;
}

/**
 * Create a task scheduled for yesterday
 */
export async function createYesterdayTask(
  page: ExtendedPage,
  title: string,
  description?: string
): Promise<any> {
  return await createTestTask(page, {
    title,
    description: description || `A task scheduled for yesterday: ${title}`,
    doDate: getYesterdayString(),
    done: false,
  });
}

/**
 * Create a task scheduled for today
 */
export async function createTodayTask(
  page: ExtendedPage,
  title: string,
  description?: string
): Promise<any> {
  return await createTestTask(page, {
    title,
    description: description || `A task scheduled for today: ${title}`,
    doDate: getTodayString(),
    done: false,
  });
}

/**
 * Create an unscheduled task
 */
export async function createUnscheduledTask(
  page: ExtendedPage,
  title: string,
  description?: string
): Promise<any> {
  return await createTestTask(page, {
    title,
    description: description || `An unscheduled task: ${title}`,
    done: false,
  });
}

/**
 * Start the Daily Planning Wizard
 */
export async function startDailyPlanning(page: ExtendedPage): Promise<void> {
  await executeCommand(page, "Task Sync: Start Daily Planning");

  // Wait for daily planning view to open
  await expect(page.locator('[data-testid="daily-planning-view"]')).toBeVisible(
    {
      timeout: 10000,
    }
  );
}

/**
 * Navigate to a specific step in the Daily Planning Wizard
 */
export async function navigateToStep(
  page: ExtendedPage,
  stepNumber: 1 | 2 | 3
): Promise<void> {
  // Start from step 1 and navigate forward
  for (let i = 1; i < stepNumber; i++) {
    await page.click('[data-testid="next-button"]');
    
    // Wait for next step to become visible
    await page.waitForFunction(
      (nextStep) => {
        const stepContent = document.querySelector(`[data-testid="step-${nextStep}-content"]`);
        return stepContent && (stepContent as HTMLElement).offsetParent !== null;
      },
      i + 1,
      { timeout: 2000, polling: 100 }
    );
  }

  // Verify we're on the correct step
  await expect(
    page.locator(`[data-testid="step-${stepNumber}-content"]`)
  ).toBeVisible();
}

/**
 * Wait for tasks to appear in the current step
 */
export async function waitForTasksToLoad(
  page: ExtendedPage,
  timeout: number = 5000
): Promise<void> {
  // Wait for any task-related elements to appear
  try {
    await page.waitForSelector(
      '[data-testid*="task"], .task-item, .preview-item',
      { timeout }
    );
  } catch (error) {
    // Tasks might not exist, which is fine for some tests
    console.log("No tasks found, continuing...");
  }
}

/**
 * Move yesterday's tasks to today (Step 1)
 */
export async function moveYesterdayTasksToToday(
  page: ExtendedPage
): Promise<void> {
  const moveToTodayButton = page.locator(
    '[data-testid="move-to-today-button"]'
  );

  if (await moveToTodayButton.isVisible()) {
    await moveToTodayButton.click();
    
    // Wait for the move operation to complete
    await page
      .waitForFunction(
        () => {
          const button = document.querySelector('[data-testid="move-to-today-button"]');
          return !button || (button as HTMLButtonElement).disabled;
        },
        {},
        { timeout: 3000, polling: 100 }
      )
      .catch(() => {
        // Button might have been removed or operation completed instantly
      });
  }
}

/**
 * Confirm the daily plan (Step 3)
 */
export async function confirmDailyPlan(page: ExtendedPage): Promise<void> {
  const confirmButton = page.locator('[data-testid="confirm-button"]');

  if (await confirmButton.isVisible()) {
    await confirmButton.click();
    
    // Wait for the confirmation to complete by checking if wizard closes
    await page
      .waitForFunction(
        () => {
          const wizard = document.querySelector('[data-testid="daily-planning-view"]');
          return wizard === null || (wizard as HTMLElement).offsetParent === null;
        },
        {},
        { timeout: 5000, polling: 100 }
      )
      .catch(() => {
        // Wizard might still be visible, which is okay for some tests
      });
  }
}

/**
 * Verify that a task appears in the current step
 */
export async function verifyTaskVisible(
  page: ExtendedPage,
  taskTitle: string
): Promise<void> {
  await expect(page.locator(`text=${taskTitle}`)).toBeVisible();
}

/**
 * Verify that multiple tasks appear in the current step
 */
export async function verifyTasksVisible(
  page: ExtendedPage,
  taskTitles: string[]
): Promise<void> {
  for (const title of taskTitles) {
    await verifyTaskVisible(page, title);
  }
}

/**
 * Count the number of tasks in a specific section
 */
export async function countTasksInSection(
  page: ExtendedPage,
  sectionTestId: string
): Promise<number> {
  const tasks = page.locator(`[data-testid="${sectionTestId}"]`);
  return await tasks.count();
}

/**
 * Setup Apple Calendar API stubs for consistent testing
 */
export async function setupAppleCalendarStubs(
  page: ExtendedPage
): Promise<void> {
  await page.evaluate(() => {
    // Mock Apple Calendar service to return empty events
    (window as any).mockAppleCalendarService = {
      getEventsForDate: () => Promise.resolve([]),
      getCalendars: () => Promise.resolve([]),
      checkPermissions: () => Promise.resolve({ granted: true }),
    };
  });
}

/**
 * Complete the full Daily Planning workflow
 */
export async function completeDailyPlanningWorkflow(
  page: ExtendedPage,
  options: {
    moveYesterdayTasks?: boolean;
    confirmPlan?: boolean;
  } = {}
): Promise<void> {
  // Start daily planning
  await startDailyPlanning(page);

  // Step 1: Review Yesterday's Tasks
  await expect(page.locator('[data-testid="step-1-content"]')).toBeVisible();

  if (options.moveYesterdayTasks) {
    await moveYesterdayTasksToToday(page);
  }

  await navigateToStep(page, 2);

  // Step 2: Today's Agenda
  await expect(page.locator('[data-testid="step-2-content"]')).toBeVisible();
  await waitForTasksToLoad(page);

  await navigateToStep(page, 3);

  // Step 3: Plan Summary
  await expect(page.locator('[data-testid="step-3-content"]')).toBeVisible();

  if (options.confirmPlan) {
    await confirmDailyPlan(page);
  }
}

/**
 * Create multiple test tasks for comprehensive testing
 */
export async function createMultipleTestTasks(
  page: ExtendedPage,
  count: number,
  taskCategory: "yesterday" | "today" | "unscheduled" = "today"
): Promise<any[]> {
  const tasks: any[] = [];

  for (let i = 1; i <= count; i++) {
    let task: any;

    switch (taskCategory) {
      case "yesterday":
        task = await createYesterdayTask(page, `Yesterday Task ${i}`);
        break;
      case "today":
        task = await createTodayTask(page, `Today Task ${i}`);
        break;
      case "unscheduled":
        task = await createUnscheduledTask(page, `Unscheduled Task ${i}`);
        break;
    }

    tasks.push(task);
  }

  return tasks;
}
