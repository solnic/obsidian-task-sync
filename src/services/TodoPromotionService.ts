/**
 * TodoPromotionService
 * Dedicated service for handling todo promotion functionality
 * Encapsulates all todo detection, promotion, and reversion logic
 */

import { App, MarkdownView, TFile, Notice } from "obsidian";
import { TaskSyncSettings } from "../main";
import { TaskFileManager } from "./TaskFileManager";
import { BaseManager } from "./BaseManager";
import { TemplateManager } from "./TemplateManager";
import { taskStore } from "../stores/taskStore";
import {
  createSafeFileName,
  sanitizeFileName,
} from "../utils/fileNameSanitizer";

// Todo item detection interface
export interface TodoItem {
  text: string;
  completed: boolean;
  indentation: string;
  listMarker: string;
  lineNumber: number;
}

// Extended todo item with parent information
export interface TodoItemWithParent extends TodoItem {
  parentTodo?: TodoItem;
}

// File context interface for context-aware promotion
export interface FileContext {
  type: "project" | "area" | "task" | "none";
  name?: string;
  path?: string;
}

// Result interfaces for service operations
export interface TodoPromotionResult {
  success: boolean;
  message: string;
  taskPath?: string;
  childTasksCount?: number;
  parentTaskName?: string;
}

export interface TodoRevertResult {
  success: boolean;
  message: string;
  revertedCount?: number;
}

export class TodoPromotionService {
  constructor(
    private app: App,
    private settings: TaskSyncSettings,
    private taskFileManager: TaskFileManager,
    private baseManager: BaseManager,
    private templateManager: TemplateManager,
    private createTaskCallback: (taskData: any) => Promise<void>,
    private detectCurrentFileContextCallback: () => FileContext,
    private refreshBaseViewsCallback: () => Promise<void>
  ) {}

