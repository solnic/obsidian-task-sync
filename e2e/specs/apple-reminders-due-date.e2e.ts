/**
 * E2E tests for Apple Reminders due date support
 */

import { test, expect, describe } from "vitest";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createTask } from "../helpers/entity-helpers";
import { assertTaskProperty } from "../helpers/task-sync-setup";

describe("Apple Reminders Due Date Support", () => {
  const context = setupE2ETestHooks();

  test("should include Due Date property in task property definitions", async () => {
    // Check if Due Date property is defined in the property registry
    const hasDueDateProperty = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) return false;

      // Check if Due Date is in the property registry
      const { PROPERTY_REGISTRY } = await import(
        "../src/services/base-definitions/BaseConfigurations"
      );
      return "DUE_DATE" in PROPERTY_REGISTRY;
    });

    expect(hasDueDateProperty).toBe(true);
  });

  test("should include Due Date in task front-matter property sets", async () => {
    // Check if Due Date is included in task property sets
    const isDueDateInPropertySets = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) return false;

      // Check if Due Date is in the task property sets
      const { PROPERTY_SETS } = await import(
        "../src/services/base-definitions/BaseConfigurations"
      );
      return (
        PROPERTY_SETS.TASK_FRONTMATTER.includes("DUE_DATE") &&
        PROPERTY_SETS.TASKS_BASE.includes("DUE_DATE")
      );
    });

    expect(isDueDateInPropertySets).toBe(true);
  });

  test("should create task with Due Date property when provided", async () => {
    // Create a test task with due date using the plugin's task creation
    const taskTitle = "Test Task with Due Date";
    const dueDate = "2024-01-15";

    const task = await createTask(context, {
      title: taskTitle,
      category: "Task",
      priority: "Medium",
      dueDate: dueDate,
    });

    // Verify the task was created with the due date
    await assertTaskProperty(context.page, task.filePath, "Due Date", dueDate);
    await assertTaskProperty(context.page, task.filePath, "Title", taskTitle);
    await assertTaskProperty(context.page, task.filePath, "Priority", "Medium");
  });

  test("should handle tasks without due dates correctly", async () => {
    // Create a test task without due date
    const taskTitle = "Test Task without Due Date";

    const task = await createTask(context, {
      title: taskTitle,
      category: "Task",
      priority: "Low",
      // No due date provided
    });

    // Verify the task was created without due date
    await assertTaskProperty(context.page, task.filePath, "Title", taskTitle);
    await assertTaskProperty(context.page, task.filePath, "Priority", "Low");

    // Check that Due Date property is not set (should be empty/undefined)
    const dueDateValue = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;

      const content = await app.vault.read(file);
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontMatterMatch) return null;

      const frontMatter = frontMatterMatch[1];
      const dueDateMatch = frontMatter.match(/^Due Date:\s*(.*)$/m);
      return dueDateMatch ? dueDateMatch[1].trim() : undefined;
    }, task.filePath);

    // Due Date should either be undefined or empty
    expect(dueDateValue === undefined || dueDateValue === "").toBe(true);
  });

  test("should validate Due Date property definition", async () => {
    // Check the Due Date property definition details
    const dueDatePropertyDef = await context.page.evaluate(async () => {
      const { PROPERTY_REGISTRY } = await import(
        "../src/services/base-definitions/BaseConfigurations"
      );
      return PROPERTY_REGISTRY.DUE_DATE;
    });

    expect(dueDatePropertyDef).toBeDefined();
    expect(dueDatePropertyDef.key).toBe("dueDate");
    expect(dueDatePropertyDef.name).toBe("Due Date");
    expect(dueDatePropertyDef.type).toBe("date");
    expect(dueDatePropertyDef.frontmatter).toBe(true);
  });

  test("should format due dates correctly in front-matter", async () => {
    // Test various date formats
    const testCases = [
      { input: "2024-01-15", expected: "2024-01-15" },
      { input: "2024-12-31", expected: "2024-12-31" },
      { input: "2024-02-29", expected: "2024-02-29" }, // Leap year
    ];

    for (const testCase of testCases) {
      const taskTitle = `Task with due date ${testCase.input}`;

      const task = await createTask(context, {
        title: taskTitle,
        category: "Task",
        dueDate: testCase.input,
      });

      await assertTaskProperty(
        context.page,
        task.filePath,
        "Due Date",
        testCase.expected
      );
    }
  });

  test("should support Due Date in task bases and views", async () => {
    // Check if Due Date is included in the generated task base
    const isDueDateInTaskBase = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) return false;

      // Check if the Tasks base file includes Due Date
      const tasksBaseFile = app.vault.getAbstractFileByPath("Bases/Tasks.base");
      if (!tasksBaseFile) return false;

      const content = await app.vault.read(tasksBaseFile);
      return content.includes("Due Date") || content.includes("dueDate");
    });

    expect(isDueDateInTaskBase).toBe(true);
  });

  test("should maintain Due Date property order in front-matter", async () => {
    // Create a task and check the property order
    const taskTitle = "Task for Property Order Test";
    const dueDate = "2024-06-15";

    const task = await createTask(context, {
      title: taskTitle,
      category: "Feature",
      priority: "High",
      dueDate: dueDate,
    });

    // Get the front-matter content and check property order
    const frontMatterContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return null;

      const content = await app.vault.read(file);
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      return frontMatterMatch ? frontMatterMatch[1] : null;
    }, task.filePath);

    expect(frontMatterContent).toBeDefined();
    expect(frontMatterContent).toContain("Title:");
    expect(frontMatterContent).toContain("Due Date:");
    expect(frontMatterContent).toContain(dueDate);

    // Verify Due Date comes after Do Date (if present) and before tags
    const lines = frontMatterContent!.split("\n");
    const dueDateLineIndex = lines.findIndex((line) =>
      line.startsWith("Due Date:")
    );
    const tagsLineIndex = lines.findIndex((line) => line.startsWith("tags:"));

    expect(dueDateLineIndex).toBeGreaterThan(-1);
    if (tagsLineIndex > -1) {
      expect(dueDateLineIndex).toBeLessThan(tagsLineIndex);
    }
  });
});
