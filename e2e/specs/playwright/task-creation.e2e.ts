/**
 * E2E tests for task creation using the new entities system
 * Tests that creating a task through the modal results in the corresponding task note being created
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  readVaultFile,
  getFrontMatter,
  expectNotice,
} from "../../helpers/global";

test.describe("Task Creation with New Architecture", () => {
  test("should create task through modal and verify task file is created", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Task Sync: Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the task title
    const taskTitle = "Test Task E2E";
    await page.fill('[data-testid="title-input"]', taskTitle);

    // Fill in the description
    const taskDescription = "This is a test task created by e2e test";
    await page.fill('[data-testid="description-input"]', taskDescription);

    // Click the Create Task button
    await page.click('[data-testid="create-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the task file was created in the vault
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the description
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(taskDescription);

    // Verify the front-matter contains correct task properties
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    expect(frontMatter.Type).toBe("Task");
    expect(frontMatter.Status).toBe("Backlog");
    expect(frontMatter.Done).toBe(false);
  });

  test("should show validation error when task title is empty", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Task Sync: Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Try to submit without entering a title
    await page.click('[data-testid="create-button"]');

    // Should show validation error notice
    await expectNotice(page, "Task title is required");

    // Modal should still be open
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Verify input has error styling
    await expect(page.locator('[data-testid="title-input"]')).toHaveClass(
      /task-sync-input-error/
    );

    // Type in the title input to clear the error
    await page.fill('[data-testid="title-input"]', "Valid Title");

    // Verify error styling is removed
    await expect(
      page.locator('[data-testid="title-input"]')
    ).not.toHaveClass(/task-sync-input-error/);

    // Cancel the modal
    await page.click('[data-testid="cancel-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
  });

  test("should create task with all properties and verify file content", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Task Sync: Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the task title
    const taskTitle = "Complete Feature Task";
    await page.fill('[data-testid="title-input"]', taskTitle);

    // Fill in the description
    const taskDescription = "A feature task with all properties set";
    await page.fill('[data-testid="description-input"]', taskDescription);

    // Change the status by clicking the status badge
    await page.click('[data-testid="status-badge"]');
    await expect(page.locator(".task-sync-selector-menu")).toBeVisible();
    await page.click('.task-sync-selector-item:has-text("In Progress")');

    // Change the type by clicking the type badge
    await page.click('[data-testid="type-badge"]');
    await expect(page.locator(".task-sync-selector-menu")).toBeVisible();
    await page.click('.task-sync-selector-item:has-text("Feature")');

    // Change the priority by clicking the priority badge
    await page.click('[data-testid="priority-badge"]');
    await expect(page.locator(".task-sync-selector-menu")).toBeVisible();
    await page.click('.task-sync-selector-item:has-text("High")');

    // Open extra fields
    await page.click('[data-testid="more-options-button"]');
    await expect(page.locator(".task-sync-extra-fields")).toBeVisible();

    // Fill in areas
    await page.fill('[data-testid="areas-input"]', "Development, Testing");

    // Submit the form
    await page.click('[data-testid="create-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the task file was created
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(taskDescription);

    // Verify the front-matter contains all the set properties
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    expect(frontMatter.Type).toBe("Feature");
    expect(frontMatter.Status).toBe("In Progress");
    expect(frontMatter.Priority).toBe("High");
    expect(frontMatter.Areas).toEqual(["Development", "Testing"]);
    expect(frontMatter.Done).toBe(false);
  });

  test("should handle task creation with only name (no description)", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Task Sync: Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in only the task title
    const taskTitle = "Minimal Test Task";
    await page.fill('[data-testid="title-input"]', taskTitle);

    // Click the Create Task button
    await page.click('[data-testid="create-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the task file was created
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).not.toContain("This is a test");

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    expect(frontMatter.Type).toBe("Task");
    expect(frontMatter.Status).toBe("Backlog");
    expect(frontMatter.Done).toBe(false);
  });
});