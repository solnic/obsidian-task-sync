/**
 * Abstract Command base class
 * Encapsulates command registration details and provides template for command implementations
 */

import { Plugin } from "obsidian";
import type { TaskSyncSettings } from "../components/ui/settings/types";
import type { IntegrationManager } from "../services/IntegrationManager";
import type { TaskSyncPluginInterface } from "../interfaces/TaskSyncPluginInterface";

export interface CommandContext {
  plugin: Plugin; // Still needed for addCommand registration
  taskSyncPlugin: TaskSyncPluginInterface; // Clean interface for command logic
  integrationManager: IntegrationManager;
  settings: TaskSyncSettings;
}

export abstract class Command {
  protected plugin: Plugin; // For Obsidian API registration only
  protected taskSyncPlugin: TaskSyncPluginInterface; // For command logic
  protected integrationManager: IntegrationManager;
  protected settings: TaskSyncSettings;

  constructor(context: CommandContext) {
    this.plugin = context.plugin;
    this.taskSyncPlugin = context.taskSyncPlugin;
    this.integrationManager = context.integrationManager;
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
  getApp() {
    return this.plugin.app;
  }

  /**
   * Get the TaskSync plugin interface
   */
  getTaskSyncPlugin() {
    return this.taskSyncPlugin;
  }

  /**
   * Get the current settings
   */
  getSettings() {
    return this.settings;
  }
}
