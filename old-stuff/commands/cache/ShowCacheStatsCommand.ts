/**
 * Show Cache Stats Command
 * Shows cache statistics
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class ShowCacheStatsCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "show-cache-stats";
  }

  getName(): string {
    return "Show cache statistics";
  }

  async execute(): Promise<void> {
    const cacheManager = (this.plugin as any).cacheManager;
    const stats = await cacheManager.getStats();
    const message = stats
      .map((s: any) => `${s.cacheKey}: ${s.keyCount} entries`)
      .join("\n");
    new Notice(`Cache statistics:\n${message}`);
  }
}
