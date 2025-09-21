/**
 * Start Daily Planning Command
 * Opens daily note and creates Daily Planning view above it
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";
import { DAILY_PLANNING_VIEW_TYPE } from "../../views/DailyPlanningView";

export class StartDailyPlanningCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "start-daily-planning";
  }

  getName(): string {
    return "Start daily planning";
  }

  async execute(): Promise<void> {
    try {
      // Ensure today's daily note exists
      const dailyNoteService = (this.plugin as any).dailyNoteService;
      const dailyNoteResult =
        await dailyNoteService.ensureTodayDailyNote();

      // Open the daily note if it's not already open
      if (dailyNoteResult.file) {
        await this.plugin.app.workspace.openLinkText(
          dailyNoteResult.file.path,
          "",
          false
        );
      }

      // Create or activate Daily Planning view above the daily note
      await this.activateDailyPlanningView();
    } catch (error: any) {
      console.error("Error starting daily planning:", error);
      new Notice(`Failed to start daily planning: ${error.message}`);
    }
  }

  /**
   * Activate the Daily Planning view (bring it to focus)
   */
  private async activateDailyPlanningView(): Promise<void> {
    const existingLeaves = this.plugin.app.workspace.getLeavesOfType(
      DAILY_PLANNING_VIEW_TYPE
    );

    if (existingLeaves.length > 0) {
      // Activate existing view
      this.plugin.app.workspace.revealLeaf(existingLeaves[0]);
    } else {
      // Create new view in main area (above daily note)
      const mainLeaf = this.plugin.app.workspace.getLeaf("tab");
      await mainLeaf.setViewState({
        type: DAILY_PLANNING_VIEW_TYPE,
        active: true,
      });
    }
  }
}
