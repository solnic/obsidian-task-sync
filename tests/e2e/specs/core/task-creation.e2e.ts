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
  createFile,
  openFile,
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
      timeout: 2500,
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
    // Use existing areas from test vault (Development and Personal)
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

    await areasButton.click();

    // Wait for dropdown to appear
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "visible",
      timeout: 2500,
    });

    // Select multiple areas
    const developmentArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Development")'
      )
      .first();
    await expect(developmentArea).toBeVisible({ timeout: 2500 });
    await developmentArea.click();

    // Wait for dropdown to close after selection
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "hidden",
      timeout: 2500,
    });
    await areasButton.click();
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "visible",
      timeout: 2500,
    });

    const personalArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Personal")'
      )
      .first();
    await expect(personalArea).toBeVisible();
    await personalArea.click();

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
    expect(frontMatter.Areas).toContain("Personal");

    expect(frontMatter.Done).toBe(false);
  });

  test("should show project dropdown and allow project selection", async ({
    page,
  }) => {
    // Use existing project from test vault (Sample Project 1)
    // Create a task and select the project
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
      timeout: 2500,
    });

    // Verify "Sample Project 1" appears in the dropdown items
    const projectItem = page.locator(
      '[data-testid="property-project-dropdown-item"]:has-text("Sample Project 1")'
    );
    await expect(projectItem).toBeVisible({ timeout: 2500 });

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
    expect(frontMatter.Project).toContain("Sample Project 1");
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
    // Use existing areas from test vault (Development and Personal)
    // Create a task and select multiple areas
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
      timeout: 2500,
    });

    // Select multiple areas by clicking items (dropdown closes after each selection)
    const developmentArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Development")'
      )
      .first();
    await expect(developmentArea).toBeVisible({ timeout: 2500 });
    await developmentArea.click();

    // Wait for dropdown to close after selection
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "hidden",
      timeout: 2500,
    });
    await areasButton.click();
    await page.waitForSelector('[data-testid="property-areas-dropdown"]', {
      state: "visible",
      timeout: 2500,
    });

    const personalArea = page
      .locator(
        '[data-testid="property-areas-dropdown-item"]:has-text("Personal")'
      )
      .first();
    await expect(personalArea).toBeVisible();
    await personalArea.click();

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
    expect(frontMatter.Areas.length).toBe(2);

    // Areas are stored as plain names in frontmatter (for Bases filtering compatibility)
    expect(frontMatter.Areas).toContain("Development");
    expect(frontMatter.Areas).toContain("Personal");
  });

  test("prefills Project from Projects/<Project>/ context and shows contextual title", async ({
    page,
  }) => {
    // Arrange: open pre-existing project file from test vault
    await openFile(page, "Projects/Sample Project 1.md");

    // Act: invoke Create Task command
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Assert: modal title indicates project context
    await expect(page.locator(".task-sync-modal-header h2")).toContainText(
      "Create Task for Project: Sample Project 1"
    );

    // Fill in title and create
    const title = "Task in Sample Project 1";
    await page.fill('[data-testid="property-title"]', title);
    await page.click('[data-testid="submit-button"]');

    await expect(page.locator(".task-sync-modal-container")).toBeHidden();
    await expectNotice(page, "created successfully");

    // Verify file and front-matter
    const expectedPath = `Tasks/${title}.md`;
    await waitForFileCreation(page, expectedPath);
    const fm = await getFrontMatter(page, expectedPath);
    // Project field is stored as a wikilink
    expect(fm.Project).toBe("[[Projects/Sample Project 1.md|Sample Project 1]]");
  });

  test("prefills Areas from Areas/<Area>/ context and shows contextual title", async ({
    page,
  }) => {
    // Arrange: open pre-existing area file from test vault
    await openFile(page, "Areas/Development.md");

    // Act: invoke Create Task command
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Assert: modal title indicates area context
    await expect(page.locator(".task-sync-modal-header h2")).toContainText(
      "Create Task for Area: Development"
    );

    // Fill in title and create
    const title = "Task in Development";
    await page.fill('[data-testid="property-title"]', title);
    await page.click('[data-testid="submit-button"]');

    await expect(page.locator(".task-sync-modal-container")).toBeHidden();
    await expectNotice(page, "created successfully");

    // Verify file and front-matter
    const expectedPath = `Tasks/${title}.md`;
    await waitForFileCreation(page, expectedPath);
    const fm = await getFrontMatter(page, expectedPath);
    expect(Array.isArray(fm.Areas)).toBe(true);
    expect(fm.Areas).toContain("Development");
  });

  test("prefills Parent task when invoked from within a task file", async ({
    page,
  }) => {
    // Arrange: create a parent task file and open it
    const parentTitle = "Parent task For Subtask";
    await createFile(
      page,
      `Tasks/${parentTitle}.md`,
      {
        Title: parentTitle,
        Category: "Task",
        Type: "Task",
        Status: "Backlog",
      },
      `---\nTitle: ${parentTitle}\nCategory: Task\nType: Task\nStatus: Backlog\n---\n`
    );
    await openFile(page, `Tasks/${parentTitle}.md`);

    // Act: invoke Create Task command
    await executeCommand(page, "Create Task");
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // When opening from a task file, contextual title should indicate subtask
    await expect(page.locator(".task-sync-modal-header h2")).toContainText(
      `Create Subtask of: ${parentTitle}`
    );

    // Fill in the subtask title and create
    const childTitle = "Child of Parent";
    await page.fill('[data-testid="property-title"]', childTitle);
    await page.click('[data-testid="submit-button"]');

    await expect(page.locator(".task-sync-modal-container")).toBeHidden();
    await expectNotice(page, "created successfully");

    // Verify file and front-matter; Parent task should be wiki link (single-value association)
    const expectedPath = `Tasks/${childTitle}.md`;
    await waitForFileCreation(page, expectedPath);
    const fm = await getFrontMatter(page, expectedPath);
    expect(fm["Parent task"]).toBe(
      `[[Tasks/${parentTitle}.md|${parentTitle}]]`
    );
  });
});
