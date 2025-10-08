/**
 * E2E tests for project creation using the new entities system
 * Tests that creating a project through the modal results in the corresponding project note being created
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  readVaultFile,
  getFrontMatter,
} from "../../helpers/global";

test.describe("Project Creation with New Architecture", () => {
  test("should create project through modal and verify project file is created", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Task Sync: Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await expect(
      page.locator("h2:has-text('Create New Project')")
    ).toBeVisible();

    // Fill in the project name
    const projectName = "Test Project E2E";
    await page.fill('[data-testid="project-name-input"]', projectName);

    // Fill in the areas
    const projectAreas = "Work, Development";
    await page.fill('[data-testid="project-areas-input"]', projectAreas);

    // Fill in the description
    const projectDescription = "This is a test project created by e2e test";
    await page.fill(
      '[data-testid="project-description-input"]',
      projectDescription
    );

    // Click the Create Project button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expect(
      page.locator('.notice:has-text("created successfully")')
    ).toBeVisible();

    // Verify the project file was created in the vault
    const expectedFilePath = `Projects/${projectName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the correct front-matter and description
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(projectDescription);

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Name).toBe(projectName);
    expect(frontMatter.Type).toBe("Project");
    expect(frontMatter.Areas).toEqual(["Work", "Development"]);
  });

  test("should show validation error when project name is empty", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Task Sync: Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Try to submit without entering a name
    await page.click('[data-testid="submit-button"]');

    // Should show validation error
    await expect(
      page.locator('.notice:has-text("Project name is required")')
    ).toBeVisible();

    // Modal should still be open
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Verify input has error styling
    await expect(
      page.locator('[data-testid="project-name-input"]')
    ).toHaveClass(/task-sync-input-error/);
  });

  test("should handle project creation with only name (no areas or description)", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Task Sync: Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in only the project name
    const projectName = "Minimal Test Project";
    await page.fill('[data-testid="project-name-input"]', projectName);

    // Click the Create Project button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expect(
      page.locator('.notice:has-text("created successfully")')
    ).toBeVisible();

    // Verify the project file was created
    const expectedFilePath = `Projects/${projectName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);

    expect(fileContent).toContain(projectName);
    expect(fileContent).toContain("Project");
  });

  test("should handle project creation with areas but no description", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Task Sync: Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the project name and areas
    const projectName = "Project with Areas";
    await page.fill('[data-testid="project-name-input"]', projectName);
    await page.fill(
      '[data-testid="project-areas-input"]',
      "Learning, Personal"
    );

    // Click the Create Project button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expect(
      page.locator('.notice:has-text("created successfully")')
    ).toBeVisible();

    // Verify the project file was created
    const expectedFilePath = `Projects/${projectName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);

    expect(fileContent).toContain(projectName);
    expect(fileContent).toContain("Project");
    expect(fileContent).toContain("Learning");
    expect(fileContent).toContain("Personal");
  });
});
