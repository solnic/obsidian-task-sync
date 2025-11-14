/**
 * E2E Test Helpers for TasksView functionality
 * Provides helpers for testing the new TasksView component and its features
 */

import type { Page } from "playwright";
import { expect } from "@playwright/test";

/**
 * Open the Tasks view using the command palette
 */
export async function openTasksView(page: Page): Promise<void> {
  // Execute the command to open Tasks view
  await page.evaluate(async () => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    if (!plugin) {
      throw new Error("Task Sync plugin not found");
    }

    await plugin.activateView();
  });

  // Wait for the Tasks view to be visible
  await page.waitForSelector('[data-testid="tasks-view"]', {
    state: "visible",
    timeout: 5000,
  });
}

/**
 * Wait for local tasks to load in the TasksView
 */
export async function waitForLocalTasksToLoad(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  // Click on the local service tab to make it visible (context tab is default)
  const localServiceButton = page.locator('[data-testid="service-local"]');
  await localServiceButton.click();

  // Wait for the local tasks service to be visible
  await page.waitForSelector('[data-testid="local-service"]', {
    state: "visible",
    timeout,
  });

  // Wait for either task items to appear or empty state to show
  await page.waitForFunction(
    () => {
      const taskItems = document.querySelectorAll(
        '[data-testid^="local-task-item-"]'
      );
      const emptyState = document.querySelector(".task-sync-empty-message");
      return taskItems.length > 0 || emptyState !== null;
    },
    { timeout }
  );
}

/**
 * Get all visible task items in the local tasks view
 */
export async function getVisibleTaskItems(page: Page): Promise<any[]> {
  return await page.locator('[data-testid^="local-task-item-"]').all();
}

/**
 * Search for tasks using the search input
 */
export async function searchTasks(
  page: Page,
  searchTerm: string
): Promise<void> {
  const searchInput = page.locator('[data-testid="task-sync-search-input"]');
  await searchInput.fill(searchTerm);

  // Wait for search to be applied by checking if the search input value matches
  await page.waitForFunction(
    (term) => {
      const input = document.querySelector(
        '[data-testid="task-sync-search-input"]'
      ) as HTMLInputElement;
      return input && input.value === term;
    },
    searchTerm,
    { timeout: 3000 }
  );
}

/**
 * Clear the search input
 */
export async function clearSearch(page: Page): Promise<void> {
  const searchInput = page.locator('[data-testid="task-sync-search-input"]');
  await searchInput.clear();

  // Wait for search to be cleared by checking if the input is empty
  await page.waitForFunction(
    () => {
      const input = document.querySelector(
        '[data-testid="task-sync-search-input"]'
      ) as HTMLInputElement;
      return input && input.value === "";
    },
    undefined,
    { timeout: 3000 }
  );
}

/**
 * Click the refresh button in the search input
 */
export async function refreshTasks(page: Page): Promise<void> {
  const refreshButton = page.locator(
    '[data-testid="task-sync-local-refresh-button"]'
  );
  await refreshButton.click();
  // Refresh is expected to be instant; no need to wait for UI state changes
}

/**
 * Filter tasks by a specific property
 */
export async function filterTasks(
  page: Page,
  filterType: string,
  filterValue: string
): Promise<void> {
  // Map old filter types to new test IDs
  const filterTestIdMap: Record<string, string> = {
    category: "source-filter", // Category filtering is now done via source
    priority: "project-filter", // Priority filtering is not directly available, using project as fallback
    status: "source-filter", // Status filtering is not directly available, using source as fallback
    area: "area-filter",
    project: "project-filter",
    source: "source-filter",
  };

  const testId = filterTestIdMap[filterType] || `${filterType}-filter`;

  // Click the filter button
  const filterButton = page.locator(`[data-testid="${testId}"]`);
  await filterButton.click();

  // Wait for dropdown to appear
  await page.waitForSelector(".task-sync-selector-menu", { state: "visible" });

  // Click the filter value
  const filterOption = page.locator(
    `.task-sync-selector-menu .task-sync-selector-item:has-text("${filterValue}")`
  );
  await filterOption.click();

  // Wait for filtering to be applied by checking if dropdown is closed
  await page.waitForFunction(
    () => {
      const dropdown = document.querySelector(".task-sync-selector-menu");
      return !dropdown || getComputedStyle(dropdown).display === "none";
    },
    undefined,
    { timeout: 3000 }
  );
}

