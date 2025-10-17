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

test.describe("Task Creation", () => {
  test("should create task through modal and verify task file is created", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the task title
    const taskTitle = "Test Task E2E";
    await page.fill('[data-testid="property-title"]', taskTitle);

    // Fill in the template content (note body)
    const taskContent = "This is a test task created by e2e test";
    await page.fill('[data-testid="template-content-textarea"]', taskContent);

    // Click the Create Task button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the task file was created in the vault
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the task content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(taskContent);

    // Verify the front-matter contains correct task properties
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    // Description should be in content, not front-matter
    expect(frontMatter.Description).toBeUndefined();
    expect(frontMatter.Category).toBe("Task");
    expect(frontMatter.Status).toBe("Backlog");
    expect(frontMatter.Done).toBe(false);
  });

  test("should show validation error when task title is empty", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Clear the title input (it might have a default value)
    await page.fill('[data-testid="property-title"]', "");

    // Try to submit without a title - HTML validation should prevent submission
    await page.click('[data-testid="submit-button"]');

    // Modal should still be open (HTML required attribute prevents submission)
    // Wait for modal to remain visible (it shouldn't close)
    await page.waitForSelector(".task-sync-modal-container", {
      state: "visible",
      timeout: 2000,
    });

    // Type in the title input
    await page.fill('[data-testid="property-title"]', "Valid Title");

    // Now submission should work
    await page.click('[data-testid="submit-button"]');

    // Modal should close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Verify task was created
    await expectNotice(page, "created successfully");
  });

  test("should create task with all properties and verify file content", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the task title
    const taskTitle = "Complete Feature Task";
    await page.fill('[data-testid="property-title"]', taskTitle);

    // Fill in the template content (note body)
    const taskContent = "A feature task with all properties set";
    await page.fill('[data-testid="template-content-textarea"]', taskContent);

    // Change the category by clicking the category property button (category is required)
    await page.click('[data-testid="property-category"]');
    await page.waitForSelector('[data-testid="property-category-dropdown"]', {
      state: "visible",
    });
    await page.click(
      '[data-testid="property-category-dropdown-item"]:has-text("Feature")'
    );

    // Change the status by clicking the status property button (status is required)
    await page.click('[data-testid="property-status"]');
    await page.waitForSelector('[data-testid="property-status-dropdown"]', {
      state: "visible",
    });
    await page.click(
      '[data-testid="property-status-dropdown-item"]:has-text("In Progress")'
    );

    // Open extra fields to access optional properties (priority, areas)
    await page.click('[data-testid="toggle-optional-properties"]');
    await expect(page.locator(".task-sync-extra-fields")).toBeVisible();

    // Change the priority by clicking the priority property button
    await page.click('[data-testid="property-priority"]');
    await page.waitForSelector('[data-testid="property-priority-dropdown"]', {
      state: "visible",
    });
    await page.click(
      '[data-testid="property-priority-dropdown-item"]:has-text("High")'
    );

    // Fill in areas
    await page.fill('[data-testid="property-areas"]', "Development, Testing");

    // Submit the form
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the task file was created
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(taskContent);

    // Verify the front-matter contains all the set properties
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    expect(frontMatter.Category).toBe("Feature");
    expect(frontMatter.Status).toBe("In Progress");
    expect(frontMatter.Priority).toBe("High");
    expect(frontMatter.Areas).toEqual(["Development", "Testing"]);
    expect(frontMatter.Done).toBe(false);
  });

  test("should handle task creation with minimal required fields", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in required fields only
    const taskTitle = "Minimal Test Task";
    const taskContent = "Minimal description";
    await page.fill('[data-testid="property-title"]', taskTitle);
    await page.fill('[data-testid="template-content-textarea"]', taskContent);

    // Click the Create Task button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the task file was created
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(taskContent);

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Title).toBe(taskTitle);
    // Description should be in content, not front-matter
    expect(frontMatter.Description).toBeUndefined();
    expect(frontMatter.Category).toBe("Task");
    expect(frontMatter.Status).toBe("Backlog");
    expect(frontMatter.Done).toBe(false);
  });
});
