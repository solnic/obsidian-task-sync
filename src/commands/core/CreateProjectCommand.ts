/**
 * Create Project Command
 * Opens the project creation modal
 */

import { Command, type CommandContext } from "../Command";
import { CommandModal } from "../CommandModal";
import ProjectCreateModal from "../../components/svelte/ProjectCreateModal.svelte";

export interface ProjectCreateData {
  name: string;
  description?: string;
  areas?: string[];
}

class Modal extends CommandModal {
  constructor(command: CreateProjectCommand) {
    super(command);
  }

  onOpen(): void {
    this.titleEl.setText("Create New Project");
    this.modalEl.addClass("task-sync-create-project");
    this.modalEl.addClass("task-sync-modal");
    super.onOpen();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  protected createComponent(container: HTMLElement): any {
    return this.createSvelteComponent(ProjectCreateModal, container, {
      onsubmit: async (data: ProjectCreateData) => {
        await (this.command as CreateProjectCommand).handleSubmit(data);
        this.close();
      },
      oncancel: () => {
        this.close();
      },
    });
  }
}

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
    const modal = new Modal(this);
    modal.open();
  }

  async handleSubmit(projectData: ProjectCreateData): Promise<void> {
    await this.taskSyncPlugin.createProject(projectData);

    if (this.settings.autoUpdateBaseViews) {
      await this.taskSyncPlugin.refreshBaseViews();
    }
  }
}
