/**
 * Clear All Caches Command
 * Clears all plugin caches
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class ClearAllCachesCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "clear-all-caches";
  }

  getName(): string {
    return "Clear all caches";
  }

  async execute(): Promise<void> {
    const cacheManager = (this.plugin as any).cacheManager;
    await cacheManager.clearAllCaches();
    new Notice("All caches cleared");
  }
}
