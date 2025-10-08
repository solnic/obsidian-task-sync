/**
 * E2E test to verify that description is part of note content, not front-matter
 * Description should be in the markdown body, not in the YAML front-matter
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  readVaultFile,
  getFrontMatter,
  expectNotice,
} from "../../helpers/global";

test.describe("Note Description as Content", () => {
  test("Task note should have description in content, not front-matter", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the task title
    const taskTitle = "Test Task Description";
    await page.fill('[data-testid="property-title"]', taskTitle);

    // Fill in the description
    const taskDescription = "This description should be in content, not front-matter";
    await page.fill('[data-testid="property-description"]', taskDescription);

    // Click the Create Task button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the task file was created in the vault
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the description in the body
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(taskDescription);

    // Verify the front-matter does NOT contain Description property
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    expect(frontMatter.Description).toBeUndefined(); // Description should NOT be in front-matter
    
    // Verify description is in the content body (after the front-matter)
    const contentAfterFrontMatter = fileContent.split('---').slice(2).join('---').trim();
    expect(contentAfterFrontMatter).toContain(taskDescription);
  });

  test("Area note should have description in content, not front-matter", async ({
    page,
  }) => {
    // Open the Create Area command
    await executeCommand(page, "Create Area");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the area name
    const areaName = "Test Area Description";
    await page.fill('[data-testid="property-name"]', areaName);

    // Fill in the description
    const areaDescription = "This area description should be in content";
    await page.fill('[data-testid="property-description"]', areaDescription);

    // Click the Create button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the area file was created in the vault
    const expectedFilePath = `Areas/${areaName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the description in the body
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(areaDescription);

    // Verify the front-matter does NOT contain Description property
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Name).toBe(areaName);
    expect(frontMatter.Description).toBeUndefined(); // Description should NOT be in front-matter
    
    // Verify description is in the content body (after the front-matter)
    const contentAfterFrontMatter = fileContent.split('---').slice(2).join('---').trim();
    expect(contentAfterFrontMatter).toContain(areaDescription);
  });

  test("Project note should have description in content, not front-matter", async ({
    page,
  }) => {
    // Open the Create Project command
    await executeCommand(page, "Create Project");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the project name
    const projectName = "Test Project Description";
    await page.fill('[data-testid="property-name"]', projectName);

    // Fill in the description
    const projectDescription = "This project description should be in content";
    await page.fill('[data-testid="property-description"]', projectDescription);

    // Click the Create button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the project file was created in the vault
    const expectedFilePath = `Projects/${projectName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the description in the body
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(projectDescription);

    // Verify the front-matter does NOT contain Description property
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Name).toBe(projectName);
    expect(frontMatter.Description).toBeUndefined(); // Description should NOT be in front-matter
    
    // Verify description is in the content body (after the front-matter)
    const contentAfterFrontMatter = fileContent.split('---').slice(2).join('---').trim();
    expect(contentAfterFrontMatter).toContain(projectDescription);
  });
});

