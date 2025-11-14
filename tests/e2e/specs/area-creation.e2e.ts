/**
 * E2E tests for area creation using the new entities system
 * Tests that creating an area through the modal results in the corresponding area note being created
 */

import { test, expect } from "../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  readVaultFile,
  getFrontMatter,
  expectNotice,
} from "../helpers/global";

test.describe("Area Creation", () => {
  test("should create area through modal and verify area file is created", async ({
    page,
  }) => {
    // Open the Create Area command
    await executeCommand(page, "Create Area");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await expect(page.locator("h2:has-text('Create New Area')")).toBeVisible();

    // Fill in the area name
    const areaName = "Test Area E2E";
    await page.fill('[data-testid="property-name"]', areaName);

    // Fill in the template content (note body)
    const areaContent = "This is a test area created by e2e test";
    await page.fill('[data-testid="template-content-textarea"]', areaContent);

    // Click the Create button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expect(
      page.locator('.notice:has-text("created successfully")')
    ).toBeVisible();

    // Verify the area file was created in the vault
    const expectedFilePath = `Areas/${areaName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the correct front-matter and content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).toContain(areaContent);

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Name).toBe(areaName);
    expect(frontMatter.Type).toBe("Area");
  });

  test("should show validation error when area name is empty", async ({
    page,
  }) => {
    // Open the Create Area command
    await executeCommand(page, "Create Area");

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
      timeout: 2000,
    });

    // Type in the name input
    await page.fill('[data-testid="property-name"]', "Valid Area");

    // Now submission should work
    await page.click('[data-testid="submit-button"]');

    // Modal should close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Verify area was created
    await expectNotice(page, "created successfully");
  });

  test("should handle area creation with only name (no description)", async ({
    page,
  }) => {
    // Open the Create Area command
    await executeCommand(page, "Create Area");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in only the area name
    const areaName = "Minimal Test Area";
    await page.fill('[data-testid="property-name"]', areaName);

    // Click the Create button
    await page.click('[data-testid="submit-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expect(
      page.locator('.notice:has-text("created successfully")')
    ).toBeVisible();

    // Verify the area file was created
    const expectedFilePath = `Areas/${areaName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content
    const fileContent = await readVaultFile(page, expectedFilePath);
    expect(fileContent).not.toContain("This is a test");

    const frontMatter = await getFrontMatter(page, expectedFilePath);
    expect(frontMatter.Name).toBe(areaName);
    expect(frontMatter.Type).toBe("Area");
  });
});
