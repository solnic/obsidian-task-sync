/**
 * E2E tests for TasksView filtering and sorting functionality
 * Tests advanced filtering, sorting, and search capabilities
 */

import { test, expect } from "../../helpers/setup";
import {
  openTasksView,
  waitForLocalTasksToLoad,
  getVisibleTaskItems,
  searchTasks,
  clearSearch,
  filterTasks,
  clearAllFilters,
  getTaskItemByTitle,
  createTestTask,
  openSortDropdown,
  closeSortDropdown,
} from "../../helpers/tasks-view-helpers";

test.describe("TasksView Filtering and Sorting", () => {
  test.beforeEach(async ({ page }) => {
    // Create a diverse set of test tasks for filtering/sorting tests
    const testTasks = [
      {
        title: "High Priority Feature",
        category: "Feature",
        priority: "High",
        status: "In Progress",
        areas: ["Development"],
      },
      {
        title: "Low Priority Bug",
        category: "Bug",
        priority: "Low",
        status: "Backlog",
        areas: ["Testing"],
      },
      {
        title: "Medium Priority Enhancement",
        category: "Enhancement",
        priority: "Medium",
        status: "Done",
        areas: ["Design"],
      },
      {
        title: "Critical Bug Fix",
        category: "Bug",
        priority: "Critical",
        status: "In Progress",
        areas: ["Development", "Testing"],
      },
      {
        title: "Documentation Task",
        category: "Documentation",
        priority: "Low",
        status: "Backlog",
        areas: ["Documentation"],
      },
    ];

    for (const task of testTasks) {
      await createTestTask(page, task);
    }
  });

  test("should filter tasks by area", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Get initial task count
    const initialTasks = await getVisibleTaskItems(page);
    const initialCount = initialTasks.length;
    expect(initialCount).toBeGreaterThan(0);

    // Filter by Development area (which contains "High Priority Feature" and "Critical Bug Fix")
    await filterTasks(page, "area", "Development");

    // Wait for filtering to apply using condition-based wait
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length > 0 && taskItems.length <= 2; // Should have filtered results
      },
      { timeout: 5000 }
    );

    // Verify filtering worked - should have fewer tasks than initial
    const filteredTasks = await getVisibleTaskItems(page);
    expect(filteredTasks.length).toBeGreaterThan(0);
    expect(filteredTasks.length).toBeLessThanOrEqual(initialCount);

    // Verify specific tasks are shown
    await getTaskItemByTitle(page, "High Priority Feature");
    await getTaskItemByTitle(page, "Critical Bug Fix");

    // Clear filter and verify all tasks are shown again
    await clearAllFilters(page);
    await page.waitForFunction(
      (expectedCount) => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length === expectedCount;
      },
      initialCount,
      { timeout: 5000 }
    );

    const allTasks = await getVisibleTaskItems(page);
    expect(allTasks.length).toBe(initialCount);
  });

  test("should combine search with area filter", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Apply search filter first
    await searchTasks(page, "Bug");
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        const taskTexts = Array.from(taskItems).map(
          (item) => item.textContent || ""
        );
        return taskTexts.some((text) => text.toLowerCase().includes("bug"));
      },
      { timeout: 5000 }
    );

    // Verify search worked
    const searchResults = await getVisibleTaskItems(page);
    expect(searchResults.length).toBeGreaterThan(0);

    // Then apply area filter to narrow down to Testing area
    await filterTasks(page, "area", "Testing");
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        const taskTexts = Array.from(taskItems).map(
          (item) => item.textContent || ""
        );
        return taskTexts.some(
          (text) =>
            text.toLowerCase().includes("testing") ||
            text.toLowerCase().includes("bug")
        );
      },
      { timeout: 5000 }
    );

    // Verify combined filtering worked
    const combinedResults = await getVisibleTaskItems(page);
    expect(combinedResults.length).toBeGreaterThan(0);
    expect(combinedResults.length).toBeLessThanOrEqual(searchResults.length);

    // Verify the Testing area Bug task is shown
    await getTaskItemByTitle(page, "Low Priority Bug");

    // Clear search and verify area filter still applies
    await clearSearch(page);
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length > 0; // Should still have area-filtered results
      },
      { timeout: 5000 }
    );

    // Should now show all Testing area tasks
    const areaOnlyResults = await getVisibleTaskItems(page);
    expect(areaOnlyResults.length).toBeGreaterThan(0);
    await getTaskItemByTitle(page, "Low Priority Bug");
  });

  test("should configure multi-field sorting", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Open sort dropdown
    await openSortDropdown(page);

    // Verify the default sort configuration is shown
    const sortMenu = page.locator(".task-sync-sort-menu");
    await expect(sortMenu).toBeVisible();

    // Verify default sort fields are present (Updated desc, Title asc)
    const sortItems = page.locator(".task-sync-sort-item");
    const sortItemCount = await sortItems.count();
    expect(sortItemCount).toBeGreaterThanOrEqual(2);

    // Close the menu by clicking the sort button again
    await closeSortDropdown(page);
  });

  test("should handle multiple filters simultaneously", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Get initial count
    const initialTasks = await getVisibleTaskItems(page);
    const initialCount = initialTasks.length;

    // Apply area filter first (Development area)
    await filterTasks(page, "area", "Development");
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length > 0 && taskItems.length <= 2; // Should have Development area tasks
      },
      { timeout: 5000 }
    );

    const areaFilteredTasks = await getVisibleTaskItems(page);
    expect(areaFilteredTasks.length).toBeGreaterThan(0);
    expect(areaFilteredTasks.length).toBeLessThanOrEqual(initialCount);

    // Then apply search to narrow down further
    await searchTasks(page, "Critical");
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        const taskTexts = Array.from(taskItems).map(
          (item) => item.textContent || ""
        );
        return taskTexts.some((text) =>
          text.toLowerCase().includes("critical")
        );
      },
      { timeout: 5000 }
    );

    // Should show fewer tasks than area filter alone
    const combinedFilteredTasks = await getVisibleTaskItems(page);
    expect(combinedFilteredTasks.length).toBeGreaterThan(0);
    expect(combinedFilteredTasks.length).toBeLessThanOrEqual(
      areaFilteredTasks.length
    );

    await getTaskItemByTitle(page, "Critical Bug Fix");

    // Clear search but keep area filter
    await clearSearch(page);
    await page.waitForFunction(
      (expectedCount) => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length === expectedCount;
      },
      areaFilteredTasks.length,
      { timeout: 5000 }
    );

    // Should show area filtered tasks again
    const areaOnlyTasks = await getVisibleTaskItems(page);
    expect(areaOnlyTasks.length).toBe(areaFilteredTasks.length);

    // Clear all filters and verify all tasks are shown
    await clearAllFilters(page);
    await page.waitForFunction(
      (expectedCount) => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length === expectedCount;
      },
      initialCount,
      { timeout: 5000 }
    );

    const allTasks = await getVisibleTaskItems(page);
    expect(allTasks.length).toBe(initialCount);
  });
});
