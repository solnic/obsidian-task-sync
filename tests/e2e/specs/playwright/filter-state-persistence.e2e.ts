/**
 * E2E tests for filter state persistence between tab switches
 * Tests that filter selections are preserved when switching between Local and GitHub tasks
 */

import { test, expect } from "../../helpers/setup";
import {
  openTasksView,
  waitForLocalTasksToLoad,
  filterTasks,
  createTestTask,
} from "../../helpers/tasks-view-helpers";
import {
  switchToTaskService,
  openView,
  enableIntegration,
} from "../../helpers/global";
import { stubGitHubWithFixtures } from "../../helpers/github-integration-helpers";

test.describe("Filter State Persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Enable GitHub integration and set up stubs for testing
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

    // Create some test tasks with different projects and areas
    await createTestTask(page, {
      title: "Alpha Project Task",
      project: "Alpha Project",
      area: "Development",
      category: "Feature",
    });

    await createTestTask(page, {
      title: "Beta Project Task",
      project: "Beta Project",
      area: "Testing",
      category: "Bug",
    });

    await createTestTask(page, {
      title: "Gamma Project Task",
      project: "Gamma Project",
      area: "Development",
      category: "Feature",
    });
  });

  test("should preserve Local tasks project filter when switching to GitHub and back", async ({
    page,
  }) => {
    // Switch to local tasks first
    await switchToTaskService(page, "local");
    await waitForLocalTasksToLoad(page);

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
          !taskTexts.some((text) => text.includes("Beta Project Task")) &&
          !taskTexts.some((text) => text.includes("Gamma Project Task"))
        );
      },
      { timeout: 5000 }
    );

    // Verify the filter button shows the selected project
    const projectFilterButton = page.locator('[data-testid="project-filter"]');
    await expect(projectFilterButton).toContainText("Alpha Project");

    // Switch to GitHub tasks
    await switchToTaskService(page, "github");

    // Wait for GitHub service to load
    await page.waitForSelector('[data-testid="github-service"]', {
      timeout: 5000,
    });

    // Switch back to Local tasks
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
          !taskTexts.some((text) => text.includes("Beta Project Task")) &&
          !taskTexts.some((text) => text.includes("Gamma Project Task"))
        );
      },
      { timeout: 5000 }
    );
  });

  test("should preserve Local tasks area filter when switching to GitHub and back", async ({
    page,
  }) => {
    // Switch to local tasks first
    await switchToTaskService(page, "local");
    await waitForLocalTasksToLoad(page);

    // Apply area filter to "Development"
    await filterTasks(page, "area", "Development");

    // Verify filter is applied - should see Alpha and Gamma tasks (both Development area)
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
          taskTexts.some((text) => text.includes("Gamma Project Task")) &&
          !taskTexts.some((text) => text.includes("Beta Project Task"))
        );
      },
      { timeout: 5000 }
    );

    // Verify the filter button shows the selected area
    const areaFilterButton = page.locator('[data-testid="area-filter"]');
    await expect(areaFilterButton).toContainText("Development");

    // Switch to GitHub tasks
    await switchToTaskService(page, "github");

    // Wait for GitHub service to load
    await page.waitForSelector('[data-testid="github-service"]', {
      timeout: 5000,
    });

    // Switch back to Local tasks
    await switchToTaskService(page, "local");
    await waitForLocalTasksToLoad(page);

    // BUG: The area filter should still be "Development" but it gets reset
    // This test will FAIL until the bug is fixed
    await expect(areaFilterButton).toContainText("Development");

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
          taskTexts.some((text) => text.includes("Gamma Project Task")) &&
          !taskTexts.some((text) => text.includes("Beta Project Task"))
        );
      },
      { timeout: 5000 }
    );
  });

  test("should preserve multiple Local tasks filters when switching to GitHub and back", async ({
    page,
  }) => {
    // Switch to local tasks first
    await switchToTaskService(page, "local");
    await waitForLocalTasksToLoad(page);

    // Apply both project and area filters
    await filterTasks(page, "project", "Alpha Project");
    await filterTasks(page, "area", "Development");

    // Verify both filters are applied
    const projectFilterButton = page.locator('[data-testid="project-filter"]');
    const areaFilterButton = page.locator('[data-testid="area-filter"]');

    await expect(projectFilterButton).toContainText("Alpha Project");
    await expect(areaFilterButton).toContainText("Development");

    // Should only see Alpha Project task (matches both filters)
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
          !taskTexts.some((text) => text.includes("Beta Project Task")) &&
          !taskTexts.some((text) => text.includes("Gamma Project Task"))
        );
      },
      { timeout: 5000 }
    );

    // Switch to GitHub tasks and back
    await switchToTaskService(page, "github");
    await page.waitForSelector('[data-testid="github-service"]', {
      timeout: 5000,
    });
    await switchToTaskService(page, "local");
    await waitForLocalTasksToLoad(page);

    // BUG: Both filters should be preserved but they get reset
    // This test will FAIL until the bug is fixed
    await expect(projectFilterButton).toContainText("Alpha Project");
    await expect(areaFilterButton).toContainText("Development");

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
          !taskTexts.some((text) => text.includes("Beta Project Task")) &&
          !taskTexts.some((text) => text.includes("Gamma Project Task"))
        );
      },
      { timeout: 5000 }
    );
  });
});
