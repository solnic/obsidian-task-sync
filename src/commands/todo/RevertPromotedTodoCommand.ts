/**
 * Revert Promoted Todo Command
 * Reverts a promoted todo back to its original state
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class RevertPromotedTodoCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "revert-promoted-todo";
  }

  getName(): string {
    return "Revert Promoted Todo";
  }

  async execute(): Promise<void> {
    try {
      const result = await (this.plugin as any).todoPromotionService.revertPromotedTodo();
      new Notice(result.message);
    } catch (error: any) {
      console.error("Failed to revert promoted todo:", error);
      new Notice(`Error reverting todo: ${error.message}`);
    }
  }
}
