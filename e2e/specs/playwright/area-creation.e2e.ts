/**
 * E2E tests for area creation using the new entities system
 * Tests that creating an area through the modal results in the corresponding area note being created
 */

import { test, expect } from "../../helpers/setup";
import { executeCommand, waitForFileCreation } from "../../helpers/global";

test.describe("Area Creation with New Architecture", () => {
  test("should create area through modal and verify area file is created", async ({
    page,
  }) => {
    // Open the Create Area command
    await executeCommand(page, "Task Sync: Create Area");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();
    await expect(page.locator("h2:has-text('Create New Area')")).toBeVisible();

    // Fill in the area name
    const areaName = "Test Area E2E";
    await page.fill('[data-testid="area-name-input"]', areaName);

    // Fill in the description
    const areaDescription = "This is a test area created by e2e test";
    await page.fill('[data-testid="area-description-input"]', areaDescription);

    // Click the Create Area button
    await page.click('[data-testid="create-button"]');

    // Wait for the modal to close
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();

    // Wait for success notice
    await expect(
      page.locator('.notice:has-text("created successfully")')
    ).toBeVisible();

    // Verify the area file was created in the vault
    const expectedFilePath = `Areas/${areaName}.md`;
    await waitForFileCreation(page, expectedFilePath);

    // Verify the file content contains the correct front-matter and description
    const fileContent = await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (file) {
        return await app.vault.read(file);
      }
      return null;
    }, expectedFilePath);

    expect(fileContent).toBeTruthy();
    expect(fileContent).toContain("Name: Test Area E2E");
    expect(fileContent).toContain("Type: Area");
    expect(fileContent).toContain(areaDescription);

    // Verify the area appears in the areas list (if there's a view for it)
    // This would depend on having an areas view implemented
    // For now, we'll just verify the file creation which is the core requirement
  });

  test("should show validation error when area name is empty", async ({
    page,
  }) => {
    // Open the Create Area command
    await executeCommand(page, "Task Sync: Create Area");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Try to submit without entering a name
    await page.click('[data-testid="create-button"]');

    // Should show validation error
    await expect(
      page.locator('.notice:has-text("Area name is required")')
    ).toBeVisible();

    // Modal should still be open
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Cancel the modal
    await page.click('[data-testid="cancel-button"]');
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible();
  });

  test("should handle area creation with only name (no description)", async ({
    page,
  }) => {
    // Open the Create Area command
    await executeCommand(page, "Task Sync: Create Area");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible();

    // Fill in only the area name
    const areaName = "Minimal Test Area";
    await page.fill('[data-testid="area-name-input"]', areaName);

    // Click the Create Area button
    await page.click('[data-testid="create-button"]');

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
    const fileContent = await page.evaluate(async (filePath) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(filePath);
      if (file) {
        return await app.vault.read(file);
      }
      return null;
    }, expectedFilePath);

    expect(fileContent).toBeTruthy();
    expect(fileContent).toContain("Name: Minimal Test Area");
    expect(fileContent).toContain("Type: Area");
    // Should not have description content since none was provided
    expect(fileContent).not.toContain("This is a test");
  });
});
