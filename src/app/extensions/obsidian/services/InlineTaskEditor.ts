/**
 * InlineTaskEditor - High-level API for modifying notes with inline tasks
 * Handles adding, removing, and updating inline tasks in note content
 * Supports both section-aware and position-based operations
 */

import type { Task } from "../../../core/entities";
import type {
  InlineTodoItem,
  TaskSection,
} from "./InlineTaskParser";

/**
 * Options for adding tasks to content
 */
export interface AddTasksOptions {
  /** Section name to add tasks to (e.g., "Tasks"). If not provided, tasks are added at the end */
  section?: string;
  /** Insertion mode: 'section' (default) or 'position' */
  mode?: "section" | "position";
  /** Line number for position-based insertion (only used when mode is 'position') */
  lineNumber?: number;
}

/**
 * Options for removing tasks from content
 */
export interface RemoveTasksOptions {
  /** Whether to remove all occurrences or just the first match */
  removeAll?: boolean;
}

/**
 * Edit inline tasks in note content
 * Provides high-level API for modifying notes with inline tasks
 */
export class InlineTaskEditor {
  constructor(private tasksFolder: string = "Tasks") {}

  /**
   * Add tasks to note content
   * @param content The note content
   * @param tasks Array of tasks to add
   * @param options Options for adding tasks
   * @returns Updated content with tasks added
   */
  addTasks(
    content: string,
    tasks: Task[],
    options: AddTasksOptions = {}
  ): string {
    if (tasks.length === 0) {
      return content;
    }

    const { section, mode = "section", lineNumber } = options;

    // Format task links using wiki link format with full path and display text
    // Format: [[Tasks/Task Name|Display Text]]
    const taskLinks = tasks.map((task) => {
      const taskPath = task.source.keys.obsidian;
      const displayText = task.title;
      const wikiLink = `[[${taskPath}|${displayText}]]`;
      return `- [ ] ${wikiLink}`;
    });

    if (mode === "position" && lineNumber !== undefined) {
      return this.insertTasksAtPosition(content, taskLinks, lineNumber);
    }

    // Default: section-aware insertion
    const sectionName = section || "Tasks";
    return this.insertTasksInSection(content, taskLinks, sectionName);
  }

  /**
   * Remove tasks from note content by file path
   * @param content The note content
   * @param taskPaths Array of task file paths to remove
   * @param options Options for removing tasks
   * @returns Updated content with tasks removed
   */
  removeTasks(
    content: string,
    taskPaths: string[],
    options: RemoveTasksOptions = {}
  ): string {
    if (taskPaths.length === 0) {
      return content;
    }

    let updatedContent = content;

    for (const taskPath of taskPaths) {
      // Extract the task title from the file path (remove .md extension and path)
      const taskTitle = taskPath.split("/").pop()?.replace(/\.md$/, "") || "";

      // Escape special regex characters in paths
      const escapedPath = this.escapeRegex(taskPath);
      const escapedTitle = this.escapeRegex(taskTitle);

      // Remove task links in various formats:
      // - [ ] [[Tasks/Task Name|Task Name]]
      // - [ ] [[Task Name]]
      // - [x] [[Tasks/Task Name|Task Name]]
      // - [x] [[Task Name]]
      // - [ ] [[Tasks/Task Name|Display Text]] (any display text)

      const patterns = [
        // Full path with pipe separator and any display text
        new RegExp(
          `^\\s*-\\s*\\[[ x]\\]\\s*\\[\\[${escapedPath}\\|[^\\]]*\\]\\]\\s*$`,
          "m"
        ),
        // Just title with pipe separator (matches any path before pipe)
        new RegExp(
          `^\\s*-\\s*\\[[ x]\\]\\s*\\[\\[[^|]*\\|${escapedTitle}\\]\\]\\s*$`,
          "m"
        ),
        // Full path without pipe separator
        new RegExp(
          `^\\s*-\\s*\\[[ x]\\]\\s*\\[\\[${escapedPath}\\]\\]\\s*$`,
          "m"
        ),
        // Just title without pipe separator
        new RegExp(
          `^\\s*-\\s*\\[[ x]\\]\\s*\\[\\[${escapedTitle}\\]\\]\\s*$`,
          "m"
        ),
      ];

      for (const pattern of patterns) {
        if (options.removeAll) {
          updatedContent = updatedContent.replace(pattern, "");
        } else {
          updatedContent = updatedContent.replace(pattern, "");
          break; // Remove only first occurrence
        }
      }
    }

    // Clean up any extra blank lines left behind
    updatedContent = updatedContent.replace(/\n\n\n+/g, "\n\n");

    return updatedContent;
  }

