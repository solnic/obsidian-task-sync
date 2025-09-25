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
  type Project,
  type Area,
  type TaskSource,
  type TaskStatus
} from "../../src/app/core/entities";

describe("Core Domain Entities", () => {
  describe("TaskStatusSchema", () => {
    test("should validate valid task statuses", () => {
      expect(TaskStatusSchema.parse("Backlog")).toBe("Backlog");
      expect(TaskStatusSchema.parse("In Progress")).toBe("In Progress");
      expect(TaskStatusSchema.parse("Done")).toBe("Done");
      expect(TaskStatusSchema.parse("Cancelled")).toBe("Cancelled");
    });

    test("should reject invalid task statuses", () => {
      expect(() => TaskStatusSchema.parse("Invalid")).toThrow();
      expect(() => TaskStatusSchema.parse("")).toThrow();
      expect(() => TaskStatusSchema.parse(null)).toThrow();
    });
  });

  describe("TaskSourceSchema", () => {
    test("should validate valid task source", () => {
      const validSource = {
        extensionId: "obsidian",
        sourceId: "Tasks/test-task.md"
      };
      
      const result = TaskSourceSchema.parse(validSource);
      expect(result.extensionId).toBe("obsidian");
      expect(result.sourceId).toBe("Tasks/test-task.md");
    });

    test("should require extensionId and sourceId", () => {
      expect(() => TaskSourceSchema.parse({})).toThrow();
      expect(() => TaskSourceSchema.parse({ extensionId: "obsidian" })).toThrow();
      expect(() => TaskSourceSchema.parse({ sourceId: "test" })).toThrow();
    });
  });

  describe("TaskSchema", () => {
    test("should validate minimal valid task", () => {
      const validTask = {
        id: "task-1",
        title: "Test Task",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01")
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
          extensionId: "github",
          sourceId: "issue-123"
        }
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
      expect(result.source?.extensionId).toBe("github");
      expect(result.source?.sourceId).toBe("issue-123");
    });

    test("should require id, title, createdAt, and updatedAt", () => {
      expect(() => TaskSchema.parse({})).toThrow();
      expect(() => TaskSchema.parse({ id: "task-1" })).toThrow();
      expect(() => TaskSchema.parse({ id: "task-1", title: "Test" })).toThrow();
      expect(() => TaskSchema.parse({ 
        id: "task-1", 
        title: "Test", 
        createdAt: new Date() 
      })).toThrow();
    });

    test("should make Task type readonly", () => {
      const task: Task = {
        id: "task-1",
        title: "Test Task",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // TypeScript should prevent modification
      // @ts-expect-error - Task should be readonly
      task.title = "Modified Title";
    });
  });

  describe("ProjectSchema", () => {
    test("should validate minimal valid project", () => {
      const validProject = {
        id: "project-1",
        name: "Test Project",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01")
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
          extensionId: "obsidian",
          sourceId: "Projects/complete-project.md"
        }
      };

      const result = ProjectSchema.parse(completeProject);
      expect(result.name).toBe("Complete Project");
      expect(result.description).toBe("A project with all properties");
      expect(result.areas).toEqual(["area-1"]);
      expect(result.tags).toEqual(["important"]);
      expect(result.source?.extensionId).toBe("obsidian");
    });

    test("should require id, name, createdAt, and updatedAt", () => {
      expect(() => ProjectSchema.parse({})).toThrow();
      expect(() => ProjectSchema.parse({ id: "project-1" })).toThrow();
      expect(() => ProjectSchema.parse({ id: "project-1", name: "Test" })).toThrow();
    });
  });

  describe("AreaSchema", () => {
    test("should validate minimal valid area", () => {
      const validArea = {
        id: "area-1",
        name: "Test Area",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01")
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
          extensionId: "obsidian",
          sourceId: "Areas/complete-area.md"
        }
      };

      const result = AreaSchema.parse(completeArea);
      expect(result.name).toBe("Complete Area");
      expect(result.description).toBe("An area with all properties");
      expect(result.tags).toEqual(["context"]);
      expect(result.source?.extensionId).toBe("obsidian");
    });

    test("should require id, name, createdAt, and updatedAt", () => {
      expect(() => AreaSchema.parse({})).toThrow();
      expect(() => AreaSchema.parse({ id: "area-1" })).toThrow();
      expect(() => AreaSchema.parse({ id: "area-1", name: "Test" })).toThrow();
    });
  });
});
