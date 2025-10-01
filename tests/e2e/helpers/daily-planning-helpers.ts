/**
 * Helper functions for Daily Planning e2e tests
 * Provides reusable utilities for testing the Daily Planning Wizard
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { executeCommand } from "./global";
import { getTodayString, getYesterdayString } from "./date-helpers";

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
 * Create a test task file in the vault
 */
export async function createTestTask(
  page: Page,
  taskProps: TestTaskProps
): Promise<string> {
  return await page.evaluate(async (props) => {
    const app = (window as any).app;
    
    // Create Tasks folder if it doesn't exist
    const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
    if (!tasksFolder) {
      await app.vault.createFolder("Tasks");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `Tasks/${props.title.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.md`;
    
    // Build frontmatter
    const frontmatter = [
      "---",
      `Title: ${props.title}`,
      "Type: Task",
      `Status: ${props.status || "Not Started"}`,
      `Priority: ${props.priority || "Medium"}`,
      `Done: ${props.done || false}`,
    ];

    if (props.doDate) {
      frontmatter.push(`Do Date: ${props.doDate}`);
    }

    if (props.dueDate) {
      frontmatter.push(`Due Date: ${props.dueDate}`);
    }

    if (props.project) {
      frontmatter.push(`Project: ${props.project}`);
    }

    if (props.areas && props.areas.length > 0) {
      frontmatter.push(`Areas: [${props.areas.map(a => `"${a}"`).join(", ")}]`);
    }

    frontmatter.push("---");
    frontmatter.push("");
    frontmatter.push(props.description || `Test task: ${props.title}`);

    const content = frontmatter.join("\n");
    await app.vault.create(fileName, content);
    return fileName;
  }, taskProps);
}

/**
 * Create a task scheduled for yesterday
 */
export async function createYesterdayTask(
  page: Page,
  title: string,
  description?: string
): Promise<string> {
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
  page: Page,
  title: string,
  description?: string
): Promise<string> {
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
  page: Page,
  title: string,
  description?: string
): Promise<string> {
  return await createTestTask(page, {
    title,
    description: description || `An unscheduled task: ${title}`,
    done: false,
  });
}

/**
 * Start the Daily Planning Wizard
 */
export async function startDailyPlanning(page: Page): Promise<void> {
  await executeCommand(page, "Task Sync: Start Daily Planning");
  
  // Wait for daily planning view to open
  await expect(page.locator('[data-testid="daily-planning-view"]')).toBeVisible({
    timeout: 10000,
  });
}

/**
 * Navigate to a specific step in the Daily Planning Wizard
 */
export async function navigateToStep(page: Page, stepNumber: 1 | 2 | 3): Promise<void> {
  // Start from step 1 and navigate forward
  for (let i = 1; i < stepNumber; i++) {
    await page.click('[data-testid="next-button"]');
    await page.waitForTimeout(500);
  }
  
  // Verify we're on the correct step
  await expect(page.locator(`[data-testid="step-${stepNumber}-content"]`)).toBeVisible();
}

/**
 * Wait for tasks to appear in the current step
 */
export async function waitForTasksToLoad(page: Page, timeout: number = 5000): Promise<void> {
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
export async function moveYesterdayTasksToToday(page: Page): Promise<void> {
  const moveToTodayButton = page.locator('[data-testid="move-to-today-button"]');
  
  if (await moveToTodayButton.isVisible()) {
    await moveToTodayButton.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Confirm the daily plan (Step 3)
 */
export async function confirmDailyPlan(page: Page): Promise<void> {
  const confirmButton = page.locator('[data-testid="confirm-button"]');
  
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
    await page.waitForTimeout(2000);
  }
}

/**
 * Verify that a task appears in the current step
 */
export async function verifyTaskVisible(page: Page, taskTitle: string): Promise<void> {
  await expect(page.locator(`text=${taskTitle}`)).toBeVisible();
}

/**
 * Verify that multiple tasks appear in the current step
 */
export async function verifyTasksVisible(page: Page, taskTitles: string[]): Promise<void> {
  for (const title of taskTitles) {
    await verifyTaskVisible(page, title);
  }
}

/**
 * Count the number of tasks in a specific section
 */
export async function countTasksInSection(
  page: Page,
  sectionTestId: string
): Promise<number> {
  const tasks = page.locator(`[data-testid="${sectionTestId}"]`);
  return await tasks.count();
}

/**
 * Setup Apple Calendar API stubs for consistent testing
 */
export async function setupAppleCalendarStubs(page: Page): Promise<void> {
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
  page: Page,
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
  page: Page,
  count: number,
  taskType: "yesterday" | "today" | "unscheduled" = "today"
): Promise<string[]> {
  const taskPaths: string[] = [];
  
  for (let i = 1; i <= count; i++) {
    let taskPath: string;
    
    switch (taskType) {
      case "yesterday":
        taskPath = await createYesterdayTask(page, `Yesterday Task ${i}`);
        break;
      case "today":
        taskPath = await createTodayTask(page, `Today Task ${i}`);
        break;
      case "unscheduled":
        taskPath = await createUnscheduledTask(page, `Unscheduled Task ${i}`);
        break;
    }
    
    taskPaths.push(taskPath);
  }
  
  return taskPaths;
}
