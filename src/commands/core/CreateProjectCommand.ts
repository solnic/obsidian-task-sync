/**
 * Create Project Command
 * Opens the project creation modal
 */

import { Command, type CommandContext } from "../Command";

export class CreateProjectCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "create-project";
  }

  getName(): string {
    return "Create Project";
  }

  execute(): void {
    this.taskSyncPlugin.modalService.openProjectCreateModal();
  }
}
