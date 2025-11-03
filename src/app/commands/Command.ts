/**
 * Abstract Command base class
 * Encapsulates command registration details and provides template for command implementations
 */

import { Plugin } from "obsidian";
import type { App } from "obsidian";
import type { TaskSyncSettings } from "../types/settings";

export interface CommandContext {
  plugin: Plugin; // For Obsidian API registration
  app: App;
  settings: TaskSyncSettings;
}

export abstract class Command {
  protected plugin: Plugin;
  protected app: App;
  protected settings: TaskSyncSettings;

  constructor(context: CommandContext) {
    this.plugin = context.plugin;
    this.app = context.app;
    this.settings = context.settings;
  }

  /**
   * Get the unique identifier for this command
   */
  abstract getId(): string;

  /**
   * Get the display name for this command
   */
  abstract getName(): string;

  /**
   * Execute the command logic
   */
  abstract execute(): Promise<void> | void;

  /**
   * Check if this command should be available
   * Override this method to add conditional logic
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Register this command with Obsidian
   */
  register(): void {
    if (!this.isAvailable()) {
      return;
    }

    this.plugin.addCommand({
      id: this.getId(),
      name: this.getName(),
      callback: () => this.execute(),
    });

    console.log(`🔧 Command registered: ${this.getId()}`);
  }

  /**
   * Update settings for this command
   */
  updateSettings(settings: TaskSyncSettings): void {
    this.settings = settings;
  }

  /**
   * Get the Obsidian app instance
   */
  getApp(): App {
    return this.app;
  }

  /**
   * Get the current settings
   */
  getSettings(): TaskSyncSettings {
    return this.settings;
  }
}
