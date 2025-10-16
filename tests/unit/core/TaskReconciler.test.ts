/**
 * Unit tests for TaskReconciler implementations
 *
 * Tests the reconciliation strategies for different task sources:
 * - SimpleTaskReconciler: For basic sources like GitHub
 * - ObsidianTaskReconciler: For vault-backed tasks with metadata preservation
 */

import { describe, it, expect } from "vitest";
import {
  SimpleTaskReconciler,
  ObsidianTaskReconciler,
} from "../../../src/app/core/TaskReconciler";
import type { Task } from "../../../src/app/core/entities";

describe("SimpleTaskReconciler", () => {
  const reconciler = new SimpleTaskReconciler();

  describe("filterTasksOnRefresh", () => {
    it("should remove all tasks from the same source extension", () => {
      const currentTasks: Task[] = [
        {
          id: "1",
          title: "GitHub Task 1",
          status: "todo",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          source: {
            extension: "github",
            url: "https://github.com/org/repo/issues/1",
          },
        },
        {
          id: "2",
          title: "GitHub Task 2",
          status: "todo",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          source: {
            extension: "github",
            url: "https://github.com/org/repo/issues/2",
          },
        },
        {
          id: "3",
          title: "Obsidian Task",
          status: "todo",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          source: { extension: "obsidian", filePath: "Tasks/task.md" },
        },
      ];

      const filtered = reconciler.filterTasksOnRefresh(currentTasks, "github");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("3");
      expect(filtered[0].source?.extension).toBe("obsidian");
    });

    it("should keep all tasks if source has no existing tasks", () => {
      const currentTasks: Task[] = [
        {
          id: "1",
          title: "Obsidian Task",
          status: "todo",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          source: { extension: "obsidian", filePath: "Tasks/task.md" },
        },
      ];

      const filtered = reconciler.filterTasksOnRefresh(currentTasks, "github");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });
  });

  describe("reconcileTask", () => {
    it("should preserve ID and createdAt for existing task", () => {
      const existingTask: Task = {
        id: "existing-123",
        title: "Old Title",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "github",
          url: "https://github.com/org/repo/issues/1",
        },
      };

      const newTask: Task = {
        id: "new-456",
        title: "New Title",
        status: "in-progress",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
        source: {
          extension: "github",
          url: "https://github.com/org/repo/issues/1",
        },
      };

      const reconciled = reconciler.reconcileTask(existingTask, newTask);

      expect(reconciled.id).toBe("existing-123");
      expect(reconciled.createdAt).toEqual(new Date("2024-01-01"));
      expect(reconciled.title).toBe("New Title");
      expect(reconciled.status).toBe("in-progress");
    });

    it("should generate ID and timestamps for new task", () => {
      const newTask: Task = {
        id: "task-123",
        title: "New Task",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: {
          extension: "github",
          url: "https://github.com/org/repo/issues/1",
        },
      };

      const reconciled = reconciler.reconcileTask(undefined, newTask);

      expect(reconciled.id).toBeTruthy();
      expect(reconciled.id).not.toBe("");
      expect(reconciled.createdAt).toBeInstanceOf(Date);
      expect(reconciled.updatedAt).toBeInstanceOf(Date);
      expect(reconciled.title).toBe("New Task");
    });
  });

  describe("matchesTask", () => {
    it("should match tasks by source URL", () => {
      const task1: Task = {
        id: "1",
        title: "Task 1",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: {
          extension: "github",
          url: "https://github.com/org/repo/issues/1",
        },
      };

      const task2: Task = {
        id: "2",
        title: "Task 2",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: {
          extension: "github",
          url: "https://github.com/org/repo/issues/1",
        },
      };

      expect(reconciler.matchesTask(task1, task2)).toBe(true);
    });

    it("should not match tasks with different URLs", () => {
      const task1: Task = {
        id: "1",
        title: "Task 1",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: {
          extension: "github",
          url: "https://github.com/org/repo/issues/1",
        },
      };

      const task2: Task = {
        id: "2",
        title: "Task 2",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: {
          extension: "github",
          url: "https://github.com/org/repo/issues/2",
        },
      };

      expect(reconciler.matchesTask(task1, task2)).toBe(false);
    });

    it("should fallback to ID matching if no URLs", () => {
      const task1: Task = {
        id: "same-id",
        title: "Task 1",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task2: Task = {
        id: "same-id",
        title: "Task 2",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(reconciler.matchesTask(task1, task2)).toBe(true);
    });
  });
});

describe("ObsidianTaskReconciler", () => {
  const reconciler = new ObsidianTaskReconciler();

  describe("filterTasksOnRefresh", () => {
    it("should remove all vault-backed tasks (those with filePath)", () => {
      const currentTasks: Task[] = [
        {
          id: "1",
          title: "Obsidian Task",
          status: "todo",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          source: { extension: "obsidian", filePath: "Tasks/task1.md" },
        },
        {
          id: "2",
          title: "Imported GitHub Task",
          status: "todo",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          source: {
            extension: "github",
            filePath: "Tasks/github-task.md",
            url: "https://github.com/org/repo/issues/1",
          },
        },
        {
          id: "3",
          title: "Pure GitHub Task",
          status: "todo",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          source: {
            extension: "github",
            url: "https://github.com/org/repo/issues/2",
          },
        },
      ];

      const filtered = reconciler.filterTasksOnRefresh(
        currentTasks,
        "obsidian"
      );

      // Should only keep task 3 (no filePath)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("3");
      expect(filtered[0].source?.filePath).toBeUndefined();
    });
  });

  describe("reconcileTask", () => {
    it("should preserve GitHub extension for imported tasks", () => {
      const existingTask: Task = {
        id: "123",
        title: "Old Title",
        status: "todo",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        source: {
          extension: "github",
          url: "https://github.com/org/repo/issues/1",
          filePath: "Tasks/imported-task.md",
          data: { number: 1, state: "open" },
        },
      };

      const newTask: Task = {
        id: "456",
        title: "New Title",
        status: "in-progress",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: {
          extension: "obsidian",
          filePath: "Tasks/imported-task.md",
        },
      };

      const reconciled = reconciler.reconcileTask(existingTask, newTask);

      expect(reconciled.source?.extension).toBe("github");
      expect(reconciled.source?.url).toBe(
        "https://github.com/org/repo/issues/1"
      );
      expect(reconciled.source?.data).toEqual({ number: 1, state: "open" });
      expect(reconciled.id).toBe("123");
      expect(reconciled.createdAt).toEqual(new Date("2024-01-01"));
    });
  });
});
