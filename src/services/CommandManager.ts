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

// Legacy interface for backward compatibility - will be removed
export interface CommandCallbacks {
  openTaskCreateModal: () => void;
  openAreaCreateModal: () => void;
  openProjectCreateModal: () => void;
  refresh: () => Promise<void>;
  refreshBaseViews: () => Promise<void>;
  promoteTodoToTask: () => Promise<{ message: string }>;
  revertPromotedTodo: () => Promise<{ message: string }>;
  addCurrentTaskToToday: () => Promise<void>;
  activateTasksView: () => Promise<void>;
  activateContextTabView: () => Promise<void>;
  activateTaskPlanningView: () => Promise<void>;
  startDailyPlanning: () => Promise<void>;
  importGitHubIssue: () => Promise<void>;
  importAllGitHubIssues: () => Promise<void>;
  importAppleReminders: () => Promise<void>;
  checkAppleRemindersPermissions: () => Promise<void>;
  insertCalendarEvents: () => Promise<void>;
  checkAppleCalendarPermissions: () => Promise<void>;
  scheduleCurrentTask: () => Promise<void>;
  clearAllCaches: () => Promise<void>;
  getStats: () => Promise<Array<{ cacheKey: string; keyCount: number }>>;
  isAppleCalendarPlatformSupported: () => boolean;
}

export class CommandManager {
  private plugin: Plugin;
  private integrationManager: IntegrationManager;
  private settings: TaskSyncSettings;
  private commandRegistry: CommandRegistry;
  private registeredCommands: Set<string> = new Set();
  private settingsUnsubscribe?: () => void;

  constructor(
    plugin: Plugin,
    integrationManager: IntegrationManager,
    callbacks: CommandCallbacks, // Legacy parameter - ignored
    settings: TaskSyncSettings
  ) {
    this.plugin = plugin;
    this.integrationManager = integrationManager;
    this.settings = { ...settings };

    // Initialize command registry with context
    this.commandRegistry = new CommandRegistry({
      plugin: this.plugin,
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
        oldSettings.githubIntegration.enabled !==
          storeState.settings.githubIntegration.enabled ||
        oldSettings.appleRemindersIntegration.enabled !==
          storeState.settings.appleRemindersIntegration.enabled ||
        oldSettings.appleCalendarIntegration.schedulingEnabled !==
          storeState.settings.appleCalendarIntegration.schedulingEnabled;

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
