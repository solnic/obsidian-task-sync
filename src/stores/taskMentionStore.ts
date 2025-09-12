/**
 * Task Mention Store - Manages task mentions with persistence
 * Handles CRUD operations for task mentions and provides reactive updates
 */

import { derived } from "svelte/store";
import { EntityStore } from "./EntityStore";
import { TaskMention } from "../types/entities";

class TaskMentionStore extends EntityStore<TaskMention> {
  constructor() {
    super("taskMentionStore");
  }

  // Derived stores for common queries
  public mentionsByFile = derived(this._store, ($store) => {
    const mentionsByFile = new Map<string, TaskMention[]>();

    $store.entities.forEach((mention) => {
      const filePath = mention.sourceFilePath;
      if (!mentionsByFile.has(filePath)) {
        mentionsByFile.set(filePath, []);
      }
      mentionsByFile.get(filePath)!.push(mention);
    });

    return mentionsByFile;
  });

  public mentionsByTask = derived(this._store, ($store) => {
    const mentionsByTask = new Map<string, TaskMention[]>();

    $store.entities.forEach((mention) => {
      const taskPath = mention.taskPath;
      if (!mentionsByTask.has(taskPath)) {
        mentionsByTask.set(taskPath, []);
      }
      mentionsByTask.get(taskPath)!.push(mention);
    });

    return mentionsByTask;
  });

  public completedMentions = derived(this._store, ($store) =>
    $store.entities.filter((mention) => mention.completed)
  );

  public incompleteMentions = derived(this._store, ($store) =>
    $store.entities.filter((mention) => !mention.completed)
  );

  /**
   * Find mentions for a specific file
   */
  getMentionsForFile(filePath: string): TaskMention[] {
    const state = this.getEntities();
    return state.filter((mention) => mention.sourceFilePath === filePath);
  }

  /**
   * Find mentions for a specific task
   */
  getMentionsForTask(taskPath: string): TaskMention[] {
    const state = this.getEntities();
    return state.filter((mention) => mention.taskPath === taskPath);
  }

  /**
   * Find a specific mention by file path and line number
   */
  getMentionByLocation(
    filePath: string,
    lineNumber: number
  ): TaskMention | null {
    const state = this.getEntities();
    return (
      state.find(
        (mention) =>
          mention.sourceFilePath === filePath &&
          mention.lineNumber === lineNumber
      ) || null
    );
  }

  /**
   * Update mention completion state
   */
  async updateMentionCompletion(
    filePath: string,
    lineNumber: number,
    completed: boolean
  ): Promise<void> {
    const mention = this.getMentionByLocation(filePath, lineNumber);
    if (mention) {
      mention.completed = completed;
      mention.lastSynced = new Date();
      await this.upsertEntity(mention); // Use upsertEntity which handles updates
    }
  }

  /**
   * Remove all mentions for a file (when file is deleted)
   */
  async removeMentionsForFile(filePath: string): Promise<void> {
    const mentions = this.getMentionsForFile(filePath);
    for (const mention of mentions) {
      await this.removeEntity(mention.filePath || mention.id);
    }
  }

  /**
   * Remove all mentions for a task (when task is deleted)
   */
  async removeMentionsForTask(taskPath: string): Promise<void> {
    const mentions = this.getMentionsForTask(taskPath);
    for (const mention of mentions) {
      await this.removeEntity(mention.filePath || mention.id);
    }
  }

  /**
   * Refresh all task mentions from the file system (alias for base class method)
   */
  async refreshMentions() {
    await this.refreshEntities();
  }
}

// Export singleton instance
export const taskMentionStore = new TaskMentionStore();
