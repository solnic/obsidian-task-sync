/**
 * TaskMentionDetectionService
 * Detects and manages task mentions in markdown files
 * Scans for todo items that contain wiki links to task notes
 */

import { App, TFile } from "obsidian";
import { TaskSyncSettings } from "../main-old";
import { TaskMention } from "../types/entities";
import { taskMentionStore } from "../stores/taskMentionStore";
import {
  EventManager,
  EventType,
  TaskMentionEventData,
  TaskMentionStateChangedEventData,
} from "../events";

export interface TodoItemMatch {
  text: string;
  completed: boolean;
  indentation: string;
  listMarker: string;
  lineNumber: number;
  taskLink?: string;
  taskTitle?: string;
}

export class TaskMentionDetectionService {
  constructor(
    private app: App,
    private settings: TaskSyncSettings,
    private eventManager: EventManager
  ) {}

  /**
   * Scan a file for task mentions and update the store
   */
  async scanFileForTaskMentions(file: TFile): Promise<TaskMention[]> {
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const mentions: TaskMention[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const todoMatch = this.parseTodoLine(line, i);

        if (todoMatch && todoMatch.taskLink) {
          const taskPath = await this.resolveTaskPath(todoMatch.taskLink);

          if (taskPath && (await this.isValidTaskFile(taskPath))) {
            const mention = await this.createTaskMention(
              file.path,
              todoMatch,
              taskPath
            );

            if (mention) {
              mentions.push(mention);
            }
          }
        }
      }

      return mentions;
    } catch (error) {
      console.error(
        `TaskMentionDetectionService: Error scanning file ${file.path}:`,
        error
      );
      return [];
    }
  }

  /**
   * Parse a line to detect todo items with task links
   */
  private parseTodoLine(
    line: string,
    lineNumber: number
  ): TodoItemMatch | null {
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
      completed: checkboxState.toLowerCase() === "x",
      indentation,
      listMarker,
      lineNumber,
      taskLink,
      taskTitle: taskLink,
    };
  }

  /**
   * Resolve a wiki link to a task file path
   */
  private async resolveTaskPath(linkText: string): Promise<string | null> {
    // Try different path variations to find the task file
    const possiblePaths = [
      `${this.settings.tasksFolder}/${linkText}.md`,
      `${this.settings.tasksFolder}/${linkText}`,
      `${linkText}.md`,
      linkText,
    ];

    for (const path of possiblePaths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        return path;
      }
    }

    return null;
  }

  /**
   * Check if a file is a valid task file managed by our plugin
   */
  private async isValidTaskFile(filePath: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        return false;
      }

      // Check if it's in the tasks folder
      if (!filePath.startsWith(`${this.settings.tasksFolder}/`)) {
        return false;
      }

      // Check front matter
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;

      return frontmatter?.Type === "Task";
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a TaskMention entity
   */
  private async createTaskMention(
    sourceFilePath: string,
    todoMatch: TodoItemMatch,
    taskPath: string
  ): Promise<TaskMention | null> {
    try {
      const mentionId = `${sourceFilePath}:${todoMatch.lineNumber}`;

      const mention: TaskMention = {
        id: mentionId,
        sourceFilePath,
        lineNumber: todoMatch.lineNumber,
        taskPath,
        taskTitle: todoMatch.taskTitle || todoMatch.taskLink || "",
        mentionText: todoMatch.text,
        completed: todoMatch.completed,
        indentation: todoMatch.indentation,
        listMarker: todoMatch.listMarker,
        lastSynced: new Date(),
        createdAt: new Date(),
        filePath: mentionId, // For EntityStore compatibility
      };

      return mention;
    } catch (error) {
      console.error(
        "TaskMentionDetectionService: Error creating task mention:",
        error
      );
      return null;
    }
  }

  /**
   * Update task mentions for a file
   */
  async updateTaskMentionsForFile(file: TFile): Promise<void> {
    try {
      // Get existing mentions for this file
      const existingMentions = taskMentionStore.getMentionsForFile(file.path);

      // Scan for current mentions
      const currentMentions = await this.scanFileForTaskMentions(file);

      // Create maps for easier comparison
      const existingMap = new Map(
        existingMentions.map((m) => [`${m.lineNumber}`, m])
      );
      const currentMap = new Map(
        currentMentions.map((m) => [`${m.lineNumber}`, m])
      );

      // Handle deletions
      for (const [key, mention] of existingMap) {
        if (!currentMap.has(key)) {
          await taskMentionStore.removeEntity(mention.id);

          // Emit deletion event
          const eventData: TaskMentionEventData = {
            filePath: mention.sourceFilePath,
            lineNumber: mention.lineNumber,
            taskPath: mention.taskPath,
            taskTitle: mention.taskTitle,
            mentionText: mention.mentionText,
            completed: mention.completed,
            indentation: mention.indentation,
            listMarker: mention.listMarker,
          };

          await this.eventManager.emit(
            EventType.TASK_MENTION_DELETED,
            eventData
          );
        }
      }

      // Handle additions and updates
      for (const [key, mention] of currentMap) {
        const existing = existingMap.get(key);

        if (!existing) {
          // New mention
          await taskMentionStore.upsertEntity(mention);

          // Emit creation event
          const eventData: TaskMentionEventData = {
            filePath: mention.sourceFilePath,
            lineNumber: mention.lineNumber,
            taskPath: mention.taskPath,
            taskTitle: mention.taskTitle,
            mentionText: mention.mentionText,
            completed: mention.completed,
            indentation: mention.indentation,
            listMarker: mention.listMarker,
          };

          await this.eventManager.emit(
            EventType.TASK_MENTION_CREATED,
            eventData
          );
        } else if (existing.completed !== mention.completed) {
          // State change
          const eventData: TaskMentionStateChangedEventData = {
            filePath: mention.sourceFilePath,
            lineNumber: mention.lineNumber,
            taskPath: mention.taskPath,
            taskTitle: mention.taskTitle,
            mentionText: mention.mentionText,
            oldCompleted: existing.completed,
            newCompleted: mention.completed,
            indentation: mention.indentation,
            listMarker: mention.listMarker,
          };

          await taskMentionStore.upsertEntity(mention); // Use upsertEntity which handles updates
          await this.eventManager.emit(
            EventType.TASK_MENTION_COMPLETED,
            eventData
          );
        }
      }
    } catch (error) {
      console.error(
        `TaskMentionDetectionService: Error updating mentions for ${file.path}:`,
        error
      );
    }
  }

  /**
   * Remove all mentions for a file (when file is deleted)
   */
  async removeTaskMentionsForFile(filePath: string): Promise<void> {
    await taskMentionStore.removeMentionsForFile(filePath);
  }

  /**
   * Remove all mentions for a task (when task is deleted)
   */
  async removeTaskMentionsForTask(taskPath: string): Promise<void> {
    await taskMentionStore.removeMentionsForTask(taskPath);
  }
}
