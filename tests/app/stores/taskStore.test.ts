/**
 * Tests for TaskStore upsert functionality
 * Tests natural key-based entity management and ID generation
 */

import { describe, test, expect, beforeEach } from "vitest";
import { createTaskStore } from "../../../src/app/stores/taskStore";
import type { Task } from "../../../src/app/core/entities";

describe("TaskStore", () => {
  let store: ReturnType<typeof createTaskStore>;

  beforeEach(() => {
    store = createTaskStore();
  });

  describe("upsertTask", () => {
    test("should create new task with generated ID when natural key doesn't exist", () => {
      const taskData = {
        title: "New Task",
        description: "A new task",
        category: "Task",
        status: "Not Started",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "obsidian",
          source: "Tasks/New Task.md",
        },
        naturalKey: "Tasks/New Task.md",
      };

      const result = store.upsertTask(taskData);

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/); // ULID pattern
      expect(result.title).toBe("New Task");
      expect(result.source?.source).toBe("Tasks/New Task.md");

      // Verify task was added to store
      let storeState: any;
      const unsubscribe = store.subscribe((state) => {
        storeState = state;
      });
      unsubscribe();

      expect(storeState.tasks).toHaveLength(1);
      expect(storeState.tasks[0].id).toBe(result.id);
    });

    test("should update existing task preserving ID when natural key exists", () => {
      // First, create a task
      const originalTaskData = {
        title: "Original Task",
        description: "Original description",
        category: "Task",
        status: "Not Started",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "obsidian",
          source: "Tasks/Test Task.md",
        },
        naturalKey: "Tasks/Test Task.md",
      };

      const originalTask = store.upsertTask(originalTaskData);
      const originalId = originalTask.id;
      const originalCreatedAt = originalTask.createdAt;

      // Now update the same task (same natural key)
      const updatedTaskData = {
        title: "Updated Task",
        description: "Updated description",
        category: "Task",
        status: "In Progress",
        done: false,
        areas: ["Work"],
        tags: ["urgent"],
        createdAt: new Date("2024-01-01"), // This should be ignored
        updatedAt: new Date("2024-01-02"),
        source: {
          extension: "obsidian",
          source: "Tasks/Test Task.md",
        },
        naturalKey: "Tasks/Test Task.md",
      };

      const updatedTask = store.upsertTask(updatedTaskData);

      // Should preserve original ID and createdAt
      expect(updatedTask.id).toBe(originalId);
      expect(updatedTask.createdAt).toEqual(originalCreatedAt);

      // Should update other fields
      expect(updatedTask.title).toBe("Updated Task");
      expect(updatedTask.description).toBe("Updated description");
      expect(updatedTask.status).toBe("In Progress");
      expect(updatedTask.areas).toEqual(["Work"]);
      expect(updatedTask.tags).toEqual(["urgent"]);

      // Verify only one task in store
      let storeState: any;
      const unsubscribe = store.subscribe((state) => {
        storeState = state;
      });
      unsubscribe();

      expect(storeState.tasks).toHaveLength(1);
      expect(storeState.tasks[0].id).toBe(originalId);
      expect(storeState.tasks[0].title).toBe("Updated Task");
    });

    test("should handle multiple tasks with different natural keys", () => {
      const task1Data = {
        title: "Task 1",
        description: "",
        category: "Task",
        status: "Not Started",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "obsidian",
          source: "Tasks/Task 1.md",
        },
        naturalKey: "Tasks/Task 1.md",
      };

      const task2Data = {
        title: "Task 2",
        description: "",
        category: "Task",
        status: "Not Started",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "obsidian",
          source: "Tasks/Task 2.md",
        },
        naturalKey: "Tasks/Task 2.md",
      };

      const result1 = store.upsertTask(task1Data);
      const result2 = store.upsertTask(task2Data);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.title).toBe("Task 1");
      expect(result2.title).toBe("Task 2");

      // Verify both tasks in store
      let storeState: any;
      const unsubscribe = store.subscribe((state) => {
        storeState = state;
      });
      unsubscribe();

      expect(storeState.tasks).toHaveLength(2);
    });
  });
});
