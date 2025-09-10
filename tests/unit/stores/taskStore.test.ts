/**
 * Task Store Tests
 * Tests for the reactive task store functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { taskStore } from "../../../src/stores/taskStore";
import type { TaskData } from "../../../src/stores/taskStore";

// Mock Obsidian
const mockApp = {
  vault: {
    getMarkdownFiles: vi.fn(),
    read: vi.fn(),
    on: vi.fn(),
  },
};

// Mock TFile
class MockTFile {
  constructor(
    public path: string,
    public basename: string,
  ) {}
}

describe("TaskStore", () => {
  beforeEach(() => {
    // Clear the store before each test
    taskStore.clear();
    vi.clearAllMocks();
  });

  describe("Source-based task lookup", () => {
    it("should find task by source", async () => {
      // Mock task files
      const taskFile = new MockTFile("Tasks/Test Task.md", "Test Task");
      mockApp.vault.getMarkdownFiles.mockReturnValue([taskFile]);

      // Mock file content with source
      const taskContent = `---
Title: Test Task
Type: Task
source:
  name: github
  key: github-123
  url: https://github.com/owner/repo/issues/123
---

Task content here`;

      mockApp.vault.read.mockResolvedValue(taskContent);

      // Initialize store
      taskStore.initialize(mockApp as any, "Tasks");
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async operations

      // Test finding task by source
      const foundTask = taskStore.findTaskBySource("github", "github-123");
      expect(foundTask).toBeTruthy();
      expect(foundTask?.title).toBe("Test Task");
      expect(foundTask?.source?.name).toBe("github");
      expect(foundTask?.source?.key).toBe("github-123");
    });

    it("should check if task is imported", async () => {
      // Mock task files
      const taskFile = new MockTFile("Tasks/GitHub Task.md", "GitHub Task");
      mockApp.vault.getMarkdownFiles.mockReturnValue([taskFile]);

      // Mock file content with source
      const taskContent = `---
Title: GitHub Task
Type: Task
source:
  name: github
  key: github-456
  url: https://github.com/owner/repo/issues/456
---

GitHub task content`;

      mockApp.vault.read.mockResolvedValue(taskContent);

      // Initialize store
      taskStore.initialize(mockApp as any, "Tasks");
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async operations

      // Test import checking
      expect(taskStore.isTaskImported("github", "github-456")).toBe(true);
      expect(taskStore.isTaskImported("github", "github-999")).toBe(false);
      expect(taskStore.isTaskImported("linear", "github-456")).toBe(false);
    });

    it("should get tasks by source", async () => {
      // Mock multiple task files
      const githubTask1 = new MockTFile(
        "Tasks/GitHub Task 1.md",
        "GitHub Task 1",
      );
      const githubTask2 = new MockTFile(
        "Tasks/GitHub Task 2.md",
        "GitHub Task 2",
      );
      const linearTask = new MockTFile("Tasks/Linear Task.md", "Linear Task");
      const regularTask = new MockTFile(
        "Tasks/Regular Task.md",
        "Regular Task",
      );

      mockApp.vault.getMarkdownFiles.mockReturnValue([
        githubTask1,
        githubTask2,
        linearTask,
        regularTask,
      ]);

      // Mock file contents
      mockApp.vault.read.mockImplementation((file: MockTFile) => {
        if (file.path.includes("GitHub Task 1")) {
          return Promise.resolve(`---
Title: GitHub Task 1
Type: Task
source:
  name: github
  key: github-111
---`);
        } else if (file.path.includes("GitHub Task 2")) {
          return Promise.resolve(`---
Title: GitHub Task 2
Type: Task
source:
  name: github
  key: github-222
---`);
        } else if (file.path.includes("Linear Task")) {
          return Promise.resolve(`---
Title: Linear Task
Type: Task
source:
  name: linear
  key: linear-333
---`);
        } else {
          return Promise.resolve(`---
Title: Regular Task
Type: Task
---`);
        }
      });

      // Initialize store
      taskStore.initialize(mockApp as any, "Tasks");
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async operations

      // Test getting tasks by source
      const githubTasks = taskStore.getTasksBySource("github");
      const linearTasks = taskStore.getTasksBySource("linear");

      expect(githubTasks).toHaveLength(2);
      expect(githubTasks[0].title).toBe("GitHub Task 1");
      expect(githubTasks[1].title).toBe("GitHub Task 2");

      expect(linearTasks).toHaveLength(1);
      expect(linearTasks[0].title).toBe("Linear Task");
    });

    it("should return null for non-existent task", async () => {
      // Mock empty task list
      mockApp.vault.getMarkdownFiles.mockReturnValue([]);

      // Initialize store
      taskStore.initialize(mockApp as any, "Tasks");
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async operations

      // Test finding non-existent task
      const foundTask = taskStore.findTaskBySource("github", "non-existent");
      expect(foundTask).toBeNull();
    });

    it("should handle tasks without source", async () => {
      // Mock task file without source
      const taskFile = new MockTFile("Tasks/Regular Task.md", "Regular Task");
      mockApp.vault.getMarkdownFiles.mockReturnValue([taskFile]);

      // Mock file content without source
      const taskContent = `---
Title: Regular Task
Type: Task
Priority: High
---

Regular task content`;

      mockApp.vault.read.mockResolvedValue(taskContent);

      // Initialize store
      taskStore.initialize(mockApp as any, "Tasks");
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async operations

      // Test that task without source is not found by source lookup
      const foundTask = taskStore.findTaskBySource("github", "any-key");
      expect(foundTask).toBeNull();

      // But the task should still be in the store
      const state = get(taskStore);
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].title).toBe("Regular Task");
      expect(state.tasks[0].source).toBeUndefined();
    });
  });

  describe("Store state management", () => {
    it("should initialize with empty state", () => {
      const state = get(taskStore);
      expect(state.tasks).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastUpdated).toBeNull();
    });

    it("should clear store state", () => {
      // Initialize with some mock data first
      taskStore.initialize(mockApp as any, "Tasks");

      // Clear the store
      taskStore.clear();

      const state = get(taskStore);
      expect(state.tasks).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastUpdated).toBeNull();
    });
  });
});
