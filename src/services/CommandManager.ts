/**
 * CommandManager - Manages plugin commands and their lifecycle
 * Handles dynamic registration/unregistration of commands based on settings changes
 */

import { Plugin, Command, Notice } from "obsidian";
import { settingsStore } from "../stores/settingsStore";
import type { TaskSyncSettings } from "../components/ui/settings/types";
import type { IntegrationManager } from "./IntegrationManager";

export interface CommandDefinition {
  id: string;
  name: string;
  callback: () => void | Promise<void>;
  condition?: () => boolean;
}

export interface CommandGroup {
  id: string;
  name: string;
  commands: CommandDefinition[];
  condition?: () => boolean;
}

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
  private callbacks: CommandCallbacks;
  private settings: TaskSyncSettings;
  private registeredCommands: Set<string> = new Set();
  private commandGroups: Map<string, CommandGroup> = new Map();
  private settingsUnsubscribe?: () => void;

  constructor(
    plugin: Plugin,
    integrationManager: IntegrationManager,
    callbacks: CommandCallbacks,
    settings: TaskSyncSettings
  ) {
    this.plugin = plugin;
    this.integrationManager = integrationManager;
    this.callbacks = callbacks;
    this.settings = { ...settings };

    this.setupCommandGroups();
    this.setupSettingsSubscription();
  }

  /**
   * Initialize command manager and register initial commands
   */
  public initialize(): void {
    this.registerAllCommands();
  }

  /**
   * Clean up command manager
   */
  public cleanup(): void {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
    }
    this.unregisterAllCommands();
  }

  /**
   * Setup command groups with their conditions
   */
  private setupCommandGroups(): void {
    // Core commands - always available
    this.commandGroups.set("core", {
      id: "core",
      name: "Core Commands",
      commands: [
        {
          id: "add-task",
          name: "Add Task",
          callback: () => this.callbacks.openTaskCreateModal(),
        },
        {
          id: "refresh",
          name: "Refresh",
          callback: async () => await this.callbacks.refresh(),
        },
        {
          id: "refresh-base-views",
          name: "Refresh Base Views",
          callback: async () => await this.callbacks.refreshBaseViews(),
        },
        {
          id: "create-area",
          name: "Create Area",
          callback: () => this.callbacks.openAreaCreateModal(),
        },
        {
          id: "create-project",
          name: "Create Project",
          callback: () => this.callbacks.openProjectCreateModal(),
        },
        {
          id: "promote-todo-to-task",
          name: "Promote Todo to Task",
          callback: async () => {
            const result = await this.callbacks.promoteTodoToTask();
            new Notice(result.message);
          },
        },
        {
          id: "revert-promoted-todo",
          name: "Revert Promoted Todo",
          callback: async () => {
            const result = await this.callbacks.revertPromotedTodo();
            new Notice(result.message);
          },
        },
        {
          id: "add-to-today",
          name: "Add to Today",
          callback: async () => await this.callbacks.addCurrentTaskToToday(),
        },
      ],
    });

    // Cache management commands
    this.commandGroups.set("cache", {
      id: "cache",
      name: "Cache Management",
      commands: [
        {
          id: "clear-all-caches",
          name: "Clear all caches",
          callback: async () => {
            await this.callbacks.clearAllCaches();
            new Notice("All caches cleared");
          },
        },
        {
          id: "show-cache-stats",
          name: "Show cache statistics",
          callback: async () => {
            const stats = await this.callbacks.getStats();
            const message = stats
              .map((s) => `${s.cacheKey}: ${s.keyCount} entries`)
              .join("\n");
            new Notice(`Cache statistics:\n${message}`);
          },
        },
      ],
    });

    // View commands
    this.commandGroups.set("views", {
      id: "views",
      name: "View Commands",
      commands: [
        {
          id: "open-tasks-view",
          name: "Open Tasks view",
          callback: async () => await this.callbacks.activateTasksView(),
        },
        {
          id: "open-context-tab",
          name: "Open Context Tab",
          callback: async () => await this.callbacks.activateContextTabView(),
        },
        {
          id: "open-task-planning",
          name: "Open Task Planning",
          callback: async () => await this.callbacks.activateTaskPlanningView(),
        },
        {
          id: "start-daily-planning",
          name: "Start daily planning",
          callback: async () => await this.callbacks.startDailyPlanning(),
        },
      ],
    });

    // GitHub commands - conditional on GitHub integration being enabled
    this.commandGroups.set("github", {
      id: "github",
      name: "GitHub Integration",
      condition: () => this.settings.githubIntegration.enabled,
      commands: [
        {
          id: "import-github-issue",
          name: "Import GitHub Issue",
          callback: async () => await this.callbacks.importGitHubIssue(),
        },
        {
          id: "import-all-github-issues",
          name: "Import All GitHub Issues",
          callback: async () => await this.callbacks.importAllGitHubIssues(),
        },
      ],
    });

    // Apple Reminders commands - conditional on platform and integration
    this.commandGroups.set("apple-reminders", {
      id: "apple-reminders",
      name: "Apple Reminders Integration",
      condition: () => {
        const service = this.integrationManager.getAppleRemindersService();
        return (
          service?.isPlatformSupported() &&
          this.settings.appleRemindersIntegration.enabled
        );
      },
      commands: [
        {
          id: "import-apple-reminders",
          name: "Import Apple Reminders",
          callback: async () => await this.callbacks.importAppleReminders(),
        },
        {
          id: "check-apple-reminders-permissions",
          name: "Check Apple Reminders Permissions",
          callback: async () =>
            await this.callbacks.checkAppleRemindersPermissions(),
        },
      ],
    });

    // Apple Calendar commands - conditional on platform
    this.commandGroups.set("apple-calendar", {
      id: "apple-calendar",
      name: "Apple Calendar Integration",
      condition: () => this.callbacks.isAppleCalendarPlatformSupported(),
      commands: [
        {
          id: "insert-calendar-events",
          name: "Insert Calendar Events",
          callback: async () => await this.callbacks.insertCalendarEvents(),
        },
        {
          id: "check-apple-calendar-permissions",
          name: "Check Apple Calendar Permissions",
          callback: async () =>
            await this.callbacks.checkAppleCalendarPermissions(),
        },
        {
          id: "schedule-task",
          name: "Schedule Task",
          condition: () =>
            this.settings.appleCalendarIntegration.schedulingEnabled,
          callback: async () => await this.callbacks.scheduleCurrentTask(),
        },
      ],
    });
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

      // Check if any integration settings changed
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
   * Register all commands based on current conditions
   */
  private registerAllCommands(): void {
    for (const group of this.commandGroups.values()) {
      if (!group.condition || group.condition()) {
        this.registerCommandGroup(group);
      }
    }
  }

  /**
   * Update commands based on current conditions
   */
  private updateCommands(): void {
    // Unregister all commands first
    this.unregisterAllCommands();

    // Re-register commands based on current conditions
    this.registerAllCommands();
  }

  /**
   * Register a command group
   */
  private registerCommandGroup(group: CommandGroup): void {
    for (const command of group.commands) {
      if (!command.condition || command.condition()) {
        this.registerCommand(command);
      }
    }
  }

  /**
   * Register a single command
   */
  private registerCommand(command: CommandDefinition): void {
    if (this.registeredCommands.has(command.id)) {
      return; // Already registered
    }

    this.plugin.addCommand({
      id: command.id,
      name: command.name,
      callback: command.callback,
    });

    this.registeredCommands.add(command.id);
    console.log(`🔧 CommandManager: Registered command: ${command.id}`);
  }

  /**
   * Unregister all commands
   */
  private unregisterAllCommands(): void {
    // Note: Obsidian doesn't provide a direct way to unregister commands
    // Commands are automatically cleaned up when the plugin is disabled/reloaded
    // We just clear our tracking set
    this.registeredCommands.clear();
  }
}
