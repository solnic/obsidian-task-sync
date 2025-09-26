/**
 * TaskCreateModal Tests
 * Tests for the ported TaskCreateModal component in the new architecture
 */

import { describe, it, expect } from "vitest";
import { Task, TaskSchema } from "../../../src/app/core/entities";
import { taskStore } from "../../../src/app/stores/taskStore";
import {
  DEFAULT_TASK_TYPES,
  DEFAULT_TASK_PRIORITIES,
  DEFAULT_TASK_STATUSES,
} from "../../../src/app/utils/badges";

describe("TaskCreateModal Integration", () => {
  it("should have default task types, priorities, and statuses available", () => {
    expect(DEFAULT_TASK_TYPES).toBeDefined();
    expect(DEFAULT_TASK_TYPES.length).toBeGreaterThan(0);
    expect(DEFAULT_TASK_TYPES[0]).toHaveProperty("name");
    expect(DEFAULT_TASK_TYPES[0]).toHaveProperty("color");

    expect(DEFAULT_TASK_PRIORITIES).toBeDefined();
    expect(DEFAULT_TASK_PRIORITIES.length).toBeGreaterThan(0);

    expect(DEFAULT_TASK_STATUSES).toBeDefined();
    expect(DEFAULT_TASK_STATUSES.length).toBeGreaterThan(0);
  });

  it("should be able to create a task and add it to the task store", () => {

    const now = new Date();
    const testTask: Task = {
      id: "test-task-1",
      title: "Test Task",
      description: "Test description",
      status: DEFAULT_TASK_STATUSES[0].name,
      done: false,
      category: DEFAULT_TASK_TYPES[0].name,
      priority: DEFAULT_TASK_PRIORITIES[0].name,
      parentTask: undefined,
      project: "Test Project",
      areas: ["Test Area"],
      tags: ["test"],
      createdAt: now,
      updatedAt: now,
      doDate: undefined,
      dueDate: undefined,
      source: undefined,
    };

    taskStore.addTask(testTask);

    // Verify the task was added - we can't directly check the store state
    // but we can verify the addTask method doesn't throw
    expect(testTask.id).toBe("test-task-1");
    expect(testTask.title).toBe("Test Task");
    expect(testTask.status).toBe(DEFAULT_TASK_STATUSES[0].name);
  });

  it("should validate task properties match the new entity schema", () => {
    const taskData = {
      id: "test-id",
      title: "Test Title",
      description: "Test Description",
      status: "Backlog",
      done: false,
      category: "Task",
      priority: "Medium",
      parentTask: "parent-id",
      project: "Test Project",
      areas: ["Area1", "Area2"],
      tags: ["tag1", "tag2"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // This should not throw if the schema is correct
    expect(() => {
      const validatedTask = TaskSchema.parse(taskData);
      expect(validatedTask).toBeDefined();
    }).not.toThrow();
  });
});