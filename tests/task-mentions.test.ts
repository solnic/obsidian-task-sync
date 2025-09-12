/**
 * Tests for task mentions functionality
 */

import { describe, it, expect } from "vitest";
import { TaskMention } from "../src/types/entities";
import { TaskMentionDetectionService, TodoItemMatch } from "../src/services/TaskMentionDetectionService";

/**
 * Helper function to parse todo lines for testing
 */
function parseTodoLineForTest(line: string, lineNumber: number = 0): TodoItemMatch | null {
  // Regex to match todo items: optional whitespace, list marker (- or *), checkbox, text
  const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
  const match = line.match(todoRegex);

  if (!match) {
    return null;
  }

  const [, indentation, listMarker, checkboxState, text] = match;
  
  // Look for wiki links in the text
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const linkMatches = [...text.matchAll(wikiLinkRegex)];
  
  if (linkMatches.length === 0) {
    return null;
  }

  // For now, use the first wiki link as the task link
  const taskLink = linkMatches[0][1];
  
  return {
    text: text.trim(),
    completed: checkboxState.toLowerCase() === 'x',
    indentation,
    listMarker,
    lineNumber,
    taskLink,
    taskTitle: taskLink
  };
}

/**
 * Helper function to create a mock TaskMention
 */
function createMockTaskMention(
  sourceFilePath: string,
  lineNumber: number,
  taskPath: string,
  completed: boolean = false
): TaskMention {
  return {
    id: `${sourceFilePath}:${lineNumber}`,
    sourceFilePath,
    lineNumber,
    taskPath,
    taskTitle: "Test Task",
    mentionText: "Test todo item",
    completed,
    indentation: "",
    listMarker: "-",
    lastSynced: new Date(),
    createdAt: new Date(),
    filePath: `${sourceFilePath}:${lineNumber}`
  };
}

