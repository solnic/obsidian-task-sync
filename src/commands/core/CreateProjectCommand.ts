/**
 * Create Project Command
 * Opens the project creation modal
 */

import { Command, type CommandContext } from "../Command";
import { ProjectCreateModal } from "../../components/modals/ProjectCreateModal";

export class CreateProjectCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "create-project";
  }

  getName(): string {
    return "Create Project";
  }

  execute(): void {
    const modal = new ProjectCreateModal(this.plugin.app, this.plugin as any);

    modal.onSubmit(async (projectData) => {
      await (this.plugin as any).createProject(projectData);

      if (this.settings.autoUpdateBaseViews) {
        await (this.plugin as any).refreshBaseViews();
      }
    });

    modal.open();
  }
}