/**
 * Clear all filters
 */
export async function clearAllFilters(page: Page): Promise<void> {
  // First clear search filter if it exists
  await clearSearch(page);

  // Keep clicking clear buttons until none remain
  // Re-query after each click to avoid stale element references
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const clearButtons = page.locator(".filter-clear-button");
    const count = await clearButtons.count();

    if (count === 0) {
      break; // All filters cleared
    }

    // Click the first clear button (always index 0 since we re-query)
    await clearButtons.first().click();

    // Wait for the button to actually disappear using waitForFunction
    await page
      .waitForFunction(
        (previousCount) => {
          const buttons = document.querySelectorAll(".filter-clear-button");
          return buttons.length < previousCount;
        },
        count,
        { timeout: 1000, polling: 50 }
      )
      .catch(() => {
        // Button might have been removed instantly
      });

    attempts++;
  }

  // Final verification: no clear buttons should remain
  await page.waitForFunction(
    () => {
      const buttons = document.querySelectorAll(".filter-clear-button");
      return buttons.length === 0;
    },
    {},
    { timeout: 3000 }
  );
}

/**
 * Open the sort dropdown (for testing sort UI)
 */
export async function openSortDropdown(page: Page): Promise<void> {
  // Click the sort dropdown
  const sortButton = page.locator('[data-testid="local-tasks-sort"]');
  await sortButton.click();

  // Wait for dropdown to appear
  await page.waitForSelector(".task-sync-sort-menu", { state: "visible" });
}

/**
 * Close the sort dropdown
 */
export async function closeSortDropdown(page: Page): Promise<void> {
  // Click the sort button again to close the dropdown
  const sortButton = page.locator('[data-testid="local-tasks-sort"]');
  await sortButton.click();

  // Wait for dropdown to disappear
  await page.waitForSelector(".task-sync-sort-menu", { state: "hidden" });
}

/**
 * Get task item by title
 * Uses exact title matching on the .task-sync-item-title element to avoid partial matches
 */
export async function getTaskItemByTitle(
  page: Page,
  title: string
): Promise<any> {
  // Generate the test ID from the title (same logic as LocalTasksService.svelte)
  const testId = `local-task-item-${title.replace(/\s+/g, "-").toLowerCase()}`;

  // Check if the test ID contains special characters that would make it invalid as a CSS selector
  // If so, fall back to searching by title text content
  const hasSpecialChars = /[^\w\-]/.test(testId);

  if (hasSpecialChars) {
    // Fall back to searching by title text content for titles with special characters
    await page.waitForSelector('[data-testid^="local-task-item-"]', {
      timeout: 5000,
    });

    const taskItems = await page
      .locator('[data-testid^="local-task-item-"]')
      .all();

    for (const item of taskItems) {
      // Look for the title element specifically and check for exact match
      const titleElement = item.locator(".task-sync-item-title");
      const titleText = await titleElement.textContent();

      // Use exact match (trim whitespace for comparison)
      if (titleText && titleText.trim() === title.trim()) {
        return item;
      }
    }

    throw new Error(
      `Task item with title "${title}" not found (searched ${taskItems.length} items)`
    );
  }

  // For simple titles, use the test ID for faster, more reliable lookup
  await page.waitForSelector(`[data-testid="${testId}"]`, {
    state: "visible",
    timeout: 5000,
  });

  // Return the locator for the specific task
  return page.locator(`[data-testid="${testId}"]`);
}

/**
 * Hover over a task item to show action buttons
 */
export async function hoverTaskItem(page: Page, title: string): Promise<void> {
  const taskItem = await getTaskItemByTitle(page, title);
  await taskItem.hover();

  // Wait for hover effects to appear by checking for hover state
  await page.waitForFunction(
    (taskTitle) => {
      const taskElement = Array.from(
        document.querySelectorAll('[data-testid^="local-task-item-"]')
      ).find((el) => el.textContent?.includes(taskTitle));
      return taskElement && taskElement.matches(":hover");
    },
    title,
    { timeout: 2000 }
  );
}

/**
 * Click the "Open" button on a task item
 */
