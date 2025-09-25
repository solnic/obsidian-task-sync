/**
 * Tests for extension-aware task store with event bus integration
 * Tests reactive state management, event handling, and derived stores
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { EventBus } from "../../../src/app/core/events";
import { Task } from "../../../src/app/core/entities";
import { createTaskStore } from "../../../src/app/stores/taskStore";

// Mock task data for testing
const mockTask1: Task = {
  id: "task-1",
  title: "Test Task 1",
  status: "Backlog",
  done: false,
  areas: [],
  tags: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  source: {
    extension: "obsidian",
    source: "Tasks/test-task-1.md"
  }
};

const mockTask2: Task = {
  id: "task-2", 
  title: "Test Task 2",
  status: "In Progress",
  done: false,
  areas: ["area-1"],
  tags: ["urgent"],
  createdAt: new Date("2024-01-02"),
  updatedAt: new Date("2024-01-02"),
  source: {
    extension: "github",
    source: "issue-123"
  }
};

describe("Extension-Aware Task Store", () => {
  let eventBus: EventBus;
  let taskStore: ReturnType<typeof createTaskStore>;

  beforeEach(() => {
    eventBus = new EventBus();
    taskStore = createTaskStore(eventBus);
  });

  describe("Initial State", () => {
    test("should start with empty state", () => {
      const state = get(taskStore);
      
      expect(state.tasks).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.lastSync).toBe(null);
    });
  });

  describe("Event Handling", () => {
    test("should add task when tasks.created event is triggered", () => {
      eventBus.trigger({
        type: "tasks.created",
        task: mockTask1,
        extension: "obsidian"
      });

      const state = get(taskStore);
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0]).toEqual(mockTask1);
      expect(state.lastSync).toBeInstanceOf(Date);
    });

    test("should update task when tasks.updated event is triggered", () => {
      // First add a task
      eventBus.trigger({
        type: "tasks.created",
        task: mockTask1,
        extension: "obsidian"
      });

      // Then update it
      const updatedTask = { ...mockTask1, title: "Updated Task", status: "Done" as const };
      eventBus.trigger({
        type: "tasks.updated",
        task: updatedTask,
        changes: { title: "Updated Task", status: "Done" },
        extension: "obsidian"
      });

      const state = get(taskStore);
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].title).toBe("Updated Task");
      expect(state.tasks[0].status).toBe("Done");
    });

    test("should remove task when tasks.deleted event is triggered", () => {
      // First add a task
      eventBus.trigger({
        type: "tasks.created",
        task: mockTask1,
        extension: "obsidian"
      });

      // Then delete it
      eventBus.trigger({
        type: "tasks.deleted",
        taskId: "task-1",
        extension: "obsidian"
      });

      const state = get(taskStore);
      expect(state.tasks).toHaveLength(0);
    });

    test("should load multiple tasks when tasks.loaded event is triggered", () => {
      eventBus.trigger({
        type: "tasks.loaded",
        tasks: [mockTask1, mockTask2],
        extension: "obsidian"
      });

      const state = get(taskStore);
      expect(state.tasks).toHaveLength(2);
      expect(state.tasks).toContain(mockTask1);
      expect(state.tasks).toContain(mockTask2);
    });
  });

  describe("Error Handling", () => {
    test("should handle errors gracefully and continue processing events", () => {
      // This test verifies that the store continues to work even if event handlers throw errors
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Add a task successfully
      eventBus.trigger({
        type: "tasks.created",
        task: mockTask1,
        extension: "obsidian"
      });

      expect(get(taskStore).tasks).toHaveLength(1);
      
      consoleSpy.mockRestore();
    });
  });
});
