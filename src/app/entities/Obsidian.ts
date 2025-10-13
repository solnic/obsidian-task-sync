/**
 * Obsidian-specific Entity Operations
 * Extends base entity operations to add Obsidian-specific behavior
 * Works for all entity types: Tasks, Projects, Areas
 */

import { Task, Project, Area } from "../core/entities";
import { Tasks } from "./Tasks";
import { Projects } from "./Projects";
import { Areas } from "./Areas";
import { App, MarkdownView, TFile } from "obsidian";
import { ContextService } from "../services/ContextService";

import type { TaskSyncSettings } from "../types/settings";
import type { FileContext } from "../types/context";

// ObsidianConfig interface removed - operations now get folder paths from settings

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
}

/**
 * Result of todo promotion operation
 */
export interface TodoPromotionResult {
  success: boolean;
  message: string;
  taskPath?: string;
  parentTaskName?: string;
}

/**
 * Result of todo revert operation
 */
export interface TodoRevertResult {
  success: boolean;
  message: string;
}

/**
 * Obsidian namespace containing extension-specific operations
 */
export namespace Obsidian {
  /**
   * Obsidian-specific Task Operations
   * Overrides buildEntity to automatically set source.filePath and determine status from done field
   */
  export class TaskOperations extends Tasks.Operations {
    public buildEntity(
      taskData: Omit<Task, "id" | "createdAt" | "updatedAt">
    ): Task {
      // First, let the base buildEntity handle schema validation and defaults
      const baseEntity = super.buildEntity(taskData) as Task;

      // Use conservative sanitization - only remove truly invalid characters
      const sanitizedTitle = this.sanitizeTitle(taskData.title);

      // Determine appropriate status based on done field if status is empty/default
      // This happens AFTER schema validation so we can resolve status dynamically
      let finalStatus = baseEntity.status;
      if (!finalStatus && this.settings) {
        finalStatus = this.determineStatusFromDone(baseEntity.done);
      }

      // Use tasksFolder from settings if available, otherwise use constructor parameter
      const folder = this.settings.tasksFolder;

      const result = {
        ...baseEntity,
        status: finalStatus || baseEntity.status,
        source: {
          ...taskData.source, // Preserve existing source data (e.g., from GitHub)
          extension: taskData.source?.extension || "obsidian", // Preserve original extension
          filePath: `${folder}/${sanitizedTitle}.md`,
        },
      };

      return result;
    }