export async function openTaskItem(page: Page, title: string): Promise<void> {
  await hoverTaskItem(page, title);

  const taskItem = await getTaskItemByTitle(page, title);
  const openButton = taskItem.locator('[data-testid="open-task-button"]');
  await openButton.click();
}

/**
 * Verify that a task item has specific badges
 */
export async function verifyTaskBadges(
  page: Page,
  title: string,
  expectedBadges: string[]
): Promise<void> {
  const taskItem = await getTaskItemByTitle(page, title);

  for (const badge of expectedBadges) {
    // Look for badge labels within the badge components (main badges)
    // or location values in footer (for areas)
    const badgeElement = taskItem.locator(
      `.task-sync-badge-label:has-text("${badge}"), .task-sync-location-value:has-text("${badge}")`
    );
    await expect(badgeElement).toBeVisible();
  }
}

/**
 * Verify that the empty state is shown
 */
export async function verifyEmptyState(
  page: Page,
  expectedMessage?: string
): Promise<void> {
  const emptyState = page.locator(".task-sync-empty-message");
  await expect(emptyState).toBeVisible();

  if (expectedMessage) {
    await expect(emptyState).toContainText(expectedMessage);
  }
}

/**
 * Verify that a specific number of tasks are visible
 */
export async function verifyTaskCount(
  page: Page,
  expectedCount: number
): Promise<void> {
  const taskItems = page.locator('[data-testid^="local-task-item-"]');
  await expect(taskItems).toHaveCount(expectedCount);
}

/**
 * Wait for task items to be filtered to a specific count
 */
export async function waitForFilteredTaskCount(
  page: Page,
  expectedCount: number,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    (count) => {
      const visibleTasks = Array.from(
        document.querySelectorAll('[data-testid^="local-task-item-"]')
      ).filter((task) => (task as HTMLElement).offsetParent !== null);
      return visibleTasks.length === count;
    },
    expectedCount,
    { timeout }
  );
}

/**
 * Create a test task using the new entity system
 * Note: This function creates the task but does NOT wait for it to appear in the UI.
 * If you need to verify the task appears in the UI, call waitForLocalTasksToLoad() first
 * to ensure the Local Tasks tab is active, then use getTaskItemByTitle() or similar.
 */
export async function createTestTask(
  page: Page,
  props: {
    title: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    areas?: string[];
    project?: string;
  }
): Promise<void> {
  await page.evaluate(async (taskProps) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    // Use plugin operations which will properly set the source
    await plugin.operations.task.create({
      title: taskProps.title,
      description: taskProps.description || "",
      category: taskProps.category || "Feature",
      priority: taskProps.priority || "Medium",
      status: taskProps.status || "Backlog",
      done: false,
      areas: taskProps.areas || [],
      project: taskProps.project,
      tags: [],
      doDate: undefined,
      dueDate: undefined,
      parentTask: undefined,
    });
  }, props);

  // Note: We no longer wait for UI elements here because:
  // 1. The view might not be open yet
  // 2. The Context tab might be active instead of Local Tasks tab
  // Tests should explicitly switch to Local Tasks tab using waitForLocalTasksToLoad()
  // before trying to interact with task UI elements
}

/**
 * Create a task file directly and add it to the store
 * This is useful for tests that need to create files with specific content
 * Note: This function creates the task file but does NOT wait for it to appear in the UI.
 * If you need to verify the task appears in the UI, call waitForLocalTasksToLoad() first
 * to ensure the Local Tasks tab is active, then use getTaskItemByTitle() or similar.
 */
export async function createTaskFileAndAddToStore(
  page: Page,
  fileName: string,
  content: string,
  taskProps: {
    title: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    areas?: string[];
    project?: string;
  }
): Promise<void> {
  await page.evaluate(
    async ({ fileName, content }) => {
      const app = (window as any).app;

      // Ensure Tasks folder exists
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create the file
      await app.vault.create(fileName, content);

      // Trigger a refresh to pick up the new file
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        await plugin.host.getExtensionById("obsidian")?.refresh();
      }
    },
    { fileName, content }
  );

  // Note: We no longer wait for UI elements here because:
  // 1. The view might not be open yet
  // 2. The Context tab might be active instead of Local Tasks tab
  // Tests should explicitly switch to Local Tasks tab using waitForLocalTasksToLoad()
  // before trying to interact with task UI elements
}
