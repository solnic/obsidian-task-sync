/**
 * TaskMentionSyncHandler - Syncs task mention completion state with linked task entities
 * Handles TASK_MENTION_COMPLETED and TASK_MENTION_UNCOMPLETED events to update task Done status
 */

import { App, TFile } from "obsidian";
import {
  EventHandler,
  EventType,
  PluginEvent,
  TaskMentionStateChangedEventData,
} from "../EventTypes";
import { TaskSyncSettings } from "../../main";
import { taskStore } from "../../stores/taskStore";
import { NoteManagers } from "../../services/NoteManagers";

export class TaskMentionSyncHandler implements EventHandler {
  constructor(
    private app: App,
    private settings: TaskSyncSettings,
    private noteManagers: NoteManagers
  ) {}

  /**
   * Get supported event types
   */
  getSupportedEventTypes(): EventType[] {
    return [
      EventType.TASK_MENTION_COMPLETED,
      EventType.TASK_MENTION_UNCOMPLETED,
    ];
  }

  /**
   * Check if this handler should process the event
   */
  shouldHandle(event: PluginEvent): boolean {
    return (
      event.type === EventType.TASK_MENTION_COMPLETED ||
      event.type === EventType.TASK_MENTION_UNCOMPLETED
    );
  }

  /**
   * Handle task mention state change events
   */
  async handle(event: PluginEvent): Promise<void> {
    try {
      const eventData = event.data as TaskMentionStateChangedEventData;

      switch (event.type) {
        case EventType.TASK_MENTION_COMPLETED:
        case EventType.TASK_MENTION_UNCOMPLETED:
          await this.syncTaskCompletionState(eventData);
          break;
      }
    } catch (error) {
      const eventData = event.data as TaskMentionStateChangedEventData;
      console.error(
        `TaskMentionSyncHandler: Error handling event for task ${eventData.taskPath}:`,
        error
      );
    }
  }

  /**
   * Sync task completion state based on task mention changes
   */
  private async syncTaskCompletionState(
    eventData: TaskMentionStateChangedEventData
  ): Promise<void> {
    try {
      // Get the task file
      const taskFile = this.app.vault.getAbstractFileByPath(eventData.taskPath);
      if (!(taskFile instanceof TFile)) {
        console.warn(
          `TaskMentionSyncHandler: Task file not found: ${eventData.taskPath}`
        );
        return;
      }

      // Get current task data
      const task = taskStore.findEntityByPath(eventData.taskPath);
      if (!task) {
        console.warn(
          `TaskMentionSyncHandler: Task not found in store: ${eventData.taskPath}`
        );
        return;
      }

      // Check if task completion state needs to be updated
      const shouldBeCompleted = eventData.newCompleted;
      const isCurrentlyCompleted = task.done === true;

      if (shouldBeCompleted === isCurrentlyCompleted) {
        // No change needed
        return;
      }

      // Update task completion state
      await this.updateTaskDoneStatus(taskFile, shouldBeCompleted);

      console.log(
        `TaskMentionSyncHandler: Updated task ${eventData.taskTitle} completion state to ${shouldBeCompleted}`
      );
    } catch (error) {
      console.error(
        `TaskMentionSyncHandler: Error syncing task completion state:`,
        error
      );
    }
  }

  /**
   * Update the Done status of a task file
   */
  private async updateTaskDoneStatus(
    taskFile: TFile,
    done: boolean
  ): Promise<void> {
    try {
      // Read current file content
      const content = await this.app.vault.read(taskFile);

      // Parse front matter
      const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
      const match = content.match(frontMatterRegex);

      if (!match) {
        console.warn(
          `TaskMentionSyncHandler: No front matter found in ${taskFile.path}`
        );
        return;
      }

      const frontMatterContent = match[1];
      const restOfContent = content.substring(match[0].length);

      // Update the Done field in front matter
      const doneRegex = /^Done:\s*(.*)$/m;
      let updatedFrontMatter: string;

      if (doneRegex.test(frontMatterContent)) {
        // Replace existing Done field
        updatedFrontMatter = frontMatterContent.replace(
          doneRegex,
          `Done: ${done}`
        );
      } else {
        // Add Done field
        updatedFrontMatter = frontMatterContent + `\nDone: ${done}`;
      }

      // Reconstruct the file content
      const updatedContent = `---\n${updatedFrontMatter}\n---${restOfContent}`;

      // Write back to file
      await this.app.vault.modify(taskFile, updatedContent);
    } catch (error) {
      console.error(
        `TaskMentionSyncHandler: Error updating task file ${taskFile.path}:`,
        error
      );
    }
  }

  /**
   * Get strategy for handling task mention conflicts
   * For now, we use a simple strategy: task mentions always win
   * In the future, this could be configurable
   */
  private getConflictResolutionStrategy():
    | "mention-wins"
    | "task-wins"
    | "ask-user" {
    return "mention-wins";
  }

  /**
   * Check if there are multiple mentions for the same task with different states
   */
  private async checkForConflictingMentions(
    taskPath: string
  ): Promise<boolean> {
    // This would check if there are multiple mentions for the same task
    // with different completion states, which could indicate a conflict
    // For now, we'll implement a simple version
    return false;
  }

  /**
   * Resolve conflicts when multiple mentions have different states
   */
  private async resolveConflictingMentions(
    taskPath: string,
    mentions: Array<{
      completed: boolean;
      filePath: string;
      lineNumber: number;
    }>
  ): Promise<boolean> {
    const strategy = this.getConflictResolutionStrategy();

    switch (strategy) {
      case "mention-wins":
        // Use the most recent mention state (last one in the array)
        return mentions[mentions.length - 1].completed;

      case "task-wins":
        // Keep the current task state (don't change)
        const task = taskStore.findEntityByPath(taskPath);
        return task?.done === true;

      case "ask-user":
        // For now, fall back to mention-wins
        // In the future, this could show a modal to the user
        return mentions[mentions.length - 1].completed;

      default:
        return mentions[mentions.length - 1].completed;
    }
  }
}
