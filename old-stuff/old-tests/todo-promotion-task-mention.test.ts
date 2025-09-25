/**
 * Tests for TodoPromotionService TaskMention integration
 * Verifies that tasks created from todo promotion have proper source tracking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Note, NoteFactory } from "../src/services/NoteService";
import { TaskSyncSettings } from "../../src/main";

// Mock Obsidian API
const mockApp = {
  metadataCache: {
    getFileCache: vi.fn(),
  },
  vault: {
    read: vi.fn(),
  },
};

const mockFile = {
  path: "Areas/Test.md",
  name: "Test.md",
};

const mockSettings: TaskSyncSettings = {
  tasksFolder: "Tasks",
  taskTypes: [{ name: "Task", color: "#blue" }],
} as TaskSyncSettings;

describe("TodoPromotionService TaskMention Integration", () => {
  let noteFactory: NoteFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    noteFactory = new NoteFactory(mockApp as any, mockSettings);
  });

  it("should include TaskMention ID in task source when provided", async () => {
    // Mock file cache with a todo item
    const mockCache = {
      listItems: [
        {
          position: {
            start: { line: 0, col: 0, offset: 0 },
            end: { line: 0, col: 25, offset: 25 },
          },
          task: "x", // completed task
        },
      ],
    };

    const mockContent = "- [x] Buy groceries for the week";

    mockApp.metadataCache.getFileCache.mockReturnValue(mockCache);
    mockApp.vault.read.mockResolvedValue(mockContent);

    // Create note and parse todos
    const note = await noteFactory.createNote(mockFile as any);
    const todoItems = note.todoItems;

    expect(todoItems).toHaveLength(1);

    const todoItem = todoItems[0];
    const taskMentionId = "Areas/Test.md:0";

    // Create task from todo with TaskMention ID
    const taskData = note.createTaskFromTodo(
      todoItem,
      { project: "Test Project" },
      taskMentionId
    );

    // Verify task source includes TaskMention ID
    expect(taskData.source).toBeDefined();
    expect(taskData.source?.name).toBe("todo-promotion");
    expect(taskData.source?.key).toBe("Areas/Test.md:0");
    expect(taskData.source?.metadata?.taskMentionId).toBe(taskMentionId);
    expect(taskData.source?.metadata?.sourceFile).toBe("Areas/Test.md");
    expect(taskData.source?.metadata?.lineNumber).toBe(0);

    // Verify other task properties
    expect(taskData.title).toBe("Buy groceries for the week");
    expect(taskData.done).toBe(true);
    expect(taskData.project).toBe("Test Project");
  });

  it("should work without TaskMention ID for backward compatibility", async () => {
    // Mock file cache with a todo item
    const mockCache = {
      listItems: [
        {
          position: {
            start: { line: 1, col: 0, offset: 26 },
            end: { line: 1, col: 20, offset: 46 },
          },
          task: " ", // incomplete task
        },
      ],
    };

    const mockContent = "- [x] Buy groceries for the week\n- [ ] Walk the dog";

    mockApp.metadataCache.getFileCache.mockReturnValue(mockCache);
    mockApp.vault.read.mockResolvedValue(mockContent);

    // Create note and parse todos
    const note = await noteFactory.createNote(mockFile as any);
    const todoItems = note.todoItems;

    expect(todoItems).toHaveLength(1);

    const todoItem = todoItems[0];

    // Create task from todo without TaskMention ID
    const taskData = note.createTaskFromTodo(todoItem, { areas: ["Personal"] });

    // Verify task source doesn't include TaskMention ID
    expect(taskData.source).toBeDefined();
    expect(taskData.source?.name).toBe("todo-promotion");
    expect(taskData.source?.key).toBe("Areas/Test.md:1");
    expect(taskData.source?.metadata?.taskMentionId).toBeUndefined();
    expect(taskData.source?.metadata?.sourceFile).toBe("Areas/Test.md");
    expect(taskData.source?.metadata?.lineNumber).toBe(1);

    // Verify other task properties
    expect(taskData.title).toBe("Walk the dog");
    expect(taskData.done).toBe(false);
    expect(taskData.areas).toEqual(["Personal"]);
  });
});
