/**
 * Refresh Base Views Command
 * Refreshes base views (same as regenerate for now)
 */

import { Command, type CommandContext } from "../Command";

export class RefreshBaseViewsCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "refresh-base-views";
  }

  getName(): string {
    return "Refresh Base Views";
  }

  async execute(): Promise<void> {
    await (this.plugin as any).refreshBaseViews();
  }
}
