/**
 * E2E tests for TypeNote Create Note Modal
 * Tests the note creation modal opened via command
 */

import { test, expect } from "../../helpers/setup";
import {
  executeCommand,
  waitForFileCreation,
  openTaskSyncSettings,
} from "../../helpers/global";

test.describe("TypeNote Create Note Modal", () => {
  test.beforeEach(async ({ page }) => {
    // Create a note type through the settings UI
    await openTaskSyncSettings(page);

    // Navigate to Note Types section
    const noteTypesSection = page.locator(
      '[data-testid="settings-section-type-note"]'
    );
    await noteTypesSection.click();

    // Click create button
    const createButton = page.locator(
      '[data-testid="create-note-type-button"]'
    );
    await createButton.scrollIntoViewIfNeeded();
    await createButton.click();

    // Fill in basic note type info
    await page
      .locator('[data-testid="note-type-id-input"]')
      .fill("test-article");
    await page
      .locator('[data-testid="note-type-name-input"]')
      .fill("Test Article");

    // Save the note type
    const saveButton = page
      .locator("button")
      .filter({ hasText: "Create Note Type" });
    await saveButton.click();

    // Wait for success and close settings
    await page.waitForTimeout(500);

    // Close settings modal
    const closeButton = page.locator(".modal-close-button").first();
    await closeButton.click();
  });

  test("should open note creation modal via command", async ({ page }) => {
    // Execute the create note command for the Test Article note type
    await executeCommand(page, "Create Test Article");

    // Wait for the modal to appear
    await expect(page.locator(".task-sync-modal-container")).toBeVisible({
      timeout: 5000,
    });

    // Verify the modal header
    await expect(page.locator(".task-sync-modal-header h2")).toContainText(
      "Create New Test Article"
    );
  });

  test("should cancel note creation", async ({ page }) => {
    // Execute the create note command for the Test Article note type
    await executeCommand(page, "Create Test Article");

    // Wait for the modal
    await expect(page.locator(".task-sync-modal-container")).toBeVisible({
      timeout: 5000,
    });

    // Click cancel button
    const cancelButton = page.locator('[data-testid="cancel-button"]');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Verify the modal is closed
    await expect(page.locator(".task-sync-modal-container")).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("should show error when no note types are available", async ({
    page,
  }) => {
    // Remove all note types
    await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Clear all note types
      const noteTypes = plugin.typeNote.registry.getAll();
      for (const noteType of noteTypes) {
        plugin.typeNote.registry.unregister(noteType.id);
      }
    });

    // Execute the create note command
    await executeCommand(page, "Create Task");

    // Wait for error message
    await expect(page.locator(".task-sync-error-message")).toContainText(
      "No note types available"
    );
  });
});