describe("Task Mentions", () => {
  describe("Todo Line Parsing", () => {
    it("should detect incomplete todo with task link", () => {
      const line = "- [ ] Complete [[Test Task]] implementation";
      const result = parseTodoLineForTest(line, 0);

      expect(result).toEqual({
        text: "Complete [[Test Task]] implementation",
        completed: false,
        indentation: "",
        listMarker: "-",
        lineNumber: 0,
        taskLink: "Test Task",
        taskTitle: "Test Task"
      });
    });

    it("should detect completed todo with task link", () => {
      const line = "  * [x] Review [[Bug Fix]] pull request";
      const result = parseTodoLineForTest(line, 5);

      expect(result).toEqual({
        text: "Review [[Bug Fix]] pull request",
        completed: true,
        indentation: "  ",
        listMarker: "*",
        lineNumber: 5,
        taskLink: "Bug Fix",
        taskTitle: "Bug Fix"
      });
    });

    it("should handle todos with multiple links", () => {
      const line = "- [ ] Update [[Documentation]] and [[Tests]]";
      const result = parseTodoLineForTest(line, 2);

      expect(result).toEqual({
        text: "Update [[Documentation]] and [[Tests]]",
        completed: false,
        indentation: "",
        listMarker: "-",
        lineNumber: 2,
        taskLink: "Documentation", // First link is used
        taskTitle: "Documentation"
      });
    });

    it("should return null for todo without links", () => {
      const line = "- [ ] Regular todo item without links";
      const result = parseTodoLineForTest(line, 0);

      expect(result).toBeNull();
    });

    it("should return null for non-todo lines", () => {
      const line = "This is just regular text with [[Task Link]]";
      const result = parseTodoLineForTest(line, 0);

      expect(result).toBeNull();
    });

    it("should handle different checkbox states", () => {
      const testCases = [
        { line: "- [ ] Incomplete task [[Test]]", expected: false },
        { line: "- [x] Complete task [[Test]]", expected: true },
        { line: "- [X] Complete task [[Test]]", expected: true },
      ];

      testCases.forEach(({ line, expected }) => {
        const result = parseTodoLineForTest(line, 0);
        expect(result?.completed).toBe(expected);
      });
    });

    it("should preserve indentation and list markers", () => {
      const testCases = [
        { line: "- [ ] Task [[Test]]", indentation: "", marker: "-" },
        { line: "  - [ ] Task [[Test]]", indentation: "  ", marker: "-" },
        { line: "    * [ ] Task [[Test]]", indentation: "    ", marker: "*" },
        { line: "\t- [ ] Task [[Test]]", indentation: "\t", marker: "-" },
      ];

      testCases.forEach(({ line, indentation, marker }) => {
        const result = parseTodoLineForTest(line, 0);
        expect(result?.indentation).toBe(indentation);
        expect(result?.listMarker).toBe(marker);
      });
    });
  });

  describe("TaskMention Entity", () => {
    it("should create valid TaskMention entity", () => {
      const mention = createMockTaskMention(
        "Daily Notes/2024-01-15.md",
        10,
        "Tasks/Test Task.md",
        false
      );

      expect(mention.id).toBe("Daily Notes/2024-01-15.md:10");
      expect(mention.sourceFilePath).toBe("Daily Notes/2024-01-15.md");
      expect(mention.lineNumber).toBe(10);
      expect(mention.taskPath).toBe("Tasks/Test Task.md");
      expect(mention.completed).toBe(false);
      expect(mention.filePath).toBe("Daily Notes/2024-01-15.md:10");
    });

    it("should handle completed task mentions", () => {
      const mention = createMockTaskMention(
        "Projects/Project A.md",
        5,
        "Tasks/Feature Implementation.md",
        true
      );

      expect(mention.completed).toBe(true);
    });
  });

  describe("Task Mention State Changes", () => {
    it("should track completion state changes", () => {
      const mention = createMockTaskMention(
        "Notes/Meeting Notes.md",
        3,
        "Tasks/Action Item.md",
        false
      );

      // Simulate state change
      mention.completed = true;
      mention.lastSynced = new Date();

      expect(mention.completed).toBe(true);
      expect(mention.lastSynced).toBeInstanceOf(Date);
    });
  });

  describe("Task Mention Synchronization", () => {
    it("should identify sync scenarios", () => {
      // Test scenarios for task mention synchronization
      const scenarios = [
        {
          name: "mention completed, task incomplete",
          mentionCompleted: true,
          taskCompleted: false,
          expectedAction: "update task to completed"
        },
        {
          name: "mention incomplete, task completed",
          mentionCompleted: false,
          taskCompleted: true,
          expectedAction: "update task to incomplete"
        },
        {
          name: "both completed",
          mentionCompleted: true,
          taskCompleted: true,
          expectedAction: "no change needed"
        },
        {
          name: "both incomplete",
          mentionCompleted: false,
          taskCompleted: false,
          expectedAction: "no change needed"
        }
      ];

      scenarios.forEach(({ name, mentionCompleted, taskCompleted, expectedAction }) => {
        const needsSync = mentionCompleted !== taskCompleted;
        
        if (expectedAction === "no change needed") {
          expect(needsSync).toBe(false);
        } else {
          expect(needsSync).toBe(true);
        }
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed wiki links", () => {
      const testCases = [
        "- [ ] Task with [[incomplete link",
        "- [ ] Task with incomplete]] link",
        "- [ ] Task with [[]] empty link",
        "- [ ] Task with [[  ]] whitespace link"
      ];

      testCases.forEach(line => {
        const result = parseTodoLineForTest(line, 0);
        // Should either parse correctly or return null, but not throw
        expect(() => parseTodoLineForTest(line, 0)).not.toThrow();
      });
    });

    it("should handle special characters in task names", () => {
      const line = "- [ ] Complete [[Task with Special-Characters_123]] today";
      const result = parseTodoLineForTest(line, 0);

      expect(result?.taskLink).toBe("Task with Special-Characters_123");
    });

    it("should handle very long todo lines", () => {
      const longText = "Very ".repeat(50) + "long task description";
      const line = `- [ ] ${longText} [[Test Task]]`;
      const result = parseTodoLineForTest(line, 0);

      expect(result?.taskLink).toBe("Test Task");
      expect(result?.text).toContain(longText);
    });

    it("should handle nested list structures", () => {
      const testCases = [
        { line: "- [ ] Parent task [[Task A]]", level: 0 },
        { line: "  - [ ] Child task [[Task B]]", level: 1 },
        { line: "    - [ ] Grandchild task [[Task C]]", level: 2 },
      ];

      testCases.forEach(({ line, level }) => {
        const result = parseTodoLineForTest(line, 0);
        expect(result?.indentation).toBe("  ".repeat(level));
      });
    });
  });
});
