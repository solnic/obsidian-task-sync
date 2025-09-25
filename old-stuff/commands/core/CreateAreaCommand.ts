/**
 * Create Area Command
 * Opens the area creation modal
 */

import { Command, type CommandContext } from "../Command";
import { CommandModal } from "../CommandModal";
import AreaCreateModal from "../../components/svelte/AreaCreateModal.svelte";

export interface AreaCreateData {
  name: string;
  description?: string;
}

class Modal extends CommandModal {
  constructor(command: CreateAreaCommand) {
    super(command);
  }

  onOpen(): void {
    this.titleEl.setText("Create New Area");
    this.modalEl.addClass("task-sync-create-area");
    this.modalEl.addClass("task-sync-modal");
    super.onOpen();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  protected createComponent(container: HTMLElement): any {
    return this.createSvelteComponent(AreaCreateModal, container, {
      onsubmit: async (data: AreaCreateData) => {
        await (this.command as CreateAreaCommand).handleSubmit(data);
        this.close();
      },
      oncancel: () => {
        this.close();
      },
    });
  }
}

export class CreateAreaCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "create-area";
  }

  getName(): string {
    return "Create Area";
  }

  execute(): void {
    const modal = new Modal(this);
    modal.open();
  }

  async handleSubmit(areaData: AreaCreateData): Promise<void> {
    await this.taskSyncPlugin.createArea(areaData);

    if (this.settings.autoUpdateBaseViews) {
      await this.taskSyncPlugin.refreshBaseViews();
    }
  }
}
