/**
 * Promote Todo to Task Command
 * Promotes a todo item to a full task
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class PromoteTodoToTaskCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "promote-todo-to-task";
  }

  getName(): string {
    return "Promote Todo to Task";
  }

  async execute(): Promise<void> {
    try {
      const result = await (this.plugin as any).todoPromotionService.promoteTodoToTask();
      new Notice(result.message);
    } catch (error: any) {
      console.error("Failed to promote todo to task:", error);
      new Notice(`Error promoting todo: ${error.message}`);
    }
  }
}
