/**
 * Add to Today Command
 * Adds current task to today's daily note
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class AddToTodayCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "add-to-today";
  }

  getName(): string {
    return "Add to Today";
  }

  async execute(): Promise<void> {
    try {
      // Get the currently active file
      const activeFile = this.plugin.app.workspace.getActiveFile();

      if (!activeFile) {
        new Notice("No file is currently open");
        return;
      }

      // Check if the current file is a task
      const frontMatter =
        this.plugin.app.metadataCache.getFileCache(activeFile)?.frontmatter;
      if (!frontMatter || frontMatter.Type !== "Task") {
        new Notice("Current file is not a task");
        return;
      }

      // Add the task to today's daily note
      const result = await (this.plugin as any).dailyNoteService.addTaskToToday(
        activeFile.path
      );

      if (result.success) {
        new Notice(`✅ Task added to today's daily note`);
      } else {
        new Notice(`❌ Failed to add task to today: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Error adding task to today:", error);
      new Notice(`Error adding task to today: ${error.message}`);
    }
  }
}