  /**
   * Promote a todo item under cursor to a task
   */
  async promoteTodoToTask(): Promise<TodoPromotionResult> {
    try {
      const todoWithParent = this.detectTodoWithParent();

      if (!todoWithParent) {
        return {
          success: false,
          message: "No todo item found under cursor",
        };
      }

      // Get current file context
      const context = this.detectCurrentFileContextCallback();

      // Check if the current todo has children (is a parent todo)
      const childTodos = this.findChildTodos(todoWithParent);
      const isParentTodo = childTodos.length > 0;

      let parentTaskName: string | undefined;

      // If this todo has a parent, create the parent task first
      if (todoWithParent.parentTodo) {
        const parentTaskData = {
          title: todoWithParent.parentTodo.text,
          category: this.settings.taskTypes[0]?.name || "Task",
          done: todoWithParent.parentTodo.completed,
          status: todoWithParent.parentTodo.completed ? "Done" : "Backlog",
          tags: [] as string[],
          // Set context-specific fields
          ...(context.type === "project" && context.name
            ? { project: context.name }
            : {}),
          ...(context.type === "area" && context.name
            ? { areas: [context.name] }
            : {}),
        };

        // Check if parent task already exists
        const parentTaskPath = `${
          this.settings.tasksFolder
        }/${createSafeFileName(todoWithParent.parentTodo.text)}`;
        const parentExists = await this.app.vault.adapter.exists(
          parentTaskPath
        );

        if (!parentExists) {
          const markdownView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
          const activeFile = markdownView?.file;
          if (activeFile) {
            const editor = markdownView.editor;
            const originalLine = editor.getLine(
              todoWithParent.parentTodo.lineNumber
            );
            // Add source information to parent task data
            Object.assign(parentTaskData, {
              source: this.createTodoPromotionSource(
                todoWithParent.parentTodo.text,
                originalLine,
                activeFile.path,
                todoWithParent.parentTodo.lineNumber
              ),
            });
          }
          await this.createTaskCallback(parentTaskData);
          console.log(`Created parent task: ${todoWithParent.parentTodo.text}`);

          // Create base for parent task to show related tasks
          try {
            await this.baseManager.createOrUpdateParentTaskBase(
              todoWithParent.parentTodo.text
            );
          } catch (error) {
            console.error("Failed to create parent task base:", error);
          }
        }

        parentTaskName = todoWithParent.parentTodo.text;
      }

      // Create the main task
      console.log(
        "TodoPromotionService: Creating task with title:",
        todoWithParent.text
      );
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      const activeFile = markdownView?.file;
      const editor = markdownView?.editor;

      const taskData = {
        title: todoWithParent.text,
        category: this.settings.taskTypes[0]?.name || "Task",
        done: todoWithParent.completed,
        status: todoWithParent.completed ? "Done" : "Backlog",
        tags: [] as string[],
        // Set parent task if exists (TaskFileManager will handle link formatting)
        ...(parentTaskName ? { parentTask: parentTaskName } : {}),
        // Set context-specific fields
        ...(context.type === "project" && context.name
          ? { project: context.name }
          : {}),
        ...(context.type === "area" && context.name
          ? { areas: [context.name] }
          : {}),
        ...(activeFile && editor
          ? {
              source: this.createTodoPromotionSource(
                todoWithParent.text,
                editor.getLine(todoWithParent.lineNumber),
                activeFile.path,
                todoWithParent.lineNumber,
                todoWithParent.parentTodo
              ),
            }
          : {}),
      };

      await this.createTaskCallback(taskData);

      // If this todo has children, promote them as individual tasks
      if (childTodos.length > 0) {
        for (const childTodo of childTodos) {
          const childTaskData = {
            title: childTodo.text,
            category: this.settings.taskTypes[0]?.name || "Task",
            done: childTodo.completed,
            status: childTodo.completed ? "Done" : "Backlog",
            tags: [] as string[],
            // Set the current todo as parent (TaskFileManager will handle link formatting)
            parentTask: todoWithParent.text,
            // Set context-specific fields
            ...(context.type === "project" && context.name
              ? { project: context.name }
              : {}),
            ...(context.type === "area" && context.name
              ? { areas: [context.name] }
              : {}),
            ...(activeFile && editor
              ? {
                  source: this.createTodoPromotionSource(
                    childTodo.text,
                    editor.getLine(childTodo.lineNumber),
                    activeFile.path,
                    childTodo.lineNumber,
                    todoWithParent
                  ),
                }
              : {}),
          };

          await this.createTaskCallback(childTaskData);
        }

        // Create base for parent task to show related tasks
        try {
          await this.baseManager.createOrUpdateParentTaskBase(
            todoWithParent.text
          );
        } catch (error) {
          console.error("Failed to create parent task base:", error);
        }
      }

      // Replace the todo lines with links to the created tasks
      await this.replaceTodoLinesWithLinks(todoWithParent, childTodos);

      // Source tracking is now handled directly in task creation

      // Refresh base views if auto-update is enabled
      if (this.settings.autoUpdateBaseViews) {
        await this.refreshBaseViewsCallback();
      }

      const message = parentTaskName
        ? `Todo promoted to task with parent: ${todoWithParent.text} (parent: ${parentTaskName})`
        : `Todo promoted to task: ${todoWithParent.text}`;

      return {
        success: true,
        message,
        taskPath: `${this.settings.tasksFolder}/${createSafeFileName(
          todoWithParent.text
        )}`,
        childTasksCount: childTodos.length,
        parentTaskName,
      };
    } catch (error) {
      console.error("Failed to promote todo to task:", error);
      return {
        success: false,
        message: "Failed to promote todo to task",
      };
    }
  }

  /**
   * Revert a promoted todo back to its original format
   */
  async revertPromotedTodo(): Promise<TodoRevertResult> {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        return {
          success: false,
          message: "No active file found",
        };
      }

      // Get tasks that were promoted from todos in the current file
      const tasks = taskStore.getEntities();
      const promotedTasks = tasks.filter(
        (task) =>
          task.source?.name === "todo-promotion" &&
          task.source?.metadata?.sourceFile === activeFile.path
      );

      if (promotedTasks.length === 0) {
        return {
          success: false,
          message: "No promoted todos found in this file",
        };
      }

