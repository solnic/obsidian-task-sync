/**
 * TodoPromotionService
 * Simplified service for handling todo promotion functionality using Note abstraction
 * Focuses on promoting individual todos and setting parent task relationships
 */

import { App, MarkdownView, TFile, Notice } from "obsidian";
import { TaskSyncSettings } from "../main";
import { TaskFileManager } from "./TaskFileManager";
import { BaseManager } from "./BaseManager";
import { TemplateManager } from "./TemplateManager";
import { taskStore } from "../stores/taskStore";
import { taskMentionStore } from "../stores/taskMentionStore";
import { Note, NoteFactory, NoteTodoItem } from "./NoteService";
import { TaskMention } from "../types/entities";
import {
  createSafeFileName,
  sanitizeFileName,
} from "../utils/fileNameSanitizer";

// File context interface for context-aware promotion
export interface FileContext {
  type: "project" | "area" | "task" | "daily" | "none";
  name?: string;
  path?: string;
}

// Result interfaces for service operations
export interface TodoPromotionResult {
  success: boolean;
  message: string;
  taskPath?: string;
  parentTaskName?: string;
}

export interface TodoRevertResult {
  success: boolean;
  message: string;
  revertedCount?: number;
}

export class TodoPromotionService {
  private noteFactory: NoteFactory;

  constructor(
    private app: App,
    private settings: TaskSyncSettings,
    private taskFileManager: TaskFileManager,
    private baseManager: BaseManager,
    private templateManager: TemplateManager,
    private createTaskCallback: (taskData: any) => Promise<void>,
    private detectCurrentFileContextCallback: () => FileContext,
    private refreshBaseViewsCallback: () => Promise<void>
  ) {
    this.noteFactory = new NoteFactory(app, settings);
  }

  /**
   * Promote a todo item under cursor to a task
   */
  async promoteTodoToTask(): Promise<TodoPromotionResult> {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        return {
          success: false,
          message: "No active file found",
        };
      }

      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!markdownView) {
        return {
          success: false,
          message: "No active markdown view found",
        };
      }

      const editor = markdownView.editor;
      const cursor = editor.getCursor();

      // Parse the note to get todo items
      const note = await this.noteFactory.createNote(activeFile);
      const todoItem = note.getTodoAtLine(cursor.line);

      if (!todoItem) {
        return {
          success: false,
          message: "No todo item found under cursor",
        };
      }

      // Get current file context
      const context = this.detectCurrentFileContextCallback();

      // Check if there's a parent todo and if it already has a corresponding task
      let parentTaskName: string | undefined;
      const parentTodo = note.findParentTodo(todoItem);

      if (parentTodo) {
        // Check if parent task already exists
        const parentTaskPath = `${
          this.settings.tasksFolder
        }/${createSafeFileName(parentTodo.text)}.md`;
        const parentExists = await this.app.vault.adapter.exists(
          parentTaskPath
        );

        if (parentExists) {
          // Parent task exists, we'll link to it
          parentTaskName = parentTodo.text;
        } else {
          // Parent task doesn't exist, user should create it first
          return {
            success: false,
            message: `Parent todo "${parentTodo.text}" should be promoted to a task first`,
          };
        }
      }

      // Create task data using the Note abstraction
      const contextData = {
        project: context.type === "project" ? context.name : undefined,
        areas:
          context.type === "area" && context.name ? [context.name] : undefined,
      };

      // Create the task file path
      const taskFileName = createSafeFileName(todoItem.text);
      const taskPath = `${this.settings.tasksFolder}/${taskFileName}.md`;

      // Create TaskMention entity first
      const mentionId = `${activeFile.path}:${todoItem.lineNumber}`;
      const taskMention: TaskMention = {
        id: mentionId,
        sourceFilePath: activeFile.path,
        lineNumber: todoItem.lineNumber,
        taskPath,
        taskTitle: todoItem.text,
        mentionText: todoItem.text,
        completed: todoItem.completed,
        indentation: todoItem.indentation,
        listMarker: todoItem.listMarker,
        lastSynced: new Date(),
        createdAt: new Date(),
        filePath: mentionId, // For EntityStore compatibility
      };

      // Save the TaskMention to the store
      await taskMentionStore.upsertEntity(taskMention);

      // Create task data with TaskMention ID in source
      const taskData = note.createTaskFromTodo(
        todoItem,
        contextData,
        mentionId
      );

      // Set parent task if exists
      if (parentTaskName) {
        taskData.parentTask = parentTaskName;
      }

      console.log(
        "TodoPromotionService: Creating task with title:",
        taskData.title
      );

      await this.createTaskCallback(taskData);

      // Replace the todo line with a link to the created task
      await this.replaceTodoLineWithLink(todoItem, activeFile);

      // Refresh base views if auto-update is enabled
      if (this.settings.autoUpdateBaseViews) {
        await this.refreshBaseViewsCallback();
      }

      const message = parentTaskName
        ? `Todo promoted to task with parent: ${taskData.title} (parent: ${parentTaskName})`
        : `Todo promoted to task: ${taskData.title}`;

      return {
        success: true,
        message,
        taskPath: `${this.settings.tasksFolder}/${createSafeFileName(
          taskData.title || ""
        )}`,
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
   * Replace a todo line with a link to the created task
   */
  private async replaceTodoLineWithLink(
    todoItem: NoteTodoItem,
    file: TFile
  ): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      if (todoItem.lineNumber < lines.length) {
        // Create a link to the task file (just the task name, not the full path)
        const taskLink = `[[${todoItem.text}]]`;

        // Replace the todo with a link, preserving indentation, list marker, and checkbox state
        const checkboxState = todoItem.completed ? "[x]" : "[ ]";
        const newLine = `${todoItem.indentation}${todoItem.listMarker} ${checkboxState} ${taskLink}`;
        lines[todoItem.lineNumber] = newLine;

        await this.app.vault.modify(file, lines.join("\n"));
      }
    } catch (error) {
      console.error("Failed to replace todo line with link:", error);
    }
  }
}
