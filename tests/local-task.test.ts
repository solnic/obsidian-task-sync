/**
 * Tests for LocalTask functionality
 * Tests createLocalTask function and extractDisplayValue edge cases
 */

import { describe, test, expect } from "vitest";
import { createLocalTask } from "../src/types/LocalTask";
import type { Task } from "../src/types/entities";
import { TFile } from "obsidian";

// Mock TFile for testing
const mockFile = {
  path: "Tasks/Test Task.md",
  name: "Test Task.md",
} as TFile;

describe("LocalTask", () => {
  describe("createLocalTask", () => {
    test("should handle task with string project property", () => {
      const task: Task = {
        id: "test-1",
        title: "Test Task",
        project: "[[Test Project]]",
        areas: ["[[Test Area]]"],
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.project).toBe("Test Project");
      expect(localTask.sortable.areas).toBe("Test Area");
    });

    test("should handle task with non-string project property", () => {
      const task: Task = {
        id: "test-2",
        title: "Test Task",
        project: 123 as any, // Non-string value that could come from malformed front-matter
        areas: [456 as any], // Non-string value in areas array
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      // This should not crash
      expect(() => createLocalTask(task)).not.toThrow();

      const localTask = createLocalTask(task);

      // Non-string values should be handled gracefully
      expect(localTask.sortable.project).toBe("");
      expect(localTask.sortable.areas).toBe("");
    });

    test("should handle task with null/undefined project and areas", () => {
      const task: Task = {
        id: "test-3",
        title: "Test Task",
        project: null as any,
        areas: undefined,
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.project).toBe("");
      expect(localTask.sortable.areas).toBe("");
    });

    test("should handle task with mixed types in areas array", () => {
      const task: Task = {
        id: "test-4",
        title: "Test Task",
        project: "[[Valid Project]]",
        areas: ["[[Valid Area]]", null, 123, "[[Another Area]]"] as any,
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.project).toBe("Valid Project");
      // Should extract the first valid string area
      expect(localTask.sortable.areas).toBe("Valid Area");
    });

    test("should handle task with empty areas array", () => {
      const task: Task = {
        id: "test-5",
        title: "Test Task",
        project: "[[Test Project]]",
        areas: [],
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.project).toBe("Test Project");
      expect(localTask.sortable.areas).toBe("");
    });

    test("should handle task with plain string values (no wiki links)", () => {
      const task: Task = {
        id: "test-6",
        title: "Test Task",
        project: "Plain Project Name",
        areas: ["Plain Area Name"],
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.project).toBe("Plain Project Name");
      expect(localTask.sortable.areas).toBe("Plain Area Name");
    });
  });

  describe("edge cases with malformed front-matter data", () => {
    test("should handle task with object values in project/areas", () => {
      const task: Task = {
        id: "test-7",
        title: "Test Task",
        project: { invalid: "object" } as any,
        areas: [{ nested: "object" }, "Valid Area"] as any,
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.project).toBe("");
      expect(localTask.sortable.areas).toBe("Valid Area"); // Should find first valid string
    });

    test("should handle task with boolean values", () => {
      const task: Task = {
        id: "test-8",
        title: "Test Task",
        project: true as any,
        areas: [false, true, "Valid Area"] as any,
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.project).toBe("");
      expect(localTask.sortable.areas).toBe("Valid Area");
    });

    test("should handle task with array as project value", () => {
      const task: Task = {
        id: "test-9",
        title: "Test Task",
        project: ["Not", "A", "String"] as any,
        areas: ["Valid Area"],
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.project).toBe("");
      expect(localTask.sortable.areas).toBe("Valid Area");
    });

    test("should extract GitHub timestamps from source data", () => {
      const task: Task = {
        id: "test-github",
        title: "GitHub Task",
        file: mockFile,
        filePath: "Tasks/GitHub Task.md",
        source: {
          name: "github",
          key: "github-123",
          data: {
            created_at: "2024-01-01T10:00:00Z",
            updated_at: "2024-01-02T15:30:00Z",
            number: 123,
            title: "GitHub Issue",
          },
        },
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.createdAt).toEqual(
        new Date("2024-01-01T10:00:00Z")
      );
      expect(localTask.sortable.updatedAt).toEqual(
        new Date("2024-01-02T15:30:00Z")
      );
    });

    test("should handle GitHub task without timestamps", () => {
      const task: Task = {
        id: "test-github-no-timestamps",
        title: "GitHub Task No Timestamps",
        file: mockFile,
        filePath: "Tasks/GitHub Task.md",
        source: {
          name: "github",
          key: "github-123",
          data: {
            number: 123,
            title: "GitHub Issue",
          },
        },
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.createdAt).toBeNull();
      expect(localTask.sortable.updatedAt).toBeNull();
    });

    test("should extract timestamps from other source types", () => {
      const task: Task = {
        id: "test-other-source",
        title: "Other Source Task",
        file: mockFile,
        filePath: "Tasks/Other Source Task.md",
        source: {
          name: "apple-reminders",
          key: "apple-123",
          data: {
            createdAt: "2024-03-01T12:00:00Z",
            updatedAt: "2024-03-02T18:45:00Z",
            id: "apple-reminder-123",
          },
        },
      };

      const localTask = createLocalTask(task);

      expect(localTask.sortable.createdAt).toEqual(
        new Date("2024-03-01T12:00:00Z")
      );
      expect(localTask.sortable.updatedAt).toEqual(
        new Date("2024-03-02T18:45:00Z")
      );
    });
  });
});
