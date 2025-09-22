/**
 * Integration Service Registry
 * Simple registry for integration services that allows the IntegrationManager
 * to work abstractly with any registered integration service
 */

import { AbstractService } from "./AbstractService";
import { GitHubService } from "./GitHubService";
import { AppleRemindersService } from "./AppleRemindersService";
import { AppleCalendarService } from "./AppleCalendarService";
import { TaskSyncSettings } from "../components/ui/settings/types";
import { CacheManager } from "../cache/CacheManager";
import { TaskImportManager } from "./TaskImportManager";
import { DailyNoteService } from "./DailyNoteService";

export interface IntegrationServiceConfig {
  /** Unique key for the integration (does not necessarily match settings.integrations key; mapping is handled via getSettingsPath) */
  key: string;
  /** Display name for the integration */
  name: string;
  /** Icon identifier for the integration */
  icon: string;
  /** Factory function to create the service instance */
  factory: (settings: TaskSyncSettings) => AbstractService;
  /** Function to check if integration is enabled in settings */
  isEnabled: (settings: TaskSyncSettings) => boolean;
  /** Function to get settings path for reactive subscriptions */
  getSettingsPath: () => string;
}

/**
 * Registry of all available integration services
 */
class IntegrationServiceRegistry {
  private services = new Map<string, IntegrationServiceConfig>();

  /**
   * Register an integration service
   */
  register(config: IntegrationServiceConfig): void {
    this.services.set(config.key, config);
  }

  /**
   * Get all registered integration services
   */
  getAll(): IntegrationServiceConfig[] {
    return Array.from(this.services.values());
  }

  /**
   * Get a specific integration service config by key
   */
  get(key: string): IntegrationServiceConfig | undefined {
    return this.services.get(key);
  }

  /**
   * Get all enabled integration services based on current settings
   */
  getEnabled(settings: TaskSyncSettings): IntegrationServiceConfig[] {
    return this.getAll().filter((config) => config.isEnabled(settings));
  }
}

// Create the global registry instance
export const integrationRegistry = new IntegrationServiceRegistry();

// Register all available integration services
integrationRegistry.register({
  key: "github",
  name: "GitHub",
  icon: "github",
  factory: (settings: TaskSyncSettings) => new GitHubService(settings),
  isEnabled: (settings: TaskSyncSettings) =>
    settings.integrations.github.enabled,
  getSettingsPath: () => "integrations.github",
});

integrationRegistry.register({
  key: "apple-reminders",
  name: "Apple Reminders",
  icon: "calendar-check",
  factory: (settings: TaskSyncSettings) => new AppleRemindersService(settings),
  isEnabled: (settings: TaskSyncSettings) =>
    settings.integrations.appleReminders.enabled,
  getSettingsPath: () => "integrations.appleReminders",
});

integrationRegistry.register({
  key: "apple-calendar",
  name: "Apple Calendar",
  icon: "calendar",
  factory: (settings: TaskSyncSettings) => new AppleCalendarService(settings),
  isEnabled: (settings: TaskSyncSettings) =>
    settings.integrations.appleCalendar.enabled,
  getSettingsPath: () => "integrations.appleCalendar",
});
