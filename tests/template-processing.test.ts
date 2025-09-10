import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskFileManager } from "../src/services/TaskFileManager";

// Mock Obsidian API
const mockApp = {
  vault: {
    getAbstractFileByPath: vi.fn(),
    read: vi.fn(),
    create: vi.fn(),
    modify: vi.fn(),
    adapter: {
      exists: vi.fn(),
    },
  },
  fileManager: {
    processFrontMatter: vi.fn(),
  },
};

// Mock settings
const mockSettings = {
  templateFolder: "Templates",
  useTemplater: false,
  basesFolder: "Bases",
  tasksFolder: "Tasks",
};

// Mock TaskFileManager for testing {{tasks}} processing
class MockTaskFileManager extends TaskFileManager {
  constructor() {
    super(mockApp as any, mockApp.vault as any, mockSettings as any);
  }

  // Expose the private method for testing
  public testProcessTasksVariable(content: string, taskName: string): string {
    return (this as any).processTasksVariable(content, taskName);
  }
}

describe("Template Processing", () => {
  let taskFileManager: MockTaskFileManager;

  beforeEach(() => {
    taskFileManager = new MockTaskFileManager();
    vi.clearAllMocks();
  });

  describe("{{tasks}} syntax processing", () => {
    it("should replace {{tasks}} with specific base embed", () => {
      const template = `---
Name: Mobile App
Type: Project
---

## Overview
Some description

## Tasks
{{tasks}}`;

      const result = taskFileManager.testProcessTasksVariable(
        template,
        "Mobile App",
      );

      expect(result).toContain("![[Bases/Mobile App.base]]");
      expect(result).not.toContain("{{tasks}}");
    });

    it("should handle multiple {{tasks}} occurrences", () => {
      const template = `## Main Tasks
{{tasks}}

## Archived Tasks
{{tasks}}`;

      const result = taskFileManager.testProcessTasksVariable(
        template,
        "Test Project",
      );

      const matches = result.match(/!\[\[Bases\/Test Project\.base\]\]/g);
      expect(matches).toHaveLength(2);
    });

    it("should work with area templates", () => {
      const template = `---
Name: Health & Fitness
Type: Area
---

## Tasks
{{tasks}}`;

      const result = taskFileManager.testProcessTasksVariable(
        template,
        "Health & Fitness",
      );

      expect(result).toContain("![[Bases/Health & Fitness.base]]");
    });

    it("should not modify content without {{tasks}}", () => {
      const template = `---
Name: Simple Project
Type: Project
---

## Overview
This is a simple project without tasks variable.`;

      const result = taskFileManager.testProcessTasksVariable(
        template,
        "Simple Project",
      );

      expect(result).toBe(template); // Should be unchanged
    });
  });
});
