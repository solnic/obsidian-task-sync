/**
 * Tests for core domain entities with Zod validation
 * Tests TaskSchema, ProjectSchema, AreaSchema, and TaskSourceSchema
 */

import { describe, test, expect } from "vitest";
import {
  TaskSchema,
  ProjectSchema,
  AreaSchema,
  TaskSourceSchema,
  TaskStatusSchema,
  type Task,
  type TaskStatus,
} from "../../../src/app/core/entities";

describe("Core Domain Entities", () => {
  describe("TaskStatusSchema", () => {
    test("should validate any string as task status", () => {
      expect(TaskStatusSchema.parse("Backlog")).toBe("Backlog");
      expect(TaskStatusSchema.parse("In Progress")).toBe("In Progress");
      expect(TaskStatusSchema.parse("Done")).toBe("Done");
      expect(TaskStatusSchema.parse("Cancelled")).toBe("Cancelled");
      expect(TaskStatusSchema.parse("Custom Status")).toBe("Custom Status");
      expect(TaskStatusSchema.parse("Another Status")).toBe("Another Status");
    });

    test("should reject non-string task statuses", () => {
      expect(() => TaskStatusSchema.parse(123)).toThrow();
      expect(() => TaskStatusSchema.parse(null)).toThrow();
      expect(() => TaskStatusSchema.parse(undefined)).toThrow();
      expect(() => TaskStatusSchema.parse({})).toThrow();
    });

    test("should reject empty string task statuses", () => {
      expect(() => TaskStatusSchema.parse("")).toThrow();
    });
  });

  describe("TaskSourceSchema", () => {
    test("should validate valid task source", () => {
      const validSource = {
        extension: "obsidian",
        keys: {
          obsidian: "Tasks/test-task.md",
        },
      };

      const result = TaskSourceSchema.parse(validSource);
      expect(result.extension).toBe("obsidian");
      expect(result.keys.obsidian).toBe("Tasks/test-task.md");
    });

    test("should require extension and keys", () => {
      expect(() => TaskSourceSchema.parse({})).toThrow();
      expect(() =>
        TaskSourceSchema.parse({ extension: "obsidian" })
      ).not.toThrow();
      expect(() => TaskSourceSchema.parse({ keys: {} })).toThrow();
    });
  });

  describe("TaskSchema", () => {
    test("should validate minimal valid task", () => {
      const validTask = {
        id: "task-1",
        title: "Test Task",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = TaskSchema.parse(validTask);
      expect(result.id).toBe("task-1");
      expect(result.title).toBe("Test Task");
      expect(result.status).toBe("Backlog"); // default value
      expect(result.done).toBe(false); // default value
      expect(result.areas).toEqual([]); // default value
      expect(result.tags).toEqual([]); // default value
    });

    test("should validate complete task with all properties", () => {
      const completeTask = {
        id: "task-2",
        title: "Complete Task",
        description: "A task with all properties",
        status: "In Progress" as TaskStatus,
        done: false,
        category: "Development",
        priority: "High",
        parentTask: "parent-task-1",
        project: "project-1",
        areas: ["area-1", "area-2"],
        tags: ["urgent", "feature"],
        doDate: new Date("2024-02-01"),
        dueDate: new Date("2024-02-15"),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        source: {
          extension: "github",
          keys: {
            obsidian: "issue-123",
          },
        },
      };

      const result = TaskSchema.parse(completeTask);
      expect(result.id).toBe("task-2");
      expect(result.title).toBe("Complete Task");
      expect(result.description).toBe("A task with all properties");
      expect(result.status).toBe("In Progress");
      expect(result.category).toBe("Development");
      expect(result.priority).toBe("High");
      expect(result.parentTask).toBe("parent-task-1");
      expect(result.project).toBe("project-1");
      expect(result.areas).toEqual(["area-1", "area-2"]);
      expect(result.tags).toEqual(["urgent", "feature"]);
      expect(result.doDate).toEqual(new Date("2024-02-01"));
      expect(result.dueDate).toEqual(new Date("2024-02-15"));
      expect(result.source.extension).toBe("github");
      expect(result.source.keys.obsidian).toBe("issue-123");
    });

    test("should require id, title, createdAt, and updatedAt", () => {
      expect(() => TaskSchema.parse({})).toThrow();
      expect(() => TaskSchema.parse({ id: "task-1" })).toThrow();
      expect(() => TaskSchema.parse({ id: "task-1", title: "Test" })).toThrow();
      expect(() =>
        TaskSchema.parse({
          id: "task-1",
          title: "Test",
          createdAt: new Date(),
        })
      ).toThrow();
    });

    test("should make Task type readonly", () => {
      const task: Task = {
        id: "task-1",
        title: "Test Task",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // TypeScript should prevent modification
      // @ts-expect-error - Task should be readonly
      task.title = "Modified Title";
    });

    test("should accept null for optional fields and convert to undefined", () => {
      const taskWithNulls = {
        id: "task-3",
        title: "Task with nulls",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        parentTask: null,
        project: null,
        category: null,
        priority: null,
        description: null,
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = TaskSchema.parse(taskWithNulls);
      expect(result.parentTask).toBeUndefined();
      expect(result.project).toBeUndefined();
      expect(result.category).toBeUndefined();
      expect(result.priority).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe("ProjectSchema", () => {
    test("should validate minimal valid project", () => {
      const validProject = {
        id: "project-1",
        name: "Test Project",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = ProjectSchema.parse(validProject);
      expect(result.id).toBe("project-1");
      expect(result.name).toBe("Test Project");
      expect(result.areas).toEqual([]); // default value
      expect(result.tags).toEqual([]); // default value
    });

    test("should validate complete project", () => {
      const completeProject = {
        id: "project-2",
        name: "Complete Project",
        description: "A project with all properties",
        areas: ["area-1"],
        tags: ["important"],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        source: {
          extension: "obsidian",
          filePath: "Projects/complete-project.md",
        },
      };

      const result = ProjectSchema.parse(completeProject);
      expect(result.name).toBe("Complete Project");
      expect(result.description).toBe("A project with all properties");
      expect(result.areas).toEqual(["area-1"]);
      expect(result.tags).toEqual(["important"]);
      expect(result.source.extension).toBe("obsidian");
    });

    test("should require id, name, createdAt, and updatedAt", () => {
      expect(() => ProjectSchema.parse({})).toThrow();
      expect(() => ProjectSchema.parse({ id: "project-1" })).toThrow();
      expect(() =>
        ProjectSchema.parse({ id: "project-1", name: "Test" })
      ).toThrow();
    });
  });

  describe("AreaSchema", () => {
    test("should validate minimal valid area", () => {
      const validArea = {
        id: "area-1",
        name: "Test Area",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = AreaSchema.parse(validArea);
      expect(result.id).toBe("area-1");
      expect(result.name).toBe("Test Area");
      expect(result.tags).toEqual([]); // default value
    });

    test("should validate complete area", () => {
      const completeArea = {
        id: "area-2",
        name: "Complete Area",
        description: "An area with all properties",
        tags: ["context"],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        source: {
          extension: "obsidian",
          source: "Areas/complete-area.md",
        },
      };

      const result = AreaSchema.parse(completeArea);
      expect(result.name).toBe("Complete Area");
      expect(result.description).toBe("An area with all properties");
      expect(result.tags).toEqual(["context"]);
      expect(result.source.extension).toBe("obsidian");
    });

    test("should require id, name, createdAt, and updatedAt", () => {
      expect(() => AreaSchema.parse({})).toThrow();
      expect(() => AreaSchema.parse({ id: "area-1" })).toThrow();
      expect(() => AreaSchema.parse({ id: "area-1", name: "Test" })).toThrow();
    });
  });
});
