/**
 * Tests for LocalTask functionality
 * Tests createLocalTask function and extractDisplayValue edge cases
 */

import { describe, test, expect, beforeAll } from "vitest";
import { createLocalTask } from "../src/types/LocalTask";
import type { Task } from "../src/types/entities";
import { TFile } from "obsidian";
import { initializeExternalTaskSources } from "../src/services/ExternalTaskSourceRegistry";

// Mock TFile for testing
const mockFile = {
  path: "Tasks/Test Task.md",
  name: "Test Task.md",
} as TFile;

describe("LocalTask", () => {
  beforeAll(() => {
    // Initialize external task sources for tests
    initializeExternalTaskSources();
  });

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

    test("should throw validation error for non-string project property", () => {
      const task: Task = {
        id: "test-2",
        title: "Test Task",
        project: 123 as any, // Non-string value that could come from malformed front-matter
        areas: [456 as any], // Non-string value in areas array
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      // Should throw validation error for invalid data types
      expect(() => createLocalTask(task)).toThrow("Invalid LocalTask");
    });

    test("should handle null/undefined project and areas gracefully", () => {
      const task: Task = {
        id: "test-3",
        title: "Test Task",
        project: null as any,
        areas: undefined,
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      // Null/undefined values should be converted to empty strings (not throw errors)
      const localTask = createLocalTask(task);
      expect(localTask.sortable.project).toBe("");
      expect(localTask.sortable.areas).toBe("");
    });

    test("should throw validation error for mixed types in areas array", () => {
      const task: Task = {
        id: "test-4",
        title: "Test Task",
        project: "[[Valid Project]]",
        areas: ["[[Valid Area]]", null, 123, "[[Another Area]]"] as any,
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      // Should throw validation error for mixed types in areas array
      expect(() => createLocalTask(task)).toThrow("Invalid LocalTask");
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
    test("should throw validation error for object values in project/areas", () => {
      const task: Task = {
        id: "test-7",
        title: "Test Task",
        project: { invalid: "object" } as any,
        areas: [{ nested: "object" }, "Valid Area"] as any,
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      // Should throw validation error for object values
      expect(() => createLocalTask(task)).toThrow("Invalid LocalTask");
    });

    test("should throw validation error for boolean values", () => {
      const task: Task = {
        id: "test-8",
        title: "Test Task",
        project: true as any,
        areas: [false, true, "Valid Area"] as any,
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      // Should throw validation error for boolean values
      expect(() => createLocalTask(task)).toThrow("Invalid LocalTask");
    });

    test("should throw validation error for array as project value", () => {
      const task: Task = {
        id: "test-9",
        title: "Test Task",
        project: ["Not", "A", "String"] as any,
        areas: ["Valid Area"],
        file: mockFile,
        filePath: "Tasks/Test Task.md",
      };

      // Should throw validation error for array as project value
      expect(() => createLocalTask(task)).toThrow("Invalid LocalTask");
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
            id: 123,
            number: 123,
            title: "GitHub Issue",
            body: "Test issue body",
            state: "open",
            assignee: null,
            labels: [],
            created_at: "2024-01-01T10:00:00Z",
            updated_at: "2024-01-02T15:30:00Z",
            html_url: "https://github.com/test/repo/issues/123",
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

    test("should handle GitHub task with invalid source data", () => {
      const task: Task = {
        id: "test-github-invalid",
        title: "GitHub Task Invalid Data",
        file: mockFile,
        filePath: "Tasks/GitHub Task.md",
        source: {
          name: "github",
          key: "github-123",
          data: {
            // Incomplete GitHub data that fails validation
            number: 123,
            title: "GitHub Issue",
          },
        },
      };

      const localTask = createLocalTask(task);

      // Should fall back to null timestamps when validation fails
      expect(localTask.sortable.createdAt).toBeNull();
      expect(localTask.sortable.updatedAt).toBeNull();
    });

    test("should extract timestamps from Apple Reminders source", () => {
      const task: Task = {
        id: "test-apple-source",
        title: "Apple Reminders Task",
        file: mockFile,
        filePath: "Tasks/Apple Reminders Task.md",
        source: {
          name: "apple-reminders",
          key: "apple-123",
          data: {
            id: "apple-reminder-123",
            title: "Apple Reminder",
            completed: false,
            creationDate: "2024-03-01T12:00:00Z",
            modificationDate: "2024-03-02T18:45:00Z",
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

    test("should handle invalid date strings in source data", () => {
      const task: Task = {
        id: "test-invalid-dates",
        title: "Task with Invalid Dates",
        file: mockFile,
        filePath: "Tasks/Invalid Dates Task.md",
        source: {
          name: "github",
          key: "github-456",
          data: {
            id: 456,
            number: 456,
            title: "GitHub Issue with Bad Dates",
            body: "Test issue body",
            state: "open",
            assignee: null,
            labels: [],
            created_at: "invalid-date-string",
            updated_at: "not-a-date",
            html_url: "https://github.com/test/repo/issues/456",
          },
        },
      };

      const localTask = createLocalTask(task);

      // Invalid dates should be converted to null, not Invalid Date objects
      expect(localTask.sortable.createdAt).toBeNull();
      expect(localTask.sortable.updatedAt).toBeNull();
    });

    test("should handle string dates that need coercion", () => {
      // This test reproduces the validation error where strings are passed to date validation
      const task: Task = {
        id: "test-string-dates",
        title: "Task with String Dates",
        file: mockFile,
        filePath: "Tasks/String Dates Task.md",
        createdAt: "2024-01-01T10:00:00Z" as any, // String instead of Date
        updatedAt: "2024-01-02T15:30:00Z" as any, // String instead of Date
      };

      // This should not throw a validation error
      const localTask = createLocalTask(task);

      // String dates should be coerced to Date objects
      expect(localTask.sortable.createdAt).toEqual(
        new Date("2024-01-01T10:00:00Z")
      );
      expect(localTask.sortable.updatedAt).toEqual(
        new Date("2024-01-02T15:30:00Z")
      );
    });

    test("should handle object values in project/areas fields", () => {
      // This test reproduces the "project/area must be string, got object" error
      const task: Task = {
        id: "test-object-project",
        title: "Task with Object Project",
        file: mockFile,
        filePath: "Tasks/Object Project Task.md",
        project: { name: "Test Project" } as any, // Object instead of string
        areas: [{ name: "Test Area" }] as any, // Array of objects instead of strings
      };

      // This should not throw a validation error
      const localTask = createLocalTask(task);

      // Object values should be handled gracefully, converting to empty strings
      expect(localTask.sortable.project).toBe("");
      expect(localTask.sortable.areas).toBe("");
    });

    test("should handle tasks with file system timestamps when source data has invalid dates", () => {
      const task: Task = {
        id: "test-fallback-timestamps",
        title: "Task with Fallback Timestamps",
        file: mockFile,
        filePath: "Tasks/Fallback Task.md",
        createdAt: new Date("2024-01-01T10:00:00Z"),
        updatedAt: new Date("2024-01-02T15:30:00Z"),
        source: {
          name: "github",
          key: "github-789",
          data: {
            id: 789,
            number: 789,
            title: "GitHub Issue",
            body: "Test issue body",
            state: "open",
            assignee: null,
            labels: [],
            created_at: "invalid-date",
            updated_at: "also-invalid",
            html_url: "https://github.com/test/repo/issues/789",
          },
        },
      };

      const localTask = createLocalTask(task);

      // Should fall back to file system timestamps when source data is invalid
      expect(localTask.sortable.createdAt).toEqual(
        new Date("2024-01-01T10:00:00Z")
      );
      expect(localTask.sortable.updatedAt).toEqual(
        new Date("2024-01-02T15:30:00Z")
      );
    });
  });
});