    /**
     * Sanitize title for use in file path
     */
    private sanitizeTitle(title: string): string {
      return title.replace(/[<>:"/\\|?*]/g, "").trim();
    }

    /**
     * Determine appropriate status based on done field and configured statuses
     * ONLY uses what's configured in settings - no fallbacks
     */
    private determineStatusFromDone(done: boolean): string {
      if (!this.settings) {
        throw new Error(
          "Settings are required to determine status from done field"
        );
      }

      if (done) {
        // For done=true, use the first configured status with isDone=true
        const doneStatus = this.settings.taskStatuses.find(
          (s) => s.isDone === true
        );
        if (!doneStatus) {
          throw new Error("No completed status configured in settings");
        }
        return doneStatus.name;
      } else {
        // For done=false, use the first configured status that is NOT in progress
        // (isDone=false AND isInProgress=false)
        const notStartedStatus = this.settings.taskStatuses.find(
          (s) => s.isDone === false && s.isInProgress === false
        );
        if (!notStartedStatus) {
          throw new Error("No not-started status configured in settings");
        }
        return notStartedStatus.name;
      }
    }
  }

  /**
   * Obsidian-specific Project Operations
   * Overrides buildEntity to automatically set source.filePath
   */
  export class ProjectOperations extends Projects.Operations {
    public buildEntity(
      projectData: Omit<Project, "id" | "createdAt" | "updatedAt">
    ): Project {
      const baseEntity = super.buildEntity(projectData) as Project;

      return {
        ...baseEntity,
        source: {
          extension: "obsidian",
          filePath: `${this.settings.projectsFolder}/${projectData.name}.md`,
        },
      };
    }
  }

  /**
   * Obsidian-specific Area Operations
   * Overrides buildEntity to automatically set source.filePath
   */
  export class AreaOperations extends Areas.Operations {
    public buildEntity(
      areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
    ): Area {
      const baseEntity = super.buildEntity(areaData) as Area;

      return {
        ...baseEntity,
        source: {
          extension: "obsidian",
          filePath: `${this.settings.areasFolder}/${areaData.name}.md`,
        },
      };
    }
  }

  /**
   * Todo Promotion Operations
   * Handles promoting todo items to tasks and reverting promoted todos
   */
  export class TodoPromotionOperations {
    constructor(
      private app: App,
      private settings: TaskSyncSettings,
      private contextService: ContextService,
      private taskOperations: TaskOperations
    ) {}

    /**
     * Promote a todo item under cursor to a task
     */
    async promoteTodoToTask(): Promise<TodoPromotionResult> {
      try {
        const editorContext = this.getActiveMarkdownEditor();
        if (!editorContext.success) {
          return {
            success: false,
            message: editorContext.message,
          };
        }

        const { file: activeFile, cursor } = editorContext;

        const todoItem = await this.getTodoAtLine(activeFile, cursor.line);

        if (!todoItem) {
          return {
            success: false,
            message: "No todo item found under cursor",
          };
        }

        // Detect context for the current file
        const context = this.contextService.detectCurrentFileContext();

        // Create task data from todo item
        const taskData = await this.createTaskFromTodo(
          todoItem,
          context,
          activeFile
        );

        // Create the task using Obsidian task operations
        const createdTask = await this.taskOperations.create(taskData);

        // Replace the todo line with a link to the created task
        await this.replaceTodoLineWithLink(
          todoItem,
          activeFile,
          createdTask.title
        );

        return {
          success: true,
          message: `Todo promoted to task: ${createdTask.title}`,
          taskPath: createdTask.source?.filePath,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Error promoting todo: ${error.message}`,
        };
      }
    }

    /**
     * Revert a promoted todo back to its original format
     */
    async revertPromotedTodo(): Promise<TodoRevertResult> {
      try {
        const editorContext = this.getActiveMarkdownEditor();
        if (!editorContext.success) {
          return {
            success: false,
            message: editorContext.message!,
          };
        }

        const { file: activeFile, cursor } = editorContext;

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

        // Restore the original todo line
        await this.restoreOriginalTodoLine(activeFile, promotedTodoInfo);

        // Delete the task file
        const taskFile = this.app.vault.getAbstractFileByPath(
          promotedTodoInfo.taskPath
        );
        if (taskFile instanceof TFile) {
          await this.app.vault.delete(taskFile);
        }

        return {
          success: true,
          message: `Promoted todo reverted: ${promotedTodoInfo.originalText}`,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Error reverting todo: ${error.message}`,
        };
      }
    }

    /**
     * Get active markdown editor context
     * Encapsulates repeated logic for getting active file and markdown view
     */
    private getActiveMarkdownEditor(): {
      success: boolean;
      file?: TFile;
      editor?: any;
      cursor?: any;
      message?: string;
    } {
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

      return {
        success: true,
        file: activeFile,
        editor,
        cursor,
      };
    }

    /**
     * Get todo item at a specific line number
     */
    private async getTodoAtLine(
      file: TFile,
      lineNumber: number
    ): Promise<NoteTodoItem | null> {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const line = lines[lineNumber];

      if (!line) {
        return null;
      }

      // Parse the line to extract todo components
      const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
      const match = line.match(todoRegex);

      if (!match) {
        return null;
      }

      const [, indentation, listMarker, checkboxState, text] = match;

      // Find parent line number if this is a nested todo
      const parentLineNumber = this.findParentTodoLine(
        lines,
        lineNumber,
        indentation
      );

      return {
        text: text.trim(),
        completed: checkboxState.toLowerCase() === "x",
        indentation,
        listMarker,
        lineNumber,
        originalLine: line,
        parentLineNumber,
      };
    }

    /**
     * Find the parent todo line for a nested todo item
     */
    private findParentTodoLine(
      lines: string[],
      currentLineNumber: number,
      currentIndentation: string
    ): number | undefined {
      // If no indentation, this is a top-level todo
      if (currentIndentation.length === 0) {
        return undefined;
      }

      // Look backwards from current line to find parent with less indentation
      for (let i = currentLineNumber - 1; i >= 0; i--) {
        const line = lines[i];
        const todoMatch = line.match(/^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/);

        if (todoMatch) {
          const [, lineIndentation] = todoMatch;
          // Parent must have less indentation
          if (lineIndentation.length < currentIndentation.length) {
            return i;
          }
        }
      }

      return undefined;
    }

    /**
     * Create task data from todo item
     */
    private async createTaskFromTodo(
      todoItem: NoteTodoItem,
      context: FileContext,
      file: TFile
    ): Promise<Omit<Task, "id" | "createdAt" | "updatedAt">> {
      // Determine context-based properties
      let project = "";
      let areas: string[] = [];

      if (context.type === "project" && context.name) {
        project = context.name;
      }
      if (context.type === "area" && context.name) {
        areas = [context.name];
      }

      // Determine parent task if this is a nested todo
      let parentTask = "";
      if (todoItem.parentLineNumber !== undefined) {
        const parentTodo = await this.getTodoAtLine(
          file,
          todoItem.parentLineNumber
        );
        if (parentTodo) {
          // Check if parent todo text is a link to an existing task
          const linkMatch = parentTodo.text.match(/^\[\[(.+)\]\]$/);
          if (linkMatch) {
            // Parent is already promoted to a task, keep the wiki link format
            parentTask = `[[${linkMatch[1]}]]`;
          }
        }
      }

      // Build minimal task data - buildEntity will set defaults
      // Status will be determined by buildEntity based on done field and settings
      // Don't set: status, priority, tags, doDate, dueDate, category, description
      // These will all use schema defaults
      const taskData: any = {
        title: todoItem.text,
        done: todoItem.completed,
        parentTask,
        project,
        areas,
        // Add source metadata for tracking
        source: {
          extension: "obsidian",
          data: {
            sourceFile: file.path,
            lineNumber: todoItem.lineNumber,
            originalLine: todoItem.originalLine,
            indentation: todoItem.indentation,
            listMarker: todoItem.listMarker,
            parentLineNumber: todoItem.parentLineNumber,
          },
        },
      };

      return taskData;
    }

    /**
     * Replace todo line with a link to the created task
     */
    private async replaceTodoLineWithLink(
      todoItem: NoteTodoItem,
      file: TFile,
      taskTitle: string
    ): Promise<void> {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      // Generate replacement line preserving format
      const checkboxPart = todoItem.completed ? "[x]" : "[ ]";
      const replacementLine = `${todoItem.indentation}${todoItem.listMarker} ${checkboxPart} [[${taskTitle}]]`;

      lines[todoItem.lineNumber] = replacementLine;

      await this.app.vault.modify(file, lines.join("\n"));
    }

    /**
     * Find promoted todo under cursor
     */
    private async findPromotedTodoUnderCursor(
      file: TFile,
      lineNumber: number
    ): Promise<{
      taskPath: string;
      originalText: string;
      lineNumber: number;
    } | null> {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const line = lines[lineNumber];

      if (!line) {
        return null;
      }

      // Check if line contains a wiki link (promoted todo format)
      const wikiLinkRegex =
        /^(\s*)([-*])\s*(\[([xX\s])\])?\s*\[\[([^\]]+)\]\]$/;
      const match = line.match(wikiLinkRegex);

      if (!match) {
        return null;
      }

      const [, , , , , taskTitle] = match;
      const baseTitle = taskTitle.split("|")[0].trim();
      const taskPath = `${this.settings.tasksFolder}/${baseTitle}.md`;

      // Verify the task file exists
      const taskFile = this.app.vault.getAbstractFileByPath(taskPath);
      if (!taskFile) {
        return null;
      }

      return {
        taskPath,
        originalText: taskTitle,
        lineNumber,
      };
    }

    /**
     * Restore original todo line
     */
    private async restoreOriginalTodoLine(
      file: TFile,
      promotedTodoInfo: {
        taskPath: string;
        originalText: string;
        lineNumber: number;
      }
    ): Promise<void> {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const currentLine = lines[promotedTodoInfo.lineNumber];

      // Parse current line to preserve format
      const wikiLinkRegex =
        /^(\s*)([-*])\s*(\[([xX\s])\])?\s*\[\[([^\]]+)\]\]$/;
      const match = currentLine.match(wikiLinkRegex);

      if (match) {
        const [, indentation, listMarker, checkboxPart] = match;
        const checkbox = checkboxPart || "[ ]";

        // Restore original todo format
        const restoredLine = `${indentation}${listMarker} ${checkbox} ${promotedTodoInfo.originalText}`;
        lines[promotedTodoInfo.lineNumber] = restoredLine;

        await this.app.vault.modify(file, lines.join("\n"));
      }
    }
  }

  /**
   * Factory class to create Obsidian operations with custom configuration
   */
  export class Operations {
    public readonly tasks: TaskOperations;
    public readonly projects: ProjectOperations;
    public readonly areas: AreaOperations;
    public readonly todoPromotion: TodoPromotionOperations;

    constructor(
      app: App,
      settings: TaskSyncSettings,
      contextService: ContextService
    ) {
      this.tasks = new TaskOperations(settings);
      this.projects = new ProjectOperations(settings);
      this.areas = new AreaOperations(settings);
      this.todoPromotion = new TodoPromotionOperations(
        app,
        settings,
        contextService,
        this.tasks
      );
    }
  }
}

// Singleton operations removed - operations should be accessed through ObsidianExtension instance
