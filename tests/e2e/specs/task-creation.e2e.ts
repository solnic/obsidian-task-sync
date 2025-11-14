/**
 * E2E tests for task creation using the new entities system
 * Tests that creating a task through the modal results in the corresponding task note being created
 */

import { test, expect } from "../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  readVaultFile,
  getFrontMatter,
  expectNotice,
} from "../helpers/global";

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
    // First, create test areas to select
    await executeCommand(page, "Create Area");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await page.fill('[data-testid="property-name"]', "Development");
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    await page.waitForTimeout(500);

    await executeCommand(page, "Create Area");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await page.fill('[data-testid="property-name"]', "Testing");
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    await page.waitForTimeout(500);

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

    // Select areas using the association property dropdown
    const areasButton = page.locator('[data-testid="property-areas"]');
    await expect(areasButton).toBeVisible();

    // Wait for entities to load before clicking
    await page.waitForTimeout(1000);

    await areasButton.click();

    // Wait for dropdown to appear
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "visible",
      timeout: 3000,
    });

    // Select multiple areas
    const developmentArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Development")'
      )
      .first();
    await expect(developmentArea).toBeVisible({ timeout: 3000 });
    await developmentArea.click();

    // Dropdown closes after selection, need to reopen for second selection
    await page.waitForTimeout(200);
    await areasButton.click();
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "visible",
      timeout: 3000,
    });

    const testingArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Testing")'
      )
      .first();
    await expect(testingArea).toBeVisible();
    await testingArea.click();

    // Wait a moment for the selection to register
    await page.waitForTimeout(300);

    // Ensure modal is still visible before submitting
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

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

    // Areas are stored as plain names in frontmatter (for Bases filtering compatibility)
    expect(frontMatter.Areas).toBeDefined();
    expect(Array.isArray(frontMatter.Areas)).toBe(true);
    expect(frontMatter.Areas.length).toBe(2);
    expect(frontMatter.Areas).toContain("Development");
    expect(frontMatter.Areas).toContain("Testing");

    expect(frontMatter.Done).toBe(false);
  });

  test("should show project dropdown and allow project selection", async ({
    page,
  }) => {
    // First, create a test project to select
    await executeCommand(page, "Create Project");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await page.fill('[data-testid="property-name"]', "Test Project");
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    // Wait a moment for the project to be fully created
    await page.waitForTimeout(500);

    // Now create a task and select the project
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the task title
    const taskTitle = "Task with Project";
    await page.fill('[data-testid="property-title"]', taskTitle);

    // Open extra fields to access project property
    await page.click('[data-testid="toggle-optional-properties"]');
    await expect(page.locator(".task-sync-extra-fields")).toBeVisible();

    // Click the project property button to open dropdown
    const projectButton = page.locator('[data-testid="property-project"]');
    await expect(projectButton).toBeVisible();
    await projectButton.click();

    // Wait for dropdown to appear
    await page.waitForSelector('[data-testid="property-project-dropdown"]', {
      state: "visible",
      timeout: 3000,
    });

    // Verify "Test Project" appears in the dropdown items
    const projectItem = page.locator(
      '[data-testid="property-project-dropdown-item"]:has-text("Test Project")'
    );
    await expect(projectItem).toBeVisible({ timeout: 3000 });

    // Select the project by clicking the item
    await projectItem.click();

    // Submit the form
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    // Verify the task file was created with the project
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Project).toBeDefined();
    // Frontmatter properties use wiki link format (Obsidian-specific representation)
    // Entity properties store plain names, wiki links are only in frontmatter/bases
    expect(frontMatter.Project).toMatch(/\[\[.*?\.md\|.*?\]\]/);
    expect(frontMatter.Project).toContain("Test Project");
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

  test("should support multi-select areas association and verify in frontmatter", async ({
    page,
  }) => {
    // First, create test areas to select
    await executeCommand(page, "Create Area");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await page.fill('[data-testid="property-name"]', "Development Area");
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    await page.waitForTimeout(500);

    await executeCommand(page, "Create Area");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await page.fill('[data-testid="property-name"]', "Testing Area");
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    await page.waitForTimeout(500);

    await executeCommand(page, "Create Area");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await page.fill('[data-testid="property-name"]', "Documentation Area");
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    await page.waitForTimeout(500);

    // Now create a task and select multiple areas
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in the task title
    const taskTitle = "Task with Multiple Areas";
    await page.fill('[data-testid="property-title"]', taskTitle);

    // Open extra fields to access areas property
    await page.click('[data-testid="toggle-optional-properties"]');
    await expect(page.locator(".task-sync-extra-fields")).toBeVisible();

    // Click the areas property button to open dropdown
    const areasButton = page.locator('[data-testid="property-areas"]');
    await expect(areasButton).toBeVisible();
    await areasButton.click();

    // Wait for dropdown to appear
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "visible",
      timeout: 3000,
    });

    // Select multiple areas by clicking items (dropdown closes after each selection)
    const developmentArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Development Area")'
      )
      .first();
    await expect(developmentArea).toBeVisible({ timeout: 3000 });
    await developmentArea.click();

    // Dropdown closes after selection, need to reopen for second selection
    await page.waitForTimeout(200);
    await areasButton.click();
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "visible",
      timeout: 3000,
    });

    const testingArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Testing Area")'
      )
      .first();
    await expect(testingArea).toBeVisible();
    await testingArea.click();

    // Dropdown closes again, reopen for third selection
    await page.waitForTimeout(200);
    await areasButton.click();
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "visible",
      timeout: 3000,
    });

    const documentationArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Documentation Area")'
      )
      .first();
    await expect(documentationArea).toBeVisible();
    await documentationArea.click();

    // Wait a moment for the selection to register
    await page.waitForTimeout(300);

    // Ensure modal is still visible before submitting
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Submit the form
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
    await expectNotice(page, "created successfully");

    // Verify the task file was created with multiple areas
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Areas).toBeDefined();
    expect(Array.isArray(frontMatter.Areas)).toBe(true);
    expect(frontMatter.Areas.length).toBe(3);

    // Areas are stored as plain names in frontmatter (for Bases filtering compatibility)
    expect(frontMatter.Areas).toContain("Development Area");
    expect(frontMatter.Areas).toContain("Testing Area");
    expect(frontMatter.Areas).toContain("Documentation Area");
  });

  test("should verify Done property is not required and hidden from form", async ({
    page,
  }) => {
    // Open the Create Task command
    await executeCommand(page, "Create Task");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Verify Done property is NOT visible in the form
    // It should be hidden since form.hidden is true
    const doneProperty = page.locator('[data-testid="property-done"]');
    await expect(doneProperty).not.toBeVisible();

    // Fill in required fields only
    const taskTitle = "Task Without Done Property";
    await page.fill('[data-testid="property-title"]', taskTitle);

    // Submit the form - should succeed without Done property
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expectNotice(page, "created successfully");

    // Verify the task file was created
    const expectedFilePath = `Tasks/${taskTitle}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the front-matter has Done property with default value false
    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Done).toBe(false);
  });
});
