/**
 * Open Tasks View Command
 * Activates the Tasks view (brings it to focus)
 */

import { Command, type CommandContext } from "../Command";
import { TASKS_VIEW_TYPE } from "../../views/TasksView";

export class OpenTasksViewCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "open-tasks-view";
  }

  getName(): string {
    return "Open Tasks view";
  }

  async execute(): Promise<void> {
    const existingLeaves = this.plugin.app.workspace.getLeavesOfType(TASKS_VIEW_TYPE);

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
        type: TASKS_VIEW_TYPE,
        active: true,
      });
    }
  }
}
