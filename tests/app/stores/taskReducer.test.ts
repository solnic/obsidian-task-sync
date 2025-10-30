/**
 * Unit tests for taskReducer
 * Tests the CLEAR_ALL_TASKS action added for comprehensive refresh
 */

import { describe, it, expect } from "vitest";
import { taskReducer, initialTaskStoreState } from "../../../src/app/stores/reducers/taskReducer";
import type { TaskAction } from "../../../src/app/stores/actions";
import type { Task } from "../../../src/app/core/entities";

describe("taskReducer", () => {
  describe("CLEAR_ALL_TASKS action", () => {
    it("should clear all tasks from the store", () => {
      // Create initial state with some tasks
      const mockTasks: Task[] = [
        {
          id: "task1",
          title: "Test Task 1",
          description: "Description 1",
          category: "Task",
          status: "Backlog",
          priority: "Medium",
          done: false,
          project: "",
          areas: [],
          parentTask: "",
          doDate: undefined,
          dueDate: undefined,
          tags: [],
          reminders: [],
          source: {
            extension: "obsidian",
            filePath: "Tasks/Test Task 1.md",
            url: "",
            imported: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "task2",
          title: "Test Task 2",
          description: "Description 2",
          category: "Task",
          status: "In Progress",
          priority: "High",
          done: false,
          project: "",
          areas: [],
          parentTask: "",
          doDate: undefined,
          dueDate: undefined,
          tags: [],
          reminders: [],
          source: {
            extension: "github",
            filePath: "",
            url: "https://github.com/test/repo/issues/1",
            imported: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const stateWithTasks = {
        ...initialTaskStoreState,
        tasks: mockTasks,
        loading: true,
        error: "Some error",
      };

      // Dispatch CLEAR_ALL_TASKS action
      const action: TaskAction = { type: "CLEAR_ALL_TASKS" };
      const newState = taskReducer(stateWithTasks, action);

      // Verify all tasks are cleared
      expect(newState.tasks).toEqual([]);
      expect(newState.tasks.length).toBe(0);

      // Verify loading and error states are reset
      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(null);

      // Verify other state properties are preserved
      expect(newState.sourceStates).toEqual(stateWithTasks.sourceStates);
    });

    it("should work correctly when store is already empty", () => {
      const emptyState = {
        ...initialTaskStoreState,
        tasks: [],
      };

      const action: TaskAction = { type: "CLEAR_ALL_TASKS" };
      const newState = taskReducer(emptyState, action);

      expect(newState.tasks).toEqual([]);
      expect(newState.loading).toBe(false);
      expect(newState.error).toBe(null);
    });
  });

  describe("LOAD_SOURCE_SUCCESS action", () => {
    it("should preserve updatedAt when incoming task data is unchanged", () => {
      const existingUpdatedAt = new Date("2023-01-01T12:00:00.000Z");
      const createdAt = new Date("2023-01-01T10:00:00.000Z");

      const existingTask: Task = {
        id: "obs-1",
        title: "Existing Task",
        description: "Desc",
        category: "Task",
        status: "Backlog",
        priority: "Medium",
        done: false,
        project: "",
        areas: [],
        parentTask: "",
        doDate: undefined,
        dueDate: undefined,
        tags: [],
        source: {
          extension: "obsidian",
          keys: { obsidian: "Tasks/Existing Task.md" },
        },
        createdAt,
        updatedAt: existingUpdatedAt,
      };

      const stateWithTask = {
        ...initialTaskStoreState,
        tasks: [existingTask],
      };

      // Incoming task from refresh is identical in all fields except its own updatedAt value
      // The reducer should detect no meaningful change and preserve the existing updatedAt
      const incomingTask: Task = {
        ...existingTask,
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      };

      const action: TaskAction = {
        type: "LOAD_SOURCE_SUCCESS",
        sourceId: "obsidian",
        tasks: [incomingTask],
      };

      const newState = taskReducer(stateWithTask, action);
      const [updated] = newState.tasks as Task[];

      expect(updated.updatedAt).toEqual(existingUpdatedAt);
      // Sanity: other fields preserved and not duplicated
      expect(newState.tasks.length).toBe(1);
      expect(updated.title).toBe(existingTask.title);
    });
  });
});
