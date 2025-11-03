/**
 * InlineTaskParser - Parses inline tasks (todos) from any Obsidian note
 * Tracks ALL inline tasks (todos), not just those linked to task files
 * Provides information about todos with or without task links
 */

import { App, TFile, CachedMetadata, ListItemCache } from "obsidian";

/**
 * Represents an inline todo item extracted from a note
 * This includes ALL todos, whether they have task links or not
 */
export interface InlineTodoItem {
  /** The text content of the todo item (extracted from todo, handling wiki link formats) */
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
  /** Parent line number if this is a nested todo (from ListItemCache) */
  parentLineNumber?: number;
}

/**
 * Represents an inline task that is linked to a task file
 * Extends InlineTodoItem with task link information
 */
export interface InlineTask extends InlineTodoItem {
  /** The link text (e.g., "Task Name" from [[Task Name]] or "Display Text" from [[Tasks/Task Name|Display Text]]) */
  linkText: string;
  /** The resolved file path if the task file exists */
  filePath?: string;
  /** The raw link path from the wiki link */
  linkPath: string;
  /** Whether this todo has a task link */
  hasTaskLink: boolean;
}

/**
 * Represents a section containing tasks (e.g., "## Tasks")
 */
export interface TaskSection {
  /** The section name/heading (e.g., "Tasks") */
  name: string;
  /** Line number where the section starts (0-based) */
  startLine: number;
  /** Line number where the section ends (0-based, exclusive) */
  endLine: number;
  /** Tasks found in this section */
  tasks: InlineTask[];
}

/**
 * Parse inline tasks (todos) from any Obsidian note
 * Works with any note from any folder, configurable task folder scope
 */
export class InlineTaskParser {
  constructor(private app: App, private tasksFolder: string = "Tasks") {}

