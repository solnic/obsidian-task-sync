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
  // Wait for the local tasks service to be visible
  await page.waitForSelector('[data-testid="local-tasks-service"]', {
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
  const searchInput = page.locator('[data-testid="local-search-input"]');
  await searchInput.fill(searchTerm);

  // Wait for search to be applied by checking if the search input value matches
  await page.waitForFunction(
    (term) => {
      const input = document.querySelector(
        '[data-testid="local-search-input"]'
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
  const searchInput = page.locator('[data-testid="local-search-input"]');
  await searchInput.clear();

  // Wait for search to be cleared by checking if the input is empty
  await page.waitForFunction(
    () => {
      const input = document.querySelector(
        '[data-testid="local-search-input"]'
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
  const refreshButton = page.locator('[data-testid="local-refresh-button"]');
  await refreshButton.click();

  // Wait for refresh to complete by waiting for loading state to finish
  await page.waitForFunction(
    () => {
      const loadingIndicator = document.querySelector(
        '[data-testid="loading-indicator"]'
      );
      return (
        !loadingIndicator ||
        loadingIndicator.getAttribute("aria-hidden") === "true"
      );
    },
    undefined,
    { timeout: 5000 }
  );
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

  // Look for clear filter buttons (×) and click them
  const clearButtons = page.locator(".filter-clear-button");
  const count = await clearButtons.count();

  for (let i = count - 1; i >= 0; i--) {
    // Click from last to first to avoid index shifting issues
    await clearButtons.nth(i).click();
    // Wait a bit for the filter to be cleared
    await page.waitForTimeout(200);
  }

  // Wait for all filters to be cleared by checking that no clear buttons remain
  await page.waitForFunction(
    () => {
      const buttons = document.querySelectorAll(".filter-clear-button");
      return buttons.length === 0;
    },
    undefined,
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
 */
export async function getTaskItemByTitle(
  page: Page,
  title: string
): Promise<any> {
  const taskItems = await page
    .locator('[data-testid^="local-task-item-"]')
    .all();

  for (const item of taskItems) {
    const text = await item.textContent();
    if (text && text.includes(title)) {
      return item;
    }
  }

  throw new Error(`Task item with title "${title}" not found`);
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
    // For now, create task files directly and manually add to store
    // This is a temporary solution until we have proper vault scanning
    const app = (window as any).app;

    // Create task file directly using Obsidian's vault API
    const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
    if (!tasksFolder) {
      await app.vault.createFolder("Tasks");
    }

    const frontMatter = {
      Title: taskProps.title,
      Type: "Task",
      Category: taskProps.category || "Feature",
      Priority: taskProps.priority || "Medium",
      Status: taskProps.status || "Backlog",
      Done: false,
      ...(taskProps.areas && { Areas: taskProps.areas }),
      ...(taskProps.project && { Project: taskProps.project }),
    };

    const frontMatterString = Object.entries(frontMatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`;
        }
        return `${key}: ${typeof value === "string" ? `"${value}"` : value}`;
      })
      .join("\n");

    const content = `---
${frontMatterString}
---

${taskProps.description || ""}`;

    // Sanitize the title for use as a filename
    const sanitizedTitle = taskProps.title
      .replace(/[/\\:*?"<>|]/g, "-") // Replace invalid filename characters with dashes
      .replace(/\s+/g, "-") // Replace spaces with dashes
      .toLowerCase();

    const filePath = `Tasks/${sanitizedTitle}.md`;
    await app.vault.create(filePath, content);

    // Manually add to task store for testing
    // Access the taskStore through the plugin's stores getter
    const plugin = app.plugins.plugins["obsidian-task-sync"];
    if (plugin && plugin.stores && plugin.stores.taskStore) {
      const { taskStore } = plugin.stores;
      const task = {
        id: `task-${Date.now()}`,
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
        source: {
          extension: "obsidian",
          filePath: filePath, // Use the actual file path
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      taskStore.addTask(task);
    }
  }, props);

  // Wait for the task to be created and stores to refresh by checking if task appears
  await page.waitForFunction(
    (taskTitle) => {
      const taskElements = document.querySelectorAll(
        '[data-testid^="local-task-item-"]'
      );
      return Array.from(taskElements).some((el) =>
        el.textContent?.includes(taskTitle)
      );
    },
    props.title,
    { timeout: 5000 }
  );
}

/**
 * Create a task file directly and add it to the store
 * This is useful for tests that need to create files with specific content
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
    async ({ fileName, content, taskProps }) => {
      const app = (window as any).app;

      // Ensure Tasks folder exists
      const tasksFolder = app.vault.getAbstractFileByPath("Tasks");
      if (!tasksFolder) {
        await app.vault.createFolder("Tasks");
      }

      // Create the file
      await app.vault.create(fileName, content);

      // Also add to task store for testing
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin && plugin.stores && plugin.stores.taskStore) {
        const { taskStore } = plugin.stores;
        const task = {
          id: `task-${Date.now()}`,
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
          source: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        taskStore.addTask(task);
      }
    },
    { fileName, content, taskProps }
  );

  // Wait for the task to appear in the UI
  await page.waitForFunction(
    (taskTitle) => {
      const taskElements = document.querySelectorAll(
        '[data-testid^="local-task-item-"]'
      );
      return Array.from(taskElements).some((el) =>
        el.textContent?.includes(taskTitle)
      );
    },
    taskProps.title,
    { timeout: 5000 }
  );
}
