/**
 * Create Area Command
 * Opens the area creation modal
 */

import { Command, type CommandContext } from "../Command";

export class CreateAreaCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "create-area";
  }

  getName(): string {
    return "Create Area";
  }

  execute(): void {
    this.taskSyncPlugin.modalService.openAreaCreateModal();
  }
}