  /**
   * Update task completion status in content
   * @param content The note content
   * @param taskPath The task file path
   * @param completed Whether the task should be marked as completed
   * @returns Updated content with task status changed
   */
  updateTaskStatus(
    content: string,
    taskPath: string,
    completed: boolean
  ): string {
    const taskTitle = taskPath.split("/").pop()?.replace(/\.md$/, "") || "";
    const escapedPath = this.escapeRegex(taskPath);
    const escapedTitle = this.escapeRegex(taskTitle);
    const checkboxState = completed ? "[x]" : "[ ]";

    // Patterns to match task links in various formats
    const patterns = [
      // Full path with pipe separator: [[path|display]] -> change checkbox
      new RegExp(
        `^(\\s*-\\s*)\\[([ x])\\]\\s*(\\[\\[${escapedPath}\\|[^\\]]*\\]\\])`,
        "m"
      ),
      // Just title with pipe separator: [[...|title]] -> change checkbox
      new RegExp(
        `^(\\s*-\\s*)\\[([ x])\\]\\s*(\\[\\[[^|]*\\|${escapedTitle}\\]\\])`,
        "m"
      ),
      // Full path without pipe: [[path]] -> change checkbox
      new RegExp(
        `^(\\s*-\\s*)\\[([ x])\\]\\s*(\\[\\[${escapedPath}\\]\\])`,
        "m"
      ),
      // Just title without pipe: [[title]] -> change checkbox
      new RegExp(
        `^(\\s*-\\s*)\\[([ x])\\]\\s*(\\[\\[${escapedTitle}\\]\\])`,
        "m"
      ),
    ];

    let updatedContent = content;

    for (const pattern of patterns) {
      updatedContent = updatedContent.replace(pattern, `$1${checkboxState} $3`);
    }

    return updatedContent;
  }

  /**
   * Replace a todo line with a task link (for todo promotion)
   * Preserves indentation, list marker, and checkbox state
   * @param content The note content
   * @param todo The todo item to replace
   * @param taskPath The task file path to link to
   * @param displayText Optional display text for the link (defaults to task filename)
   * @returns Updated content with todo replaced by task link
   */
  replaceTodoWithTaskLink(
    content: string,
    todo: InlineTodoItem,
    taskPath: string,
    displayText?: string
  ): string {
    const lines = content.split("\n");

    if (todo.lineNumber >= lines.length) {
      return content;
    }

    // Extract task name from path if display text not provided
    const taskName =
      displayText ||
      taskPath.split("/").pop()?.replace(/\.md$/, "") ||
      taskPath;

    // Format: [[Tasks/Task Name|Display Text]] or [[Task Name]] if path equals name
    // If taskPath doesn't contain "/" and doesn't end with ".md", treat it as just a name
    const isSimpleName = !taskPath.includes("/") && !taskPath.endsWith(".md");
    const wikiLink =
      isSimpleName || taskPath === taskName
        ? `[[${taskName}]]`
        : `[[${taskPath}|${taskName}]]`;

    // Replace the todo with a link, preserving indentation, list marker, and checkbox state
    const checkboxState = todo.completed ? "[x]" : "[ ]";
    const newLine = `${todo.indentation}${todo.listMarker} ${checkboxState} ${wikiLink}`;

    lines[todo.lineNumber] = newLine;

    return lines.join("\n");
  }

  /**
   * Restore original todo line from link format (for todo revert)
   * @param content The note content
   * @param todo The todo item with original text and formatting
   * @returns Updated content with link replaced by original todo text
   */
  restoreOriginalTodo(content: string, todo: InlineTodoItem): string {
    const lines = content.split("\n");

    if (todo.lineNumber >= lines.length) {
      return content;
    }

    // Reconstruct the original todo line
    const checkboxState = todo.completed ? "[x]" : "[ ]";
    const originalLine = `${todo.indentation}${todo.listMarker} ${checkboxState} ${todo.text}`;

    lines[todo.lineNumber] = originalLine;

    return lines.join("\n");
  }

  /**
   * Get task section from content
   * @param content The note content
   * @param sectionName The section name to find (e.g., "Tasks")
   * @returns Task section information or null if not found
   */
  getTaskSection(content: string, sectionName: string): TaskSection | null {
    const lines = content.split("\n");
    let sectionStart: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const sectionMatch = line.match(/^##\s+(.+)$/);

      if (sectionMatch && sectionMatch[1].trim() === sectionName) {
        sectionStart = i;
        break;
      }
    }

    if (sectionStart === null) {
      return null;
    }

    // Find the end of the section (next section or end of file)
    let sectionEnd = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^##\s+/)) {
        sectionEnd = i;
        break;
      }
    }

    return {
      name: sectionName,
      startLine: sectionStart,
      endLine: sectionEnd,
      tasks: [], // Tasks would be populated by InlineTaskParser
    };
  }

  /**
   * Insert tasks into a specific section
   */
  private insertTasksInSection(
    content: string,
    taskLinks: string[],
    sectionName: string
  ): string {
    const section = this.getTaskSection(content, sectionName);

    if (section) {
      // Add new tasks to existing section (after the heading)
      const lines = content.split("\n");
      const insertLine = section.startLine + 1;
      // Directly splice taskLinks to avoid extra empty line
      lines.splice(insertLine, 0, ...taskLinks);
      return lines.join("\n");
    } else {
      // Add section if it doesn't exist
      const newTasksSection = `\n## ${sectionName}\n${taskLinks.join("\n")}\n`;
      return content + newTasksSection;
    }
  }

  /**
   * Insert tasks at a specific line position
   */
  private insertTasksAtPosition(
    content: string,
    taskLinks: string[],
    lineNumber: number
  ): string {
    const lines = content.split("\n");

    if (lineNumber < 0 || lineNumber > lines.length) {
      // Invalid position, append at end
      const newTasks = taskLinks.join("\n");
      return content + "\n" + newTasks;
    }

    // Insert tasks at the specified line
    lines.splice(lineNumber, 0, ...taskLinks);
    return lines.join("\n");
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
