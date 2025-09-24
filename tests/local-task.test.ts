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
});