  /**
   * Parse a note and extract all inline todos (with or without task links)
   * @param file The note file to parse
   * @param tasksFolderOverride Optional override for tasks folder (defaults to instance tasksFolder)
   * @returns Array of inline todos found in the note
   */
  async parseInlineTodos(
    file: TFile,
    tasksFolderOverride?: string
  ): Promise<InlineTodoItem[]> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) {
        return [];
      }

      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      return this.extractTodos(cache, lines);
    } catch (error) {
      console.error(`InlineTaskParser: Error parsing ${file.path}:`, error);
      return [];
    }
  }

  /**
   * Parse a note and extract inline tasks (todos linked to task files)
   * @param file The note file to parse
   * @param tasksFolderOverride Optional override for tasks folder (defaults to instance tasksFolder)
   * @returns Array of inline tasks found in the note (only todos with task links)
   */
  async parseInlineTasks(
    file: TFile,
    tasksFolderOverride?: string
  ): Promise<InlineTask[]> {
    try {
      const tasksFolder = tasksFolderOverride || this.tasksFolder;
      const todos = await this.parseInlineTodos(file, tasksFolder);
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.links) {
        return [];
      }

      // Build a map of links by line number for quick lookup
      const linksByLine = new Map<number, (typeof cache.links)[0]>();
      for (const link of cache.links) {
        const lineNumber = link.position.start.line;
        if (!linksByLine.has(lineNumber)) {
          linksByLine.set(lineNumber, link);
        }
      }

      const inlineTasks: InlineTask[] = [];

      for (const todo of todos) {
        const link = linksByLine.get(todo.lineNumber);
        if (!link) {
          // Todo without a link - skip for parseInlineTasks (only return todos with task links)
          continue;
        }

        // Check if this link points to a task file
        const linkPath = link.link;
        const isTaskLink =
          linkPath.startsWith(tasksFolder + "/") ||
          this.isTaskFile(linkPath, tasksFolder, file);

        if (!isTaskLink) {
          continue;
        }

        // Resolve the file path
        const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(
          linkPath,
          file.path
        );

        // Extract text from todo (handling wiki link formats)
        const extractedText = this.extractTextFromTodo(todo.text, linkPath);

        inlineTasks.push({
          ...todo,
          linkText: link.displayText || linkPath,
          filePath: resolvedFile?.path,
          linkPath,
          hasTaskLink: true,
          text: extractedText,
        });
      }

      return inlineTasks;
    } catch (error) {
      console.error(
        `InlineTaskParser: Error parsing tasks ${file.path}:`,
        error
      );
      return [];
    }
  }

  /**
   * Extract all todos from note content using Obsidian's ListItemCache
   */
  private extractTodos(
    cache: CachedMetadata,
    lines: string[]
  ): InlineTodoItem[] {
    const todos: InlineTodoItem[] = [];

    // Use ListItemCache to get all list items (including todos)
    if (!cache.listItems) {
      return todos;
    }

    for (const listItem of cache.listItems) {
      // Only process items that are todos (have task property)
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
        todos.push(todoItem);
      }
    }

    return todos;
  }

  /**
   * Parse a ListItemCache into an InlineTodoItem
   */
  private parseListItemToTodo(
    listItem: ListItemCache,
    line: string,
    lineNumber: number
  ): InlineTodoItem | null {
    // Regex to match todo items: optional whitespace, list marker (- or *), checkbox, text
    const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
    const match = line.match(todoRegex);

    if (!match) {
      return null;
    }

    const [, indentation, listMarker, checkboxState, text] = match;

    // Determine parent line number from ListItemCache
    // parent >= 0 means it has a parent at that line number
    // parent < 0 means it's a root item (negative value is start of list)
    const parentLineNumber = listItem.parent >= 0 ? listItem.parent : undefined;

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
   * Extract text content from a todo, handling wiki link formats
   * If the text contains a wiki link like [[path|display]] or [[path]], extract the display text or path
   */
  private extractTextFromTodo(text: string, linkPath?: string): string {
    // Check if text is a wiki link format: [[path|display]] or [[path]]
    const wikiLinkMatch = text.match(/^\[\[([^\]]+)\]\]$/);
    if (wikiLinkMatch) {
      const linkContent = wikiLinkMatch[1];
      const pipeIndex = linkContent.indexOf("|");
      if (pipeIndex !== -1) {
        // Has display text: [[path|display]] - return display text
        return linkContent.substring(pipeIndex + 1).trim();
      } else {
        // No display text: [[path]] - extract filename from path or use full path
        const pathParts = linkContent.split("/");
        return pathParts[pathParts.length - 1];
      }
    }

    // Not a wiki link format, return text as-is
    return text;
  }

  /**
   * Check if a link path refers to a task file
   */
  private isTaskFile(
    linkPath: string,
    tasksFolder: string,
    sourceFile: TFile
  ): boolean {
    // Try to resolve the link
    const file = this.app.vault.getAbstractFileByPath(linkPath);
    if (file instanceof TFile) {
      return file.path.startsWith(tasksFolder + "/");
    }

    // Try with .md extension
    const fileWithExt = this.app.vault.getAbstractFileByPath(linkPath + ".md");
    if (fileWithExt instanceof TFile) {
      return fileWithExt.path.startsWith(tasksFolder + "/");
    }

    // Try resolving via metadata cache (handles relative paths)
    const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(
      linkPath,
      sourceFile.path
    );
    if (resolvedFile) {
      return resolvedFile.path.startsWith(tasksFolder + "/");
    }

    // Try in tasks folder
    const fileInTasksFolder = this.app.vault.getAbstractFileByPath(
      `${tasksFolder}/${linkPath}`
    );
    if (fileInTasksFolder instanceof TFile) {
      return true;
    }

    const fileInTasksFolderWithExt = this.app.vault.getAbstractFileByPath(
      `${tasksFolder}/${linkPath}.md`
    );
    if (fileInTasksFolderWithExt instanceof TFile) {
      return true;
    }

    return false;
  }

  /**
   * Get task file paths from a note
   * This is a convenience method that returns just the file paths
   * @param file The note file to parse
   * @param tasksFolderOverride Optional override for tasks folder (defaults to instance tasksFolder)
   * @returns Array of task file paths found in the note
   */
  async getTaskFilePaths(
    file: TFile,
    tasksFolderOverride?: string
  ): Promise<string[]> {
    const inlineTasks = await this.parseInlineTasks(file, tasksFolderOverride);
    return inlineTasks
      .filter((task) => task.filePath !== undefined)
      .map((task) => task.filePath!);
  }

  /**
   * Check if a specific task is linked in the note
   * @param noteFile The note file to check
   * @param taskFilePath The task file path to look for
   * @param tasksFolderOverride Optional override for tasks folder (defaults to instance tasksFolder)
   * @returns True if the task is linked in the note
   */
  async isTaskLinkedInNote(
    noteFile: TFile,
    taskFilePath: string,
    tasksFolderOverride?: string
  ): Promise<boolean> {
    const taskPaths = await this.getTaskFilePaths(
      noteFile,
      tasksFolderOverride
    );
    return taskPaths.includes(taskFilePath);
  }

  /**
   * Get a todo item at a specific line number
   * Useful for cursor-based operations (e.g., todo promotion)
   * @param file The note file to parse
   * @param lineNumber The line number (0-based)
   * @param tasksFolderOverride Optional override for tasks folder (defaults to instance tasksFolder)
   * @returns The todo item at the specified line, or null if not found
   */
  async getTodoAtLine(
    file: TFile,
    lineNumber: number,
    tasksFolderOverride?: string
  ): Promise<InlineTodoItem | null> {
    const todos = await this.parseInlineTodos(file, tasksFolderOverride);
    return todos.find((todo) => todo.lineNumber === lineNumber) || null;
  }

  /**
   * Find the parent todo item for a given todo
   * @param file The note file
   * @param todo The todo item to find the parent for
   * @param tasksFolderOverride Optional override for tasks folder (defaults to instance tasksFolder)
   * @returns The parent todo item, or null if not found
   */
  async findParentTodo(
    file: TFile,
    todo: InlineTodoItem,
    tasksFolderOverride?: string
  ): Promise<InlineTodoItem | null> {
    if (todo.parentLineNumber === undefined) {
      return null;
    }

    const todos = await this.parseInlineTodos(file, tasksFolderOverride);
    return todos.find((t) => t.lineNumber === todo.parentLineNumber) || null;
  }

  /**
   * Get all task sections from a note
   * Finds sections like "## Tasks" and returns tasks within those sections
   * @param file The note file to parse
   * @param tasksFolderOverride Optional override for tasks folder (defaults to instance tasksFolder)
   * @returns Array of task sections found in the note
   */
  async getTaskSections(
    file: TFile,
    tasksFolderOverride?: string
  ): Promise<TaskSection[]> {
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const inlineTasks = await this.parseInlineTasks(
        file,
        tasksFolderOverride
      );

      const sections: TaskSection[] = [];
      let currentSection: TaskSection | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for section heading (## SectionName)
        const sectionMatch = line.match(/^##\s+(.+)$/);

        if (sectionMatch) {
          // Save previous section if it had tasks
          if (currentSection && currentSection.tasks.length > 0) {
            currentSection.endLine = i;
            sections.push(currentSection);
          }

          // Start new section
          currentSection = {
            name: sectionMatch[1].trim(),
            startLine: i,
            endLine: lines.length, // Will be updated when section ends
            tasks: [],
          };
        } else if (currentSection) {
          // Check if this line has a task for the current section
          const taskOnLine = inlineTasks.find((task) => task.lineNumber === i);
          if (taskOnLine) {
            currentSection.tasks.push(taskOnLine);
          }
        }
      }

      // Don't forget the last section
      if (currentSection && currentSection.tasks.length > 0) {
        currentSection.endLine = lines.length;
        sections.push(currentSection);
      }

      return sections;
    } catch (error) {
      console.error(
        `InlineTaskParser: Error getting task sections ${file.path}:`,
        error
      );
      return [];
    }
  }
}
