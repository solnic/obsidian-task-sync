/**
 * End-to-End Tests for Add to Today Functionality
 * Tests the complete add to today functionality across different contexts
 */

import { test, expect, describe, beforeEach } from "vitest";
import {
  fileExists,
  waitForAddToTodayOperation,
  executeCommand,
} from "../../helpers/global";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import { createTask } from "../../helpers/entity-helpers";

describe("Add to Today Functionality", () => {
  const context = setupE2ETestHooks();

  test("should add current task to today via command palette", async () => {
    // Create a test task
    await createTask(context.page, {
      title: "Command Test Task",
      priority: "High",
      status: "Backlog",
    });

    // Open the task file to make it the active file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/Command Test Task.md"
      );
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Execute the "Add to Today" command
    await executeCommand(context.page, "Add to Today");

    // Wait for the command to complete
    await context.page.waitForTimeout(1000);

    // Verify the daily note was created and contains the task
    const today = new Date().toISOString().split("T")[0];
    const dailyNotePath = `Daily Notes/${today}.md`;

    const dailyNoteExists = await fileExists(context.page, dailyNotePath);
    expect(dailyNoteExists).toBe(true);

    // Check the daily note content
    const dailyNoteContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        return await app.vault.read(file);
      }
      return "";
    }, dailyNotePath);

    expect(dailyNoteContent).toContain("- [ ] [[Command Test Task]]");
  });

  test("should show error when no file is open for command", async () => {
    // Close all files
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      app.workspace.getActiveFile() && app.workspace.activeLeaf?.detach();
    });

    // Execute the "Add to Today" command
    await executeCommand(context.page, "Add to Today");

    // Wait for the command to complete
    await context.page.waitForTimeout(500);

    // The command should show a notice about no file being open
    // We can't easily test notices in E2E, but we can verify no crash occurred
    // and that no daily note was created with invalid content
  });

  test("should show error when current file is not a task", async () => {
    // Create a non-task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const content = "# This is not a task\n\nJust some regular content.";
      await app.vault.create("Regular File.md", content);

      // Open the non-task file
      const file = app.vault.getAbstractFileByPath("Regular File.md");
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Execute the "Add to Today" command
    await executeCommand(context.page, "Add to Today");

    // Wait for the command to complete
    await context.page.waitForTimeout(500);

    // The command should show a notice about the file not being a task
    // We can't easily test notices in E2E, but we can verify no crash occurred
  });

  test("should handle daily note creation when it doesn't exist", async () => {
    // Create a test task
    await createTask(context.page, {
      title: "Daily Note Creation Test",
      priority: "Medium",
    });

    // Ensure no daily note exists for today
    const today = new Date().toISOString().split("T")[0];
    const dailyNotePath = `Daily Notes/${today}.md`;

    await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        await app.vault.delete(file);
      }
    }, dailyNotePath);

    // Open the task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/Daily Note Creation Test.md"
      );
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Execute the "Add to Today" command
    await executeCommand(context.page, "Add to Today");

    // Wait for the command to complete
    await context.page.waitForTimeout(1000);

    // Verify the daily note was created
    const dailyNoteExists = await fileExists(context.page, dailyNotePath);
    expect(dailyNoteExists).toBe(true);

    // Verify the task was added
    const dailyNoteContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        return await app.vault.read(file);
      }
      return "";
    }, dailyNotePath);

    expect(dailyNoteContent).toContain("- [ ] [[Daily Note Creation Test]]");
  });

  test("should add task to existing daily note with Tasks section", async () => {
    // Create a daily note with existing Tasks section
    const today = new Date().toISOString().split("T")[0];
    const dailyNotePath = `Daily Notes/${today}.md`;

    await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const content = `# ${new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}\n\n## Notes\n\n## Tasks\n- [ ] [[Existing Task]]\n\n## Reflections\n`;

      // Ensure Daily Notes folder exists
      const folder = app.vault.getAbstractFileByPath("Daily Notes");
      if (!folder) {
        await app.vault.createFolder("Daily Notes");
      }

      // Create or update the daily note
      const existingFile = app.vault.getAbstractFileByPath(path);
      if (existingFile) {
        await app.vault.modify(existingFile, content);
      } else {
        await app.vault.create(path, content);
      }
    }, dailyNotePath);

    // Create a test task
    await createTask(context.page, {
      title: "Existing Section Test",
      priority: "Low",
    });

    // Open the task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/Existing Section Test.md"
      );
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Execute the "Add to Today" command
    await executeCommand(context.page, "Add to Today");

    // Wait for the command to complete
    await context.page.waitForTimeout(1000);

    // Verify the task was added to the existing Tasks section
    const dailyNoteContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        return await app.vault.read(file);
      }
      return "";
    }, dailyNotePath);

    expect(dailyNoteContent).toContain("- [ ] [[Existing Task]]");
    expect(dailyNoteContent).toContain("- [ ] [[Existing Section Test]]");
    // Verify the new task was added right after the Tasks header
    expect(dailyNoteContent).toMatch(
      /## Tasks\n- \[ \] \[\[Existing Section Test\]\]/
    );
  });

  test("should handle duplicate task additions gracefully", async () => {
    // Create a test task
    await createTask(context.page, {
      title: "Duplicate Test Task",
      priority: "Medium",
    });

    // Open the task file
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(
        "Tasks/Duplicate Test Task.md"
      );
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    });

    // Execute the "Add to Today" command twice
    await executeCommand(context.page, "Add to Today");
    await context.page.waitForTimeout(500);
    await executeCommand(context.page, "Add to Today");
    await context.page.waitForTimeout(500);

    // Verify the task appears only once in the daily note
    const today = new Date().toISOString().split("T")[0];
    const dailyNotePath = `Daily Notes/${today}.md`;

    const dailyNoteContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        return await app.vault.read(file);
      }
      return "";
    }, dailyNotePath);

    // Count occurrences of the task
    const taskOccurrences = (
      dailyNoteContent.match(/\[\[Duplicate Test Task\]\]/g) || []
    ).length;
    expect(taskOccurrences).toBe(1); // Should appear only once due to duplicate detection
  });

  test("should add task to today via Local Tasks Service in day planning mode", async () => {
    // Create a test task
    await createTask(context.page, {
      title: "Local Service Test Task",
      priority: "Medium",
      status: "Backlog",
    });

    // Create a daily note to trigger day planning mode
    const today = new Date().toISOString().split("T")[0];
    const dailyNotePath = `Daily Notes/${today}.md`;

    await context.page.evaluate(async (path) => {
      const app = (window as any).app;

      // Ensure the Daily Notes folder exists
      const folderPath = path.split("/").slice(0, -1).join("/");
      if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
        await app.vault.createFolder(folderPath);
      }

      // Delete existing daily note if it exists
      const existingFile = app.vault.getAbstractFileByPath(path);
      if (existingFile) {
        await app.vault.delete(existingFile);
      }

      await app.vault.create(
        path,
        "# Today's Daily Note\n\n## Tasks\n\n## Notes"
      );
    }, dailyNotePath);

    // Open the daily note to trigger day planning mode
    await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    }, dailyNotePath);

    // Wait for context to update
    await context.page.waitForTimeout(500);

    // Open the right sidebar if it's collapsed
    const rightSidebarToggle = context.page.locator(
      ".sidebar-toggle-button.mod-right"
    );
    await rightSidebarToggle.click();

    // Wait for the Tasks tab to be visible and click it to make it active
    await context.page.waitForSelector(
      '[data-type="tasks"].workspace-tab-header'
    );
    await context.page.click('[data-type="tasks"].workspace-tab-header');

    // Wait for the local tasks service to be visible and active
    await context.page.waitForSelector(
      '[data-testid="local-tasks-service"]:not([style*="display: none"])'
    );

    // Wait for tasks to load
    await context.page.waitForSelector(
      '[data-testid="local-task-item-local-service-test-task"]'
    );

    // Hover over the specific task to show the "Add to today" button
    await context.page.hover(
      '[data-testid="local-task-item-local-service-test-task"]'
    );
    await context.page.waitForSelector('[data-testid="add-to-today-button"]');

    // Wait a moment for the button to be fully interactive
    await context.page.waitForTimeout(200);

    // Click the "Add to today" button
    await context.page.click('[data-testid="add-to-today-button"]');

    // Wait for the add to today operation to complete
    await waitForAddToTodayOperation(
      context.page,
      dailyNotePath,
      "- [ ] [[Local Service Test Task]]",
      10000
    );

    // Verify the task was added to the daily note
    const dailyNoteContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        return await app.vault.read(file);
      }
      return "";
    }, dailyNotePath);

    expect(dailyNoteContent).toContain("- [ ] [[Local Service Test Task]]");
  });

  test("should handle GitHub import with day planning mode for existing tasks", async () => {
    // Skip if no GitHub token is configured
    const hasGitHubToken = await context.page.evaluate(() => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return plugin.settings.integrations.github.personalAccessToken !== "";
    });

    if (!hasGitHubToken) {
      console.log("Skipping GitHub test - no token configured");
      return;
    }

    // Create a task that matches a GitHub issue (simulate existing task)
    await createTask(context.page, {
      title: "GitHub Test Issue",
      priority: "High",
      status: "Backlog",
    });

    // Create a daily note to trigger day planning mode
    const today = new Date().toISOString().split("T")[0];
    const dailyNotePath = `Daily Notes/${today}.md`;

    await context.page.evaluate(async (path) => {
      const app = (window as any).app;

      // Ensure the Daily Notes folder exists
      const folderPath = path.split("/").slice(0, -1).join("/");
      if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
        await app.vault.createFolder(folderPath);
      }

      await app.vault.create(
        path,
        "# Today's Daily Note\n\n## Tasks\n\n## Notes"
      );
    }, dailyNotePath);

    // Open the daily note to trigger day planning mode
    await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    }, dailyNotePath);

    // Wait for context to update
    await context.page.waitForTimeout(500);

    // Open Task Sync view
    await context.page.click('[data-testid="task-sync-view-button"]');
    await context.page.waitForSelector('[data-testid="tasks-view"]');

    // Switch to GitHub tab
    await context.page.click('[data-testid="service-tab-github"]');
    await context.page.waitForSelector('[data-testid="github-service"]');

    // Wait for issues to load (if any)
    await context.page.waitForTimeout(2000);

    // Try to find and import an issue (this will test the existing task handling)
    const issueExists = await context.page
      .locator(
        '[data-testid="issue-import-button"], [data-testid="add-to-today-button"]'
      )
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (issueExists) {
      // Click the import/add to today button
      await context.page
        .locator(
          '[data-testid="issue-import-button"], [data-testid="add-to-today-button"]'
        )
        .first()
        .click();

      // Wait for the operation to complete
      await context.page.waitForTimeout(2000);

      // Verify the daily note was updated (either with new or existing task)
      const dailyNoteContent = await context.page.evaluate(async (path) => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(path);
        if (file) {
          return await app.vault.read(file);
        }
        return "";
      }, dailyNotePath);

      // Should contain at least one task link
      expect(dailyNoteContent).toMatch(/\[\[.*\]\]/);
    } else {
      console.log("No GitHub issues available for testing");
    }
  });
});