      // For now, revert all promoted todos in the file
      // In a full implementation, this could show a selection modal
      let revertedCount = 0;
      for (const task of promotedTasks) {
        try {
          // Restore the original todo line
          if (
            task.source?.metadata?.originalLine &&
            task.source?.metadata?.lineNumber !== undefined
          ) {
            const file = this.app.vault.getAbstractFileByPath(activeFile.path);
            if (file instanceof TFile) {
              const content = await this.app.vault.read(file);
              const lines = content.split("\n");
              const lineNumber = task.source.metadata.lineNumber;

              if (lineNumber < lines.length) {
                lines[lineNumber] = task.source.metadata.originalLine;
                await this.app.vault.modify(file, lines.join("\n"));
              }
            }
          }

          // Remove the task file
          if (task.file) {
            await this.app.vault.delete(task.file);
          }

          revertedCount++;
        } catch (error) {
          console.error(`Failed to revert promoted todo ${task.id}:`, error);
        }
      }

      return {
        success: true,
        message: `Reverted ${revertedCount} promoted todo(s)`,
        revertedCount,
      };
    } catch (error) {
      console.error("Failed to revert promoted todo:", error);
      return {
        success: false,
        message: "Failed to revert promoted todo",
      };
    }
  }

  /**
   * Detect todo item under cursor in the active editor
   */
  private detectTodoUnderCursor(): TodoItem | null {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!markdownView) {
      return null;
    }
    const editor = markdownView.editor;

    if (!editor) {
      return null;
    }

    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    // Regex to match todo items: optional whitespace, list marker (- or *), checkbox, text
    const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
    const match = line.match(todoRegex);

    if (!match) {
      return null;
    }

    const [, indentation, listMarker, checkboxState, text] = match;

    console.log(
      "TodoPromotionService: Detected todo text:",
      text,
      "trimmed:",
      text.trim()
    );

    return {
      text: text.trim(),
      completed: checkboxState.toLowerCase() === "x",
      indentation,
      listMarker,
      lineNumber: cursor.line,
    };
  }

  /**
   * Detect todo item with parent information
   */
  private detectTodoWithParent(): TodoItemWithParent | null {
    const currentTodo = this.detectTodoUnderCursor();
    if (!currentTodo) {
      return null;
    }

    const parentTodo = this.findParentTodo(currentTodo);

    return {
      ...currentTodo,
      parentTodo,
    };
  }

  /**
   * Find parent todo by looking at lines above the current todo
   * Only supports 1 level of nesting for simplicity
   */
  private findParentTodo(currentTodo: TodoItem): TodoItem | null {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      return null;
    }

    const editor = markdownView.editor;
    const currentIndentLevel = currentTodo.indentation.length;

    // If current todo has no indentation, it can't have a parent
    if (currentIndentLevel === 0) {
      return null;
    }

    // Look backwards from current line to find a todo with less indentation
    for (let lineNum = currentTodo.lineNumber - 1; lineNum >= 0; lineNum--) {
      const line = editor.getLine(lineNum);
      const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
      const match = line.match(todoRegex);

      if (match) {
        const [, indentation, listMarker, checkboxState, text] = match;
        const indentLevel = indentation.length;

        // Found a potential parent (less indented)
        if (indentLevel < currentIndentLevel) {
          return {
            text: text.trim(),
            completed: checkboxState.toLowerCase() === "x",
            indentation,
            listMarker,
            lineNumber: lineNum,
          };
        }
      }
    }

    return null;
  }

  /**
   * Find all child todos of a parent todo by looking at lines below
   * Returns todos that are indented more than the parent
   */
  private findChildTodos(parentTodo: TodoItem): TodoItem[] {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      return [];
    }

    const editor = markdownView.editor;
    const parentIndentLevel = parentTodo.indentation.length;
    const childTodos: TodoItem[] = [];
    const totalLines = editor.lineCount();

    // Look forward from parent line to find child todos
    for (
      let lineNum = parentTodo.lineNumber + 1;
      lineNum < totalLines;
      lineNum++
    ) {
      const line = editor.getLine(lineNum);

      // Skip empty lines
      if (line.trim() === "") {
        continue;
      }

      const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
      const match = line.match(todoRegex);

      if (match) {
        const [, indentation, listMarker, checkboxState, text] = match;
        const indentLevel = indentation.length;

        // If indentation is greater than parent, it's a child
        if (indentLevel > parentIndentLevel) {
          childTodos.push({
            text: text.trim(),
            completed: checkboxState.toLowerCase() === "x",
            indentation,
            listMarker,
            lineNumber: lineNum,
          });
        } else {
          // If we hit a todo with same or less indentation, we've reached the end of children
          break;
        }
      } else {
        // If we hit a non-todo line with same or less indentation, we've reached the end of children
        const lineIndentLevel = line.match(/^(\s*)/)?.[1]?.length || 0;
        if (lineIndentLevel <= parentIndentLevel) {
          break;
        }
      }
    }

    return childTodos;
  }

  /**
   * Replace todo lines with links to the created tasks
   */
  private async replaceTodoLinesWithLinks(
    todoWithParent: TodoItemWithParent,
    childTodos: TodoItem[]
  ): Promise<void> {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      throw new Error("No active markdown view found");
    }
    const editor = markdownView.editor;

    // Get current file path for tracking
    const activeFile = markdownView.file;
    if (!activeFile) {
      throw new Error("No active file found");
    }

    // Keep the todo format but link to the task to indicate promotion
    let replacementLine: string;
    if (todoWithParent.completed) {
      // Keep the completed checkbox and add the link
      replacementLine = `${todoWithParent.indentation}${todoWithParent.listMarker} [x] [[${todoWithParent.text}]]`;
    } else {
      // Keep the uncompleted checkbox and add the link
      replacementLine = `${todoWithParent.indentation}${todoWithParent.listMarker} [ ] [[${todoWithParent.text}]]`;
    }

    editor.setLine(todoWithParent.lineNumber, replacementLine);

    // Also replace parent todo line if it exists and wasn't already promoted
    if (todoWithParent.parentTodo) {
      const parentLine = editor.getLine(todoWithParent.parentTodo.lineNumber);
      // Only replace if it's still a todo (not already a link)
      // Check for checkboxes but exclude lines that already contain links
      const hasCheckbox =
        parentLine.includes("[ ]") ||
        parentLine.includes("[x]") ||
        parentLine.includes("[X]");
      const hasLink = parentLine.includes("[[") && parentLine.includes("]]");
      if (hasCheckbox && !hasLink) {
        let parentReplacementLine: string;
        if (todoWithParent.parentTodo.completed) {
          parentReplacementLine = `${todoWithParent.parentTodo.indentation}${todoWithParent.parentTodo.listMarker} [x] [[${todoWithParent.parentTodo.text}]]`;
        } else {
          parentReplacementLine = `${todoWithParent.parentTodo.indentation}${todoWithParent.parentTodo.listMarker} [ ] [[${todoWithParent.parentTodo.text}]]`;
        }
        editor.setLine(
          todoWithParent.parentTodo.lineNumber,
          parentReplacementLine
        );
      }
    }

    // Replace child todo lines with links
    if (childTodos.length > 0) {
      for (const childTodo of childTodos) {
        const originalChildLine = editor.getLine(childTodo.lineNumber);
        // Only replace if it's still a todo (not already a link)
        const hasCheckbox =
          originalChildLine.includes("[ ]") ||
          originalChildLine.includes("[x]") ||
          originalChildLine.includes("[X]");
        const hasLink =
          originalChildLine.includes("[[") && originalChildLine.includes("]]");
        if (hasCheckbox && !hasLink) {
          let childReplacementLine: string;
          if (childTodo.completed) {
            childReplacementLine = `${childTodo.indentation}${childTodo.listMarker} [x] [[${childTodo.text}]]`;
          } else {
            childReplacementLine = `${childTodo.indentation}${childTodo.listMarker} [ ] [[${childTodo.text}]]`;
          }
          editor.setLine(childTodo.lineNumber, childReplacementLine);
        }
      }
    }
  }

  /**
   * Create source metadata for promoted todos
   */
  private createTodoPromotionSource(
    todoText: string,
    originalLine: string,
    sourceFile: string,
    lineNumber: number,
    parentTodo?: TodoItem
  ) {
    return {
      name: "todo-promotion",
      key: `${sourceFile}:${lineNumber}`,
      metadata: {
        originalLine,
        sourceFile,
        lineNumber,
        todoText,
        parentTodo: parentTodo
          ? {
              text: parentTodo.text,
              lineNumber: parentTodo.lineNumber,
            }
          : undefined,
      },
    };
  }
}
