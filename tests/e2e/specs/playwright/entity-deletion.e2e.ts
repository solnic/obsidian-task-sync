/**
 * E2E tests for entity deletion when notes are deleted
 * Tests that deleting a note in Obsidian properly deletes the corresponding entity
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  deleteVaultFile,
  waitForFileDeletion,
  getTasksFromView,
  getProjectsFromView,
  getAreasFromView,
} from "../../helpers/global";

test.describe("Entity Deletion on Note Deletion", () => {
  test("should delete task entity when task note is deleted", async ({
    page,
  }) => {
    // Create a task through the modal
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    const taskTitle = "Task to Delete";
    await page.fill('[data-testid="property-title"]', taskTitle);
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for the task file to be created
    const taskFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, taskFilePath);

    // Verify task appears in the tasks view
    await executeCommand(page, "Task Sync: Open Main View");
    const tasksBeforeDeletion = await getTasksFromView(page);
    expect(tasksBeforeDeletion.some((t) => t.title === taskTitle)).toBe(true);

    // Delete the task file
    await deleteVaultFile(page, taskFilePath);
    await waitForFileDeletion(page, taskFilePath);

    // Verify task no longer appears in the tasks view
    const tasksAfterDeletion = await getTasksFromView(page);
    expect(tasksAfterDeletion.some((t) => t.title === taskTitle)).toBe(false);
  });

  test("should delete project entity when project note is deleted", async ({
    page,
  }) => {
    // Create a project through the modal
    await executeCommand(page, "Create Project");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    const projectName = "Project to Delete";
    await page.fill('[data-testid="property-name"]', projectName);
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for the project file to be created
    const projectFilePath = `Projects/${projectName}.md`;
    await waitForFileCreation(page, projectFilePath);

    // Verify project appears in the projects view
    const projectsBeforeDeletion = await getProjectsFromView(page);
    expect(projectsBeforeDeletion.some((p) => p.name === projectName)).toBe(
      true
    );

    // Delete the project file
    await deleteVaultFile(page, projectFilePath);
    await waitForFileDeletion(page, projectFilePath);

    // Verify project no longer appears in the projects view
    const projectsAfterDeletion = await getProjectsFromView(page);
    expect(projectsAfterDeletion.some((p) => p.name === projectName)).toBe(
      false
    );
  });

  test("should delete area entity when area note is deleted", async ({
    page,
  }) => {
    // Create an area through the modal
    await executeCommand(page, "Create Area");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    const areaName = "Area to Delete";
    await page.fill('[data-testid="property-name"]', areaName);
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for the area file to be created
    const areaFilePath = `Areas/${areaName}.md`;
    await waitForFileCreation(page, areaFilePath);

    // Verify area appears in the areas view
    const areasBeforeDeletion = await getAreasFromView(page);
    expect(areasBeforeDeletion.some((a) => a.name === areaName)).toBe(true);

    // Delete the area file
    await deleteVaultFile(page, areaFilePath);
    await waitForFileDeletion(page, areaFilePath);

    // Verify area no longer appears in the areas view
    const areasAfterDeletion = await getAreasFromView(page);
    expect(areasAfterDeletion.some((a) => a.name === areaName)).toBe(false);
  });
});
