/**
 * Open Task Planning Command
 * Activates the Task Planning view (brings it to focus)
 */

import { Command, type CommandContext } from "../Command";
import { TASK_PLANNING_VIEW_TYPE } from "../../views/TaskPlanningView";

export class OpenTaskPlanningCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "open-task-planning";
  }

  getName(): string {
    return "Open Task Planning";
  }

  async execute(): Promise<void> {
    const existingLeaves = this.plugin.app.workspace.getLeavesOfType(
      TASK_PLANNING_VIEW_TYPE
    );

    if (existingLeaves.length > 0) {
      // Ensure right sidebar is expanded
      this.plugin.app.workspace.rightSplit.expand();
      // Activate existing view
      this.plugin.app.workspace.revealLeaf(existingLeaves[0]);
    } else {
      // Ensure right sidebar is expanded
      this.plugin.app.workspace.rightSplit.expand();
      // Create new view in right sidebar
      const rightLeaf = this.plugin.app.workspace.getRightLeaf(false);
      await rightLeaf.setViewState({
        type: TASK_PLANNING_VIEW_TYPE,
        active: true,
      });
    }
  }
}
