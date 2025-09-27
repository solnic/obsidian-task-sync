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
  sortTasks,
  getTaskItemByTitle,
  verifyTaskCount,
  waitForFilteredTaskCount,
  createTestTask,
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

  test("should filter tasks by category", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Filter by Bug category
    await filterTasks(page, "category", "Bug");

    // Wait for filtering to apply
    await waitForFilteredTaskCount(page, 2);

    // Verify only Bug tasks are shown
    const visibleTasks = await getVisibleTaskItems(page);
    expect(visibleTasks.length).toBe(2);

    // Verify the correct tasks are shown
    await getTaskItemByTitle(page, "Low Priority Bug");
    await getTaskItemByTitle(page, "Critical Bug Fix");

    // Clear filter and verify all tasks are shown again
    await clearAllFilters(page);
    await page.waitForTimeout(300);

    const allTasks = await getVisibleTaskItems(page);
    expect(allTasks.length).toBeGreaterThanOrEqual(5);
  });

  test("should filter tasks by priority", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Filter by High priority
    await filterTasks(page, "priority", "High");

    // Wait for filtering to apply
    await waitForFilteredTaskCount(page, 1);

    // Verify only High priority task is shown
    const visibleTasks = await getVisibleTaskItems(page);
    expect(visibleTasks.length).toBe(1);

    await getTaskItemByTitle(page, "High Priority Feature");
  });

  test("should filter tasks by status", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Filter by In Progress status
    await filterTasks(page, "status", "In Progress");

    // Wait for filtering to apply
    await waitForFilteredTaskCount(page, 2);

    // Verify only In Progress tasks are shown
    const visibleTasks = await getVisibleTaskItems(page);
    expect(visibleTasks.length).toBe(2);

    await getTaskItemByTitle(page, "High Priority Feature");
    await getTaskItemByTitle(page, "Critical Bug Fix");
  });

  test("should filter tasks by area", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Filter by Development area
    await filterTasks(page, "area", "Development");

    // Wait for filtering to apply
    await waitForFilteredTaskCount(page, 2);

    // Verify only Development area tasks are shown
    const visibleTasks = await getVisibleTaskItems(page);
    expect(visibleTasks.length).toBe(2);

    await getTaskItemByTitle(page, "High Priority Feature");
    await getTaskItemByTitle(page, "Critical Bug Fix");
  });

  test("should combine search with filters", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Apply search filter first
    await searchTasks(page, "Bug");

    // Wait for search to apply
    await waitForFilteredTaskCount(page, 2);

    // Then apply priority filter
    await filterTasks(page, "priority", "Critical");

    // Wait for combined filtering to apply
    await waitForFilteredTaskCount(page, 1);

    // Verify only the Critical Bug task is shown
    const visibleTasks = await getVisibleTaskItems(page);
    expect(visibleTasks.length).toBe(1);

    await getTaskItemByTitle(page, "Critical Bug Fix");

    // Clear search and verify filter still applies
    await clearSearch(page);
    await page.waitForTimeout(300);

    // Should now show all Critical priority tasks (if any)
    const filteredTasks = await getVisibleTaskItems(page);
    expect(filteredTasks.length).toBeGreaterThanOrEqual(1);
  });

  test("should sort tasks by title alphabetically", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Sort by title ascending
    await sortTasks(page, "Title", "asc");

    // Wait for sorting to apply
    await page.waitForTimeout(500);

    // Get all task items and verify they are sorted alphabetically
    const taskItems = await getVisibleTaskItems(page);
    const taskTitles = await Promise.all(
      taskItems.map(async (item) => {
        const text = await item.textContent();
        // Extract title from the task item text
        const titleMatch = text?.match(/([A-Z][^•]+?)(?=\s*•|$)/);
        return titleMatch ? titleMatch[1].trim() : "";
      })
    );

    // Verify alphabetical order
    const sortedTitles = [...taskTitles].sort();
    expect(taskTitles).toEqual(sortedTitles);
  });

  test("should sort tasks by priority", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Sort by priority (should be Critical > High > Medium > Low)
    await sortTasks(page, "Priority", "desc");

    // Wait for sorting to apply
    await page.waitForTimeout(500);

    // Get task items and verify priority order
    const taskItems = await getVisibleTaskItems(page);
    const priorities = await Promise.all(
      taskItems.map(async (item) => {
        const text = await item.textContent();
        if (text?.includes("Critical")) return "Critical";
        if (text?.includes("High")) return "High";
        if (text?.includes("Medium")) return "Medium";
        if (text?.includes("Low")) return "Low";
        return "Unknown";
      })
    );

    // Verify Critical comes before High, High before Medium, etc.
    const priorityOrder = ["Critical", "High", "Medium", "Low"];
    let lastPriorityIndex = -1;

    for (const priority of priorities) {
      const currentIndex = priorityOrder.indexOf(priority);
      if (currentIndex !== -1) {
        expect(currentIndex).toBeGreaterThanOrEqual(lastPriorityIndex);
        lastPriorityIndex = currentIndex;
      }
    }
  });

  test("should sort tasks by status", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Sort by status
    await sortTasks(page, "Status", "asc");

    // Wait for sorting to apply
    await page.waitForTimeout(500);

    // Get task items and verify they are grouped by status
    const taskItems = await getVisibleTaskItems(page);
    const statuses = await Promise.all(
      taskItems.map(async (item) => {
        const text = await item.textContent();
        if (text?.includes("Backlog")) return "Backlog";
        if (text?.includes("In Progress")) return "In Progress";
        if (text?.includes("Done")) return "Done";
        return "Unknown";
      })
    );

    // Verify statuses are grouped together (all Backlog, then all In Progress, etc.)
    const statusOrder = ["Backlog", "Done", "In Progress"]; // Alphabetical order
    let lastStatusIndex = -1;

    for (const status of statuses) {
      const currentIndex = statusOrder.indexOf(status);
      if (currentIndex !== -1) {
        expect(currentIndex).toBeGreaterThanOrEqual(lastStatusIndex);
        lastStatusIndex = currentIndex;
      }
    }
  });

  test("should handle multiple filters simultaneously", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Apply multiple filters: Bug category AND In Progress status
    await filterTasks(page, "category", "Bug");
    await page.waitForTimeout(200);
    await filterTasks(page, "status", "In Progress");

    // Wait for filtering to apply
    await waitForFilteredTaskCount(page, 1);

    // Should only show the Critical Bug Fix (Bug + In Progress)
    const visibleTasks = await getVisibleTaskItems(page);
    expect(visibleTasks.length).toBe(1);

    await getTaskItemByTitle(page, "Critical Bug Fix");

    // Clear all filters and verify all tasks are shown
    await clearAllFilters(page);
    await page.waitForTimeout(300);

    const allTasks = await getVisibleTaskItems(page);
    expect(allTasks.length).toBeGreaterThanOrEqual(5);
  });

  test("should persist sort order when filtering", async ({ page }) => {
    // Open Tasks view
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Sort by title first
    await sortTasks(page, "Title", "asc");
    await page.waitForTimeout(300);

    // Then apply a filter
    await filterTasks(page, "category", "Bug");
    await waitForFilteredTaskCount(page, 2);

    // Verify filtered tasks are still sorted by title
    const taskItems = await getVisibleTaskItems(page);
    const taskTitles = await Promise.all(
      taskItems.map(async (item) => {
        const text = await item.textContent();
        const titleMatch = text?.match(/([A-Z][^•]+?)(?=\s*•|$)/);
        return titleMatch ? titleMatch[1].trim() : "";
      })
    );

    // Should be alphabetically sorted: "Critical Bug Fix" before "Low Priority Bug"
    expect(taskTitles[0]).toBe("Critical Bug Fix");
    expect(taskTitles[1]).toBe("Low Priority Bug");
  });
});
