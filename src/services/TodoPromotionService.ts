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
import { Task } from "../types/entities";
import { taskStore } from "../stores/taskStore";
import { taskMentionStore } from "../stores/taskMentionStore";
import { NoteFactory, NoteTodoItem } from "./NoteService";
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
    private createTaskCallback: (taskData: any) => Promise<Task>,
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
        // Extract the actual task name from the parent todo text (remove link syntax if present)
        const parentTaskTitle = parentTodo.text.replace(/^\[\[(.+)\]\]$/, "$1");

        // Check if parent task already exists
        const parentTaskPath = `${
          this.settings.tasksFolder
        }/${createSafeFileName(parentTaskTitle)}`;
        const parentExists = await this.app.vault.adapter.exists(
          parentTaskPath
        );

        if (parentExists) {
          // Parent task exists, we'll link to it
          parentTaskName = parentTaskTitle;
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

      // Update any existing child tasks to set this as their parent
      await this.updateChildTasksParent(todoItem, activeFile, todoItem.text);

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
   * Works with any promoted todo item under cursor
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

      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!markdownView) {
        return {
          success: false,
          message: "No active markdown view found",
        };
      }

      const editor = markdownView.editor;
      const cursor = editor.getCursor();

      // Find the promoted todo under cursor
      const promotedTodoInfo = await this.findPromotedTodoUnderCursor(
        activeFile,
        cursor.line
      );

      if (!promotedTodoInfo) {
        return {
          success: false,
          message: "No promoted todo found under cursor",
        };
      }

      const { taskMention, taskFile } = promotedTodoInfo;

      try {
        // Restore the original todo line
        await this.restoreOriginalTodoLine(activeFile, taskMention);

        // Remove the task file
        if (taskFile) {
          await this.app.vault.delete(taskFile);
        }

        // Remove the task mention from the store
        await taskMentionStore.removeEntity(
          taskMention.filePath || taskMention.id
        );

        // Remove the task from the task store
        const tasks = taskStore.getEntities();
        const correspondingTask = tasks.find(
          (task) =>
            task.source?.name === "todo-promotion" &&
            task.source?.metadata?.taskMentionId === taskMention.id
        );

        if (correspondingTask) {
          await taskStore.removeEntity(
            correspondingTask.filePath || correspondingTask.id
          );
        }

        // Refresh base views if auto-update is enabled
        if (this.settings.autoUpdateBaseViews) {
          await this.refreshBaseViewsCallback();
        }

        return {
          success: true,
          message: `Reverted promoted todo: ${taskMention.taskTitle}`,
          revertedCount: 1,
        };
      } catch (error) {
        console.error(
          `Failed to revert promoted todo ${taskMention.id}:`,
          error
        );
        return {
          success: false,
          message: "Failed to revert promoted todo",
        };
      }
    } catch (error) {
      console.error("Failed to revert promoted todo:", error);
      return {
        success: false,
        message: "Failed to revert promoted todo",
      };
    }
  }

  /**
   * Find a promoted todo under the cursor
   */
  private async findPromotedTodoUnderCursor(
    file: TFile,
    lineNumber: number
  ): Promise<{ taskMention: TaskMention; taskFile: TFile | null } | null> {
    // Get the line content to check if it's a promoted todo
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");

    if (lineNumber >= lines.length) {
      return null;
    }

    const line = lines[lineNumber];

    // Check if this line contains a task link (promoted todo format)
    const taskLinkMatch = line.match(/\[\[([^\]]+)\]\]/);
    if (!taskLinkMatch) {
      return null;
    }

    const taskTitle = taskLinkMatch[1];

    // Find the corresponding task mention
    const taskMention = taskMentionStore.getMentionByLocation(
      file.path,
      lineNumber
    );
    if (!taskMention) {
      return null;
    }

    // Find the corresponding task file
    const taskPath = `${this.settings.tasksFolder}/${taskTitle}.md`;
    const taskFile = this.app.vault.getAbstractFileByPath(taskPath);

    return {
      taskMention,
      taskFile: taskFile instanceof TFile ? taskFile : null,
    };
  }

  /**
   * Restore the original todo line from a task mention
   */
  private async restoreOriginalTodoLine(
    file: TFile,
    taskMention: TaskMention
  ): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");

    if (taskMention.lineNumber < lines.length) {
      // Reconstruct the original todo line
      const checkboxState = taskMention.completed ? "[x]" : "[ ]";
      const originalLine = `${taskMention.indentation}${taskMention.listMarker} ${checkboxState} ${taskMention.mentionText}`;

      lines[taskMention.lineNumber] = originalLine;
      await this.app.vault.modify(file, lines.join("\n"));
    }
  }

  /**
   * Update existing child tasks to set the newly created parent task
   */
  private async updateChildTasksParent(
    parentTodoItem: NoteTodoItem,
    file: TFile,
    parentTaskTitle: string
  ): Promise<void> {
    // Get all TaskMentions from this file
    const fileMentions = taskMentionStore.getMentionsForFile(file.path);

    // Find child todos that are indented more than the parent
    const childMentions = fileMentions.filter((mention: TaskMention) => {
      // Check if this mention is a child of the parent todo
      return (
        mention.lineNumber > parentTodoItem.lineNumber &&
        mention.indentation > parentTodoItem.indentation
      );
    });

    // Update each child task to set the parent
    for (const childMention of childMentions) {
      if (childMention.taskPath) {
        // Get the task file
        const taskFile = this.app.vault.getAbstractFileByPath(
          childMention.taskPath
        );
        if (taskFile instanceof TFile) {
          // Update the Parent task property
          await this.app.fileManager.processFrontMatter(
            taskFile,
            (frontmatter) => {
              frontmatter["Parent task"] = `[[${parentTaskTitle}]]`;
            }
          );
        }
      }
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
