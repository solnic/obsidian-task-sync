/**
 * CommandManager - Manages plugin commands and their lifecycle
 * Handles dynamic registration/unregistration of commands based on settings changes
 */

import { Plugin, Notice } from "obsidian";
import { settingsStore } from "../stores/settingsStore";
import type { TaskSyncSettings } from "../components/ui/settings/types";
import type { IntegrationManager } from "./IntegrationManager";
import { CommandRegistry } from "../commands/CommandRegistry";
import type { Command } from "../commands/Command";
import type { TaskSyncPluginInterface } from "../interfaces/TaskSyncPluginInterface";

export class CommandManager {
  private plugin: Plugin;
  private taskSyncPlugin: TaskSyncPluginInterface;
  private integrationManager: IntegrationManager;
  private settings: TaskSyncSettings;
  private commandRegistry: CommandRegistry;
  private registeredCommands: Set<string> = new Set();
  private settingsUnsubscribe?: () => void;

  constructor(
    taskSyncPlugin: TaskSyncPluginInterface,
    integrationManager: IntegrationManager,
    settings: TaskSyncSettings
  ) {
    this.plugin = taskSyncPlugin as unknown as Plugin; // Type assertion for Obsidian API access
    this.taskSyncPlugin = taskSyncPlugin;
    this.integrationManager = integrationManager;
    this.settings = { ...settings };

    // Initialize command registry with context
    this.commandRegistry = new CommandRegistry({
      plugin: this.plugin,
      taskSyncPlugin: this.taskSyncPlugin,
      integrationManager: this.integrationManager,
      settings: this.settings,
    });

    this.setupSettingsSubscription();
  }

  /**
   * Initialize command manager and register initial commands
   */
  public initialize(): void {
    this.commandRegistry.registerAll();
  }

  /**
   * Clean up command manager
   */
  public cleanup(): void {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
    }
    this.registeredCommands.clear();
  }

  /**
   * Setup settings subscription to react to changes
   */
  private setupSettingsSubscription(): void {
    this.settingsUnsubscribe = settingsStore.subscribe((storeState) => {
      if (!storeState.settings) {
        return; // Settings not loaded yet
      }

      const oldSettings = this.settings;
      this.settings = { ...storeState.settings };

      // Update command registry with new settings
      this.commandRegistry.updateSettings(this.settings);

      // Check if any integration settings changed that would affect command availability
      const integrationChanged =
        oldSettings.integrations.github.enabled !==
          storeState.settings.integrations.github.enabled ||
        oldSettings.integrations.appleReminders.enabled !==
          storeState.settings.integrations.appleReminders.enabled ||
        oldSettings.integrations.appleCalendar.schedulingEnabled !==
          storeState.settings.integrations.appleCalendar.schedulingEnabled;

      if (integrationChanged) {
        console.log(
          "🔧 CommandManager: Integration settings changed, updating commands"
        );
        this.updateCommands();
      }
    });
  }

  /**
   * Update commands based on current conditions
   */
  private updateCommands(): void {
    // Clear registered commands tracking
    this.registeredCommands.clear();

    // Re-register commands based on current conditions
    this.commandRegistry.registerAll();
  }
}
