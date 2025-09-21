/**
 * Add Task Command
 * Opens the task creation modal
 */

import { Command, type CommandContext } from "../Command";
import { TaskCreateModalWrapper } from "../../components/svelte/TaskCreateModalWrapper";
import type { FileContext } from "../../main";

export class AddTaskCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "add-task";
  }

  getName(): string {
    return "Add Task";
  }

  async execute(): Promise<void> {
    const context = this.detectCurrentFileContext();

    const modal = new TaskCreateModalWrapper(
      this.plugin as any, // Cast to TaskSyncPlugin
      context,
      {},
      async (taskData) => {
        await (this.plugin as any).createTask(taskData);

        if (this.settings.autoUpdateBaseViews) {
          await (this.plugin as any).refreshBaseViews();
        }
      }
    );

    modal.open();
  }

  private detectCurrentFileContext(): FileContext {
    const activeFile = this.plugin.app.workspace.getActiveFile();

    if (!activeFile) {
      return { type: "none" };
    }

    const filePath = activeFile.path;
    const fileName = activeFile.name;

    // Check if file is a daily note (format: YYYY-MM-DD anywhere in path or name)
    const dailyNotePattern = /\b\d{4}-\d{2}-\d{2}\b/;
    if (dailyNotePattern.test(filePath) || dailyNotePattern.test(fileName)) {
      return {
        type: "daily",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in projects folder
    if (filePath.startsWith(this.settings.projectsFolder + "/")) {
      return {
        type: "project",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in areas folder
    if (filePath.startsWith(this.settings.areasFolder + "/")) {
      return {
        type: "area",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in tasks folder
    if (filePath.startsWith(this.settings.tasksFolder + "/")) {
      return {
        type: "task",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    return { type: "none" };
  }
}
