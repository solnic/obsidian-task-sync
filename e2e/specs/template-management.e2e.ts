/**
 * E2E tests for Template Management functionality
 * Tests template creation and management in a real Obsidian environment
 */

import { test, expect, describe, beforeEach } from "vitest";
import { getFileContent, fileExists } from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Template Management", () => {
  const context = setupE2ETestHooks();

  test("should create Task.md template automatically during plugin initialization", async () => {
    // The plugin SHOULD automatically create default templates when they're missing
    // This ensures explicit configuration rather than hidden fallback mechanisms
    const templateExists = await fileExists(context.page, "Templates/Task.md");
    expect(templateExists).toBe(true);

    // Verify the template has proper structure
    const templateContent = await getFileContent(
      context.page,
      "Templates/Task.md"
    );
    expect(templateContent).toContain("---");
    expect(templateContent).toContain("Title:");
    expect(templateContent).toContain("Type:");
  });

  test("should create template with custom filename when specified", async () => {
    // Create template with custom filename
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (plugin && plugin.noteManagers) {
        await plugin.noteManagers.createTemplate("Task", "Custom Task.md");
      }
    });

    // Check if custom template was created
    const templateExists = await fileExists(
      context.page,
      "Templates/Custom Task.md"
    );
    expect(templateExists).toBe(true);

    // Verify the content is still correct
    const templateContent = await getFileContent(
      context.page,
      "Templates/Custom Task.md"
    );
    expect(templateContent).toContain("Title: ");
    // Only {{tasks}} variable is supported, no {{description}}
  });

  test("should provide settings UI to create templates when custom template is configured", async () => {
    // Open settings tab
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      app.setting.open();
      app.setting.openTabById("obsidian-task-sync");
    });

    // Wait for settings UI to load
    await context.page.waitForTimeout(1000);

    // Find and modify the "Default Task Template" input field through the UI
    await context.page.evaluate(() => {
      // Look for the Default Task Template setting
      const settings = Array.from(document.querySelectorAll(".setting-item"));
      const taskTemplateSetting = settings.find((setting) =>
        setting
          .querySelector(".setting-item-name")
          ?.textContent?.includes("Default Task Template")
      );

      if (taskTemplateSetting) {
        const input = taskTemplateSetting.querySelector(
          'input[type="text"]'
        ) as HTMLInputElement;
        if (input) {
          console.log(
            "Found Default Task Template input, current value:",
            input.value
          );
          // Clear the input and set new value
          input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.value = "CustomTask.md";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          console.log("Set Default Task Template to:", input.value);
        } else {
          console.log("Input field not found in task template setting");
        }
      } else {
        console.log("Default Task Template setting not found");
      }
    });

    // Wait for the setting change to be processed
    await context.page.waitForTimeout(1000);

    // Look for a "Create Template" button in the Templates section
    const createTemplateButtonExists = await context.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some((button) =>
        button.textContent?.includes("Create Template")
      );
    });
    expect(createTemplateButtonExists).toBe(true);

    // Click the first "Create Template" button (for tasks)
    await context.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const createButton = buttons.find(
        (button) =>
          button.textContent?.includes("Create Template") &&
          button
            .closest(".setting-item")
            ?.querySelector(".setting-item-name")
            ?.textContent?.includes("Task")
      );
      if (createButton) {
        console.log("Clicking Create Template button for tasks");
        createButton.click();
      } else {
        console.log("Create Template button for tasks not found");
        // Debug: log all available buttons
        buttons.forEach((btn, index) => {
          console.log(`Button ${index}:`, btn.textContent);
        });
      }
    });

    // Wait for template creation to complete
    await context.page.waitForTimeout(2000);

    // Verify the custom template was created with the correct name
    const templateExists = await fileExists(
      context.page,
      "Templates/CustomTask.md"
    );
    expect(templateExists).toBe(true);
  });
});
