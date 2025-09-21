/**
 * Add Task Command
 * Opens the task creation modal
 */

import { Command, type CommandContext } from "../Command";

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
    const context =
      this.taskSyncPlugin.contextService.detectCurrentFileContext();
    await this.taskSyncPlugin.modalService.openTaskCreateModal(context);
  }
}
