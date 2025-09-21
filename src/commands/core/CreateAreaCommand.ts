/**
 * Create Area Command
 * Opens the area creation modal
 */

import { Command, type CommandContext } from "../Command";
import { AreaCreateModal } from "../../components/modals/AreaCreateModal";

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
    const modal = new AreaCreateModal(this.plugin.app, this.plugin as any);

    modal.onSubmit(async (areaData) => {
      await (this.plugin as any).createArea(areaData);

      if (this.settings.autoUpdateBaseViews) {
        await (this.plugin as any).refreshBaseViews();
      }
    });

    modal.open();
  }
}
