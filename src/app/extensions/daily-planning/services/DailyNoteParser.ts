/**
 * DailyNoteParser - Parses Daily Notes to extract task links
 * This is the source of truth for what tasks are actually scheduled
 */

import { App, TFile, CachedMetadata } from "obsidian";

/**
 * Represents a task link found in a daily note
 */
export interface TaskLink {
  /** The link text (e.g., "Task Name" from [[Task Name]]) */
  linkText: string;
  /** The resolved file path if the task file exists */
  filePath?: string;
  /** Line number where the link was found (0-based) */
  lineNumber: number;
  /** Whether this is in a todo item (has checkbox) */
  isTodoItem: boolean;
  /** Whether the todo is completed (if isTodoItem is true) */
  isCompleted?: boolean;
  /** The full line content */
  originalLine: string;
}

/**
 * Parse a daily note to extract task links
 */
export class DailyNoteParser {
  constructor(private app: App) {}

  /**
   * Parse a daily note file and extract all task links
   * @param file The daily note file to parse
   * @param tasksFolder The folder where task files are stored (e.g., "Tasks")
   * @returns Array of task links found in the note
   */
  async parseTaskLinks(
    file: TFile,
    tasksFolder: string = "Tasks"
  ): Promise<TaskLink[]> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) {
        return [];
      }

      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      return this.extractTaskLinks(cache, lines, tasksFolder, file);
    } catch (error) {
      console.error(`DailyNoteParser: Error parsing ${file.path}:`, error);
      return [];
    }
  }

  /**
   * Extract task links from the note content
   */
  private extractTaskLinks(
    cache: CachedMetadata,
    lines: string[],
    tasksFolder: string,
    sourceFile: TFile
  ): TaskLink[] {
    const taskLinks: TaskLink[] = [];

    // Get all links from the cache
    if (!cache.links) {
      return taskLinks;
    }

    // Process each link
    for (const link of cache.links) {
      const lineNumber = link.position.start.line;
      const line = lines[lineNumber];

      if (!line) {
        continue;
      }

      // Check if this link points to a task file
      const linkPath = link.link;

      // Check if the link is to a task file (in the tasks folder)
      // This handles both full paths and just file names
      const isTaskLink =
        linkPath.startsWith(tasksFolder + "/") ||
        this.isTaskFile(linkPath, tasksFolder);

      if (!isTaskLink) {
        continue;
      }

      // Check if this is a todo item
      const todoInfo = this.parseTodoLine(line);

      // Resolve the file path
      const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(
        linkPath,
        sourceFile.path
      );

      taskLinks.push({
        linkText: link.displayText || linkPath,
        filePath: resolvedFile?.path,
        lineNumber,
        isTodoItem: todoInfo !== null,
        isCompleted: todoInfo?.completed,
        originalLine: line,
      });
    }

    return taskLinks;
  }

  /**
   * Check if a link path refers to a task file
   */
  private isTaskFile(linkPath: string, tasksFolder: string): boolean {
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
   * Parse a line to check if it's a todo item and extract its state
   */
  private parseTodoLine(
    line: string
  ): { completed: boolean; text: string } | null {
    // Regex to match todo items: optional whitespace, list marker (- or *), checkbox, text
    const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
    const match = line.match(todoRegex);

    if (!match) {
      return null;
    }

    const [, , , checkboxState, text] = match;

    return {
      completed: checkboxState.toLowerCase() === "x",
      text: text.trim(),
    };
  }

  /**
   * Get task file paths from a daily note
   * This is a convenience method that returns just the file paths
   */
  async getTaskFilePaths(
    file: TFile,
    tasksFolder: string = "Tasks"
  ): Promise<string[]> {
    const taskLinks = await this.parseTaskLinks(file, tasksFolder);
    return taskLinks
      .filter((link) => link.filePath !== undefined)
      .map((link) => link.filePath!);
  }

  /**
   * Check if a specific task is linked in the daily note
   */
  async isTaskLinkedInNote(
    dailyNoteFile: TFile,
    taskFilePath: string,
    tasksFolder: string = "Tasks"
  ): Promise<boolean> {
    const taskPaths = await this.getTaskFilePaths(dailyNoteFile, tasksFolder);
    return taskPaths.includes(taskFilePath);
  }
}
