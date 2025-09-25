/**
 * Refresh Command
 * Performs comprehensive refresh operation - updates file properties and regenerates bases
 */

import { Command, type CommandContext } from "../Command";

export class RefreshCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "refresh";
  }

  getName(): string {
    return "Refresh";
  }

  async execute(): Promise<void> {
    await (this.plugin as any).refresh();
  }
}
