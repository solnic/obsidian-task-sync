/**
 * NoteService - First-class Note abstraction for parsing markdown documents
 * Extracts todo items using Obsidian's metadata cache and ListItemCache API
 * Creates Task entities with proper source information for todo promotion
 */

import { App, TFile, CachedMetadata, ListItemCache } from "obsidian";
import { TaskSyncSettings } from "../main";
import { Task, TaskSource } from "../types/entities";

/**
 * Represents a todo item extracted from a note using Obsidian's ListItemCache
 */
export interface NoteTodoItem {
  /** The text content of the todo item */
  text: string;
  /** Whether the todo item is completed (checked) */
  completed: boolean;
  /** The indentation level of the todo item */
  indentation: string;
  /** The list marker used (- or *) */
  listMarker: string;
  /** Line number in the source file (0-based) */
  lineNumber: number;
  /** The original line content */
  originalLine: string;
  /** Parent line number if this is a nested todo */
  parentLineNumber?: number;
  /** Obsidian's ListItemCache data */
  listItemCache: ListItemCache;
}

/**
 * Represents a markdown note with parsed todo items
 */
export class Note {
  private app: App;
  private settings: TaskSyncSettings;
  private _file: TFile;
  private _todoItems: NoteTodoItem[] = [];
  private _lastParsed: Date | null = null;

  constructor(app: App, settings: TaskSyncSettings, file: TFile) {
    this.app = app;
    this.settings = settings;
    this._file = file;
  }

  get file(): TFile {
    return this._file;
  }

  get filePath(): string {
    return this._file.path;
  }

  get todoItems(): NoteTodoItem[] {
    return this._todoItems;
  }

  get lastParsed(): Date | null {
    return this._lastParsed;
  }

  /**
   * Parse the note to extract todo items using Obsidian's metadata cache
   */
  async parse(): Promise<void> {
    try {
      const cache = this.app.metadataCache.getFileCache(this._file);
      if (!cache || !cache.listItems) {
        this._todoItems = [];
        this._lastParsed = new Date();
        return;
      }

      const content = await this.app.vault.read(this._file);
      const lines = content.split("\n");

      this._todoItems = await this.extractTodoItems(cache, lines);
      this._lastParsed = new Date();
    } catch (error) {
      console.error(`NoteService: Error parsing note ${this.filePath}:`, error);
      this._todoItems = [];
      this._lastParsed = new Date();
    }
  }

  /**
   * Extract todo items from Obsidian's ListItemCache
   */
  private async extractTodoItems(
    cache: CachedMetadata,
    lines: string[]
  ): Promise<NoteTodoItem[]> {
    const todoItems: NoteTodoItem[] = [];

    if (!cache.listItems) {
      return todoItems;
    }

    for (const listItem of cache.listItems) {
      // Only process items that have a task marker
      if (listItem.task === undefined) {
        continue;
      }

      const lineNumber = listItem.position.start.line;
      const line = lines[lineNumber];

      if (!line) {
        continue;
      }

      const todoItem = this.parseListItemToTodo(listItem, line, lineNumber);
      if (todoItem) {
        todoItems.push(todoItem);
      }
    }

    return todoItems;
  }

  /**
   * Parse a ListItemCache into a NoteTodoItem
   */
  private parseListItemToTodo(
    listItem: ListItemCache,
    line: string,
    lineNumber: number
  ): NoteTodoItem | null {
    // Parse the line to extract todo components
    const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
    const match = line.match(todoRegex);

    if (!match) {
      return null;
    }

    const [, indentation, listMarker, checkboxState, text] = match;

    // Determine parent line number from ListItemCache
    const parentLineNumber = listItem.parent >= 0 ? listItem.parent : undefined;

    return {
      text: text.trim(),
      completed: checkboxState.toLowerCase() === "x",
      indentation,
      listMarker,
      lineNumber,
      originalLine: line,
      parentLineNumber,
      listItemCache: listItem,
    };
  }

  /**
   * Create a Task entity from a NoteTodoItem for todo promotion
   */
  createTaskFromTodo(
    todoItem: NoteTodoItem,
    context?: { project?: string; areas?: string[] },
    taskMentionId?: string
  ): Partial<Task> {
    const source: TaskSource = {
      name: "todo-promotion",
      key: `${this.filePath}:${todoItem.lineNumber}`,
      metadata: {
        sourceFile: this.filePath,
        lineNumber: todoItem.lineNumber,
        originalLine: todoItem.originalLine,
        indentation: todoItem.indentation,
        listMarker: todoItem.listMarker,
        parentLineNumber: todoItem.parentLineNumber,
        taskMentionId, // Include the TaskMention ID
      },
    };

    const taskData: Partial<Task> = {
      title: todoItem.text,
      type: "Task",
      category: this.settings.taskTypes[0]?.name || "Task",
      done: todoItem.completed,
      status: todoItem.completed ? "Done" : "Backlog",
      tags: [],
      source,
    };

    // Add context if provided
    if (context?.project) {
      taskData.project = context.project;
    }
    if (context?.areas) {
      taskData.areas = context.areas;
    }

    return taskData;
  }

  /**
   * Find parent todo item for a given todo item
   */
  findParentTodo(todoItem: NoteTodoItem): NoteTodoItem | null {
    if (!todoItem.parentLineNumber) {
      return null;
    }

    return (
      this._todoItems.find(
        (item) => item.lineNumber === todoItem.parentLineNumber
      ) || null
    );
  }

  /**
   * Find child todo items for a given todo item
   */
  findChildTodos(parentTodo: NoteTodoItem): NoteTodoItem[] {
    return this._todoItems.filter(
      (item) => item.parentLineNumber === parentTodo.lineNumber
    );
  }

  /**
   * Get todo item at a specific line number
   */
  getTodoAtLine(lineNumber: number): NoteTodoItem | null {
    return (
      this._todoItems.find((item) => item.lineNumber === lineNumber) || null
    );
  }

  /**
   * Check if the note needs to be re-parsed (file has been modified)
   */
  needsReparsing(): boolean {
    if (!this._lastParsed) {
      return true;
    }

    return this._file.stat.mtime > this._lastParsed.getTime();
  }

  /**
   * Get all todo items that are not linked to existing tasks
   * (i.e., candidates for promotion)
   */
  getPromotableTodos(): NoteTodoItem[] {
    // For now, return all todos. In the future, this could filter out
    // todos that already have corresponding task files or are task mentions
    return this._todoItems;
  }
}

/**
 * Factory for creating Note instances
 */
export class NoteFactory {
  constructor(private app: App, private settings: TaskSyncSettings) {}

  /**
   * Create a Note instance from a TFile
   */
  async createNote(file: TFile): Promise<Note> {
    const note = new Note(this.app, this.settings, file);
    await note.parse();
    return note;
  }

  /**
   * Create a Note instance and parse it only if needed
   */
  async createNoteIfNeeded(file: TFile, existingNote?: Note): Promise<Note> {
    if (existingNote && !existingNote.needsReparsing()) {
      return existingNote;
    }

    return this.createNote(file);
  }
}
