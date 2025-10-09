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
} from "../../helpers/global";
import {
  getTaskByTitle,
  getProjectByName,
  getAreaByName,
} from "../../helpers/entity-helpers";

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

    // Delete the task file
    await deleteVaultFile(page, taskFilePath);

    const task = await getTaskByTitle(page, taskTitle);
    expect(task).toBeUndefined();
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

    // Delete the project file
    await deleteVaultFile(page, projectFilePath);

    const project = await getProjectByName(page, projectName);
    expect(project).toBeUndefined();
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

    // Delete the area file
    await deleteVaultFile(page, areaFilePath);

    const area = await getAreaByName(page, areaName);
    expect(area).toBeUndefined();
  });
});
