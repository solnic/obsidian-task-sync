/**
 * End-to-End Tests for TaskFileManager Service
 * Tests the complete TaskFileManager functionality in a real Obsidian environment
 */

import { test, expect, describe, beforeEach } from "vitest";
import {
  fileExists,
  verifyTaskProperties,
  createFullyQualifiedLink,
} from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createTask } from "../helpers/entity-helpers";

describe("TaskFileManager Service", () => {
  const context = setupE2ETestHooks();

  test("should create task file with sanitized name and proper front-matter", async () => {
    const taskData = {
      title: "Fix: Bug/Issue #123",
      priority: "High",
      areas: ["Development"],
      project: "Website Redesign",
      done: false,
      status: "In Progress",
    };

    const taskPath = await context.page.evaluate(async (data) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Access the taskFileManager instance
      const taskFileManager = plugin.taskFileManager;

      return await taskFileManager.createTaskFile(data);
    }, taskData);

    // Verify the task file was created with sanitized name
    const sanitizedName = "Fix- Bug-Issue -123";
    expect(taskPath).toBe(`Tasks/${sanitizedName}.md`);

    const taskExists = await fileExists(context.page, taskPath);
    expect(taskExists).toBe(true);

    // Verify the task front-matter has proper structure using helper
    await verifyTaskProperties(context.page, taskPath, {
      Title: taskData.title,
      Type: "Task",
      Priority: taskData.priority,
      Areas: [createFullyQualifiedLink("Development", "Areas")],
      Project: createFullyQualifiedLink("Website Redesign", "Projects"),
      Done: taskData.done,
      Status: taskData.status,
    });
  });

  test("should load front-matter from existing task file", async () => {
    await createTask(context, {
      title: "Test Task",
      priority: "Medium",
      areas: ["Development", "Testing"],
      project: "Test Project",
      done: false,
      status: "Todo",
    });

    // Test loading front-matter using helper
    await verifyTaskProperties(context.page, "Tasks/Test Task.md", {
      Title: "Test Task",
      Type: "Task",
      Priority: "Medium",
      Areas: [
        createFullyQualifiedLink("Development", "Areas"),
        createFullyQualifiedLink("Testing", "Areas"),
      ],
      Project: createFullyQualifiedLink("Test Project", "Projects"),
      Done: false,
      Status: "Todo",
    });
  });

  test("should extract file content after front-matter", async () => {
    await createTask(
      context,
      {
        title: "Content Test Task",
      },
      `## Description

This is the main content of the task.

## Notes

- Note 1
- Note 2`
    );

    const fileContent = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskFileManager = plugin.taskFileManager;
      return await taskFileManager.getFileContent("Tasks/Content Test Task.md");
    });

    expect(fileContent).toContain("## Description");
    expect(fileContent).toContain("This is the main content of the task.");
    expect(fileContent).toContain("## Notes");
    expect(fileContent).toContain("- Note 1");
    expect(fileContent).toContain("- Note 2");
    expect(fileContent).not.toContain("---");
    expect(fileContent).not.toContain("Title: Content Test Task");
  });

  test("should change task status using Done property", async () => {
    await createTask(context, {
      title: "Status Test Task",
      done: false,
      status: "Todo",
    });

    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.changeTaskStatus("Tasks/Status Test Task.md", true);
    });

    await verifyTaskProperties(context.page, "Tasks/Status Test Task.md", {
      Done: true,
    });
  });

  test("should change task status using Status property", async () => {
    await createTask(context, {
      title: "Status String Test Task",
      done: false,
      status: "Todo",
    });

    // Test changing task status via Status property
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.changeTaskStatus(
        "Tasks/Status String Test Task.md",
        "Completed"
      );
    });

    await verifyTaskProperties(
      context.page,
      "Tasks/Status String Test Task.md",
      {
        Status: "Completed",
      }
    );
  });

  test("should assign task to project", async () => {
    await createTask(
      context,
      {
        title: "Project Assignment Test",
        project: "Old Project",
      },
      "Task content here."
    );

    // Test assigning to a new project
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.assignToProject(
        "Tasks/Project Assignment Test.md",
        "New Project"
      );
    });

    await verifyTaskProperties(
      context.page,
      "Tasks/Project Assignment Test.md",
      {
        Project: "[[New Project]]",
      }
    );
  });

  test("should assign task to areas", async () => {
    await createTask(
      context,
      {
        title: "Areas Assignment Test",
        areas: ["Development"],
      },
      "Task content here."
    );

    // Test assigning to new areas
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.assignToAreas("Tasks/Areas Assignment Test.md", [
        "Testing",
        "Documentation",
      ]);
    });

    await verifyTaskProperties(context.page, "Tasks/Areas Assignment Test.md", {
      Areas: ["[[Testing]]", "[[Documentation]]"],
    });
  });

  test("should update specific front-matter property", async () => {
    // Create a test task file using entity helper
    await createTask(
      context,
      {
        title: "Property Update Test",
        priority: "Low",
      },
      "Task content here."
    );

    // Test updating a specific property
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskFileManager = plugin.taskFileManager;
      await taskFileManager.updateProperty(
        "Tasks/Property Update Test.md",
        "Priority",
        "Critical"
      );
    });

    await verifyTaskProperties(context.page, "Tasks/Property Update Test.md", {
      Priority: "Critical",
    });
  });

  test("should create task with description as file content, not just in front-matter", async () => {
    // Test creating a task file with description
    const taskData = {
      title: "Task with Description",
      priority: "Medium",
    };
    const description =
      "This is a detailed task description that should appear as the file content.";

    const taskPath = await context.page.evaluate(
      async ({ data, content }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];

        // Access the taskFileManager instance and call it with content parameter
        const taskFileManager = plugin.taskFileManager;

        return await taskFileManager.createTaskFile(data, content);
      },
      { data: taskData, content: description }
    );

    // Verify the task file was created
    const taskExists = await fileExists(context.page, taskPath);
    expect(taskExists).toBe(true);

    // Get the full file content
    const fullContent = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        return await app.vault.read(file);
      }
      return "";
    }, taskPath);

    // Verify the description appears as file content (after front-matter)
    expect(fullContent).toContain(
      "This is a detailed task description that should appear as the file content."
    );

    // Verify the description is not just in front-matter but in the body
    const lines = fullContent.split("\n");
    const frontMatterEndIndex = lines.findIndex(
      (line: string, index: number) => index > 0 && line === "---"
    );
    const bodyContent = lines.slice(frontMatterEndIndex + 1).join("\n");

    expect(bodyContent.trim()).toContain(
      "This is a detailed task description that should appear as the file content."
    );
  });

  test("should create task with Do Date property", async () => {
    const taskData = {
      title: "Task with Do Date",
      priority: "Medium",
      doDate: "2024-01-15",
      done: false,
      status: "Backlog",
    };

    const taskPath = await context.page.evaluate(async (data) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Access the taskFileManager instance
      const taskFileManager = plugin.taskFileManager;

      return await taskFileManager.createTaskFile(data);
    }, taskData);

    // Verify the task file was created
    const taskExists = await fileExists(context.page, taskPath);
    expect(taskExists).toBe(true);

    // Verify Do Date property is in front-matter
    await verifyTaskProperties(context.page, taskPath, {
      Title: "Task with Do Date",
      Priority: "Medium",
      "Do Date": "2024-01-15T00:00:00.000Z",
      Done: false,
      Status: "Backlog",
    });
  });

  test(
    "should update file properties using property sets and processFrontmatter",
    { retry: 3 },
    async () => {
      // Create a task with some properties
      await createTask(context, {
        title: "Property Set Test Task",
        priority: "Low",
        areas: ["Development"],
        done: false,
        status: "Todo",
      });

      // Add some extra properties that should be removed
      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(
          "Tasks/Property Set Test Task.md"
        );
        const content = await app.vault.read(file);

        // Add obsolete properties that should be removed
        const updatedContent = content.replace(
          "Status: Todo",
          "Status: Todo\nObsoleteField: should be removed\nAnotherOldField: also removed"
        );

        await app.vault.modify(file, updatedContent);
      });

      // Test updating file properties using the refactored method
      const result = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const taskFileManager = plugin.taskFileManager;

        return await taskFileManager.updateTaskFileProperties(
          "Tasks/Property Set Test Task.md"
        );
      });

      // Verify the method detected changes
      expect(result.hasChanges).toBe(true);
      expect(result.propertiesChanged).toBeGreaterThan(0);

      // Verify the file now only contains properties from the property set
      const finalContent = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(
          "Tasks/Property Set Test Task.md"
        );
        return await app.vault.read(file);
      });

      // Should contain all required properties from TASK_FRONTMATTER set
      expect(finalContent).toContain("Title:");
      expect(finalContent).toContain("Type:");
      expect(finalContent).toContain("Priority:");
      expect(finalContent).toContain("Areas:");
      expect(finalContent).toContain("Done:");
      expect(finalContent).toContain("Status:");

      // Verify properties are in the correct order (Title should come first)
      const lines: string[] = finalContent.split("\n");
      const frontMatterStart: number = lines.findIndex(
        (line) => line === "---"
      );
      const frontMatterEnd: number = lines.findIndex(
        (line: string, index: number) =>
          index > frontMatterStart && line === "---"
      );
      const frontMatterLines: string[] = lines.slice(
        frontMatterStart + 1,
        frontMatterEnd
      );

      const titleIndex: number = frontMatterLines.findIndex((line) =>
        line.startsWith("Title:")
      );
      const typeIndex: number = frontMatterLines.findIndex((line) =>
        line.startsWith("Type:")
      );

      expect(titleIndex).toBeLessThan(typeIndex); // Title should come before Type
    }
  );
});
