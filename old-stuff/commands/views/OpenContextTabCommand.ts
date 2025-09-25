/**
 * Open Context Tab Command
 * Activates the Context Tab view (brings it to focus)
 */

import { Command, type CommandContext } from "../Command";
import { CONTEXT_TAB_VIEW_TYPE } from "../../views/ContextTabView";

export class OpenContextTabCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "open-context-tab";
  }

  getName(): string {
    return "Open Context Tab";
  }

  async execute(): Promise<void> {
    const existingLeaves = this.plugin.app.workspace.getLeavesOfType(
      CONTEXT_TAB_VIEW_TYPE
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
        type: CONTEXT_TAB_VIEW_TYPE,
        active: true,
      });
    }
  }
}
