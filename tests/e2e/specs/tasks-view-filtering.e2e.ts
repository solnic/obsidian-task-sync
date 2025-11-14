/**
 * E2E tests for TasksView filtering and sorting functionality
 * Tests advanced filtering, sorting, and search capabilities
 */

import { test, expect } from "../helpers/setup";
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
} from "../helpers/tasks-view-helpers";
import {
  openView,
  enableIntegration,
  switchToTaskService,
  executeCommand,
} from "../helpers/global";
import { stubGitHubWithFixtures } from "../helpers/github-integration-helpers";
import { createTask } from "../helpers/entity-helpers";

test.describe("TasksView Filtering and Sorting", () => {
  test.beforeEach(async ({ page }) => {
    // Create a diverse set of test tasks for filtering/sorting tests
    // Note: Test vault already has pre-existing tasks and areas (Development, Personal)
    const testTasks = [
      {
        title: "High Priority Feature",
        category: "Feature",
        priority: "High",
        status: "In Progress",
        areas: ["Development"], // Uses pre-existing Development area
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
        areas: ["Development", "Testing"], // Uses pre-existing Development area
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

    // Filter by Development area
    // Should show: "High Priority Feature", "Critical Bug Fix" (from beforeEach), and "Sample Task 2" (pre-existing)
    await filterTasks(page, "area", "Development");

    // Wait for filtering to apply using condition-based wait
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length > 0 && taskItems.length <= 3; // Should have 3 filtered results
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
    await getTaskItemByTitle(page, "Sample Task 2");

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
    // Should show: "High Priority Feature", "Critical Bug Fix" (from beforeEach), and "Sample Task 2" (pre-existing)
    await filterTasks(page, "area", "Development");
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        return taskItems.length > 0 && taskItems.length <= 3; // Should have 3 Development area tasks
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

  test("should preserve filter state when switching between Local and GitHub tabs", async ({
    page,
  }) => {
    // Setup GitHub integration for tab switching
    await openView(page, "task-sync-main");
    await enableIntegration(page, "github");

    await stubGitHubWithFixtures(page, {
      repositories: "repositories-with-orgs",
      issues: "issues-multiple",
      organizations: "organizations-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Wait for GitHub service button to appear and be enabled
    await page.waitForSelector(
      '[data-testid="service-github"]:not([disabled])',
      {
        state: "visible",
        timeout: 10000,
      }
    );

    // Go to tasks view and wait for local tasks to load
    await openTasksView(page);
    await waitForLocalTasksToLoad(page);

    // Create test tasks with different projects
    await createTestTask(page, {
      title: "Alpha Project Task",
      project: "Alpha Project",
      areas: ["Development"], // Uses pre-existing Development area
    });

    await createTestTask(page, {
      title: "Beta Project Task",
      project: "Beta Project",
      areas: ["Testing"],
    });

    // Apply project filter to "Alpha Project"
    await filterTasks(page, "project", "Alpha Project");

    // Verify filter is applied - should only see Alpha Project task
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        const taskTexts = Array.from(taskItems).map(
          (item) => item.textContent || ""
        );
        return (
          taskTexts.some((text) => text.includes("Alpha Project Task")) &&
          !taskTexts.some((text) => text.includes("Beta Project Task"))
        );
      },
      { timeout: 5000 }
    );

    // Verify the filter button shows "Alpha Project"
    const projectFilterButton = page.locator('[data-testid="project-filter"]');
    await expect(projectFilterButton).toContainText("Alpha Project");

    // Switch to GitHub service
    await switchToTaskService(page, "github");
    await page.waitForTimeout(1000); // Wait for tab switch

    // Switch back to Local service
    await switchToTaskService(page, "local");
    await waitForLocalTasksToLoad(page);

    // BUG: The project filter should still be "Alpha Project" but it gets reset
    // This test will FAIL until the bug is fixed
    await expect(projectFilterButton).toContainText("Alpha Project");

    // Verify the filtered results are still showing
    await page.waitForFunction(
      () => {
        const taskItems = document.querySelectorAll(
          '[data-testid^="local-task-item-"]'
        );
        const taskTexts = Array.from(taskItems).map(
          (item) => item.textContent || ""
        );
        return (
          taskTexts.some((text) => text.includes("Alpha Project Task")) &&
          !taskTexts.some((text) => text.includes("Beta Project Task"))
        );
      },
      { timeout: 5000 }
    );
  });

  test("should clear filter when clicking clear button", async ({ page }) => {
    // Create tasks with different projects
    await createTask(page, {
      title: "Task 1",
      project: "Alpha Project",
    });
    await createTask(page, {
      title: "Task 2",
      project: "Beta Project",
    });
    await createTask(page, {
      title: "Task 3",
      project: "Gamma Project",
    });

    // Open Task Sync view
    await executeCommand(page, "Task Sync: Open Main View");
    await expect(page.locator(".task-sync-app")).toBeVisible();

    // Ensure we're on Local tab
    const localTab = page.locator('[data-testid="service-local"]');
    await localTab.click();
    await expect(localTab).toHaveClass(/active/);

    // Wait for tasks to load
    // Pre-existing tasks: Sample Task 1, Sample Task 2 (2)
    // Tasks from beforeEach: 5 tasks
    // Tasks created in this test: 3 tasks
    // Total: 10 tasks
    await expect(page.locator('[data-testid^="local-task-item-"]')).toHaveCount(
      10
    );

    // Apply project filter
    await filterTasks(page, "project", "Alpha Project");

    // Verify filter is applied - should show only 1 task (Task 1 with Alpha Project)
    await expect(page.locator('[data-testid^="local-task-item-"]')).toHaveCount(
      1
    );
    await expect(
      page.locator('[data-testid^="local-task-item-"]')
    ).toContainText("Task 1");

    // Verify filter button shows active state and clear button is visible
    const projectFilterButton = page.locator('[data-testid="project-filter"]');
    await expect(projectFilterButton).toHaveClass(/active/);
    await expect(
      projectFilterButton.locator(".filter-clear-button")
    ).toBeVisible();

    // Click the clear button
    await projectFilterButton.locator(".filter-clear-button").click();

    // BUG: Filter should be cleared and all tasks should be visible
    // This test will fail until the clear functionality is fixed
    await expect(page.locator('[data-testid^="local-task-item-"]')).toHaveCount(
      10
    );

    // Verify filter button is no longer active
    await expect(projectFilterButton).not.toHaveClass(/active/);

    // Verify clear button is no longer visible
    await expect(
      projectFilterButton.locator(".filter-clear-button")
    ).not.toBeVisible();

    // Verify button text shows default value
    await expect(projectFilterButton).toContainText("All projects");
  });
});
