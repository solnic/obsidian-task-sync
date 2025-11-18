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
  expectNotice,
} from "../../helpers/global";

test.describe("Project Creation", { tag: "@entities" }, () => {
  test("should create project through modal and verify project file is created", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await expect(
      page.locator("h2:has-text('Create New Project')")
    ).toBeVisible();

    // Fill in the project name
    const projectName = "Test Project E2E";
    await page.fill('[data-testid="property-name"]', projectName);

    // Fill in the template content (note body)
    const projectContent = "This is a test project created by e2e test";
    await page.fill(
      '[data-testid="template-content-textarea"]',
      projectContent
    );

    // Click the Create Project button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the project file was created in the vault
    const expectedFilePath = `Projects/${projectName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the project content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(projectContent);

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Name).toBe(projectName);
    expect(frontMatter.Type).toBe("Project");
  });

  test("should show validation error when project name is empty", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Clear the name input (it might have a default value)
    await page.fill('[data-testid="property-name"]', "");

    // Try to submit without a name - HTML validation should prevent submission
    await page.click('[data-testid="submit-button"]');

    // Modal should still be open (HTML required attribute prevents submission)
    // Wait for modal to remain visible (it shouldn't close)
    await page.waitForSelector(".task-sync-modal-container", {
      state: "visible",
      timeout: 2500,
    });

    // Type in the name input
    await page.fill('[data-testid="property-name"]', "Valid Project");

    // Now submission should work
    await page.click('[data-testid="submit-button"]');

    // Modal should close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Verify project was created
    await expectNotice(page, "created successfully");
  });

  test("should handle project creation with only name (no areas or description)", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in only the project name
    const projectName = "Minimal Test Project";
    await page.fill('[data-testid="property-name"]', projectName);

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

  test("should handle project creation with only name (no description)", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the project name only
    const projectName = "Simple Project";
    await page.fill('[data-testid="property-name"]', projectName);

    // Click the Create Project button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the project file was created
    const expectedFilePath = `Projects/${projectName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(projectName);

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Name).toBe(projectName);
    expect(frontMatter.Type).toBe("Project");
  });
});
