/**
 * CommandModal - Abstract base class for command modals
 * Provides common functionality for modals opened by commands
 */

import { SvelteModal } from "../components/svelte/SvelteModal";
import type { Command } from "./Command";

export abstract class CommandModal extends SvelteModal {
  protected command: Command;

  constructor(command: Command) {
    super(command.getTaskSyncPlugin() as any);
    this.command = command;
  }

  protected getApp() {
    return this.command.getApp();
  }

  protected getTaskSyncPlugin() {
    return this.command.getTaskSyncPlugin();
  }

  protected getSettings() {
    return this.command.getSettings();
  }
}
