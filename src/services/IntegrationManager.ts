/**
 * Integration Manager - Reactive service management system
 * Handles dynamic loading/unloading of integrations based on settings changes
 */

import { AbstractService } from "./AbstractService";
import { integrationRegistry } from "./IntegrationRegistry";
import { TaskImportManager } from "./TaskImportManager";
import { DailyNoteService } from "./DailyNoteService";
import { CacheManager } from "../cache/CacheManager";
import { settingsStore } from "../stores/settingsStore";
import type { TaskSyncSettings } from "../components/ui/settings/types";

export interface IntegrationService {
  id: string;
  name: string;
  icon: string;
  service: AbstractService | null;
  enabled: boolean;
}

export class IntegrationManager {
  private services = new Map<string, AbstractService>();
  private cacheManager: CacheManager;
  private taskImportManager: TaskImportManager;
  private dailyNoteService: DailyNoteService;
  private settings: TaskSyncSettings | null = null;
  private listeners: Array<(services: IntegrationService[]) => void> = [];
  private settingsUnsubscribe?: () => void;
  private lastEnabledStates: Map<string, boolean> = new Map();

  constructor(
    cacheManager: CacheManager,
    taskImportManager: TaskImportManager,
    dailyNoteService: DailyNoteService,
    settings: TaskSyncSettings
  ) {
    this.cacheManager = cacheManager;
    this.taskImportManager = taskImportManager;
    this.dailyNoteService = dailyNoteService;
    this.settings = settings;

    // Initialize tracking states
    for (const config of integrationRegistry.getAll()) {
      const isEnabled = config.isEnabled(this.settings);
      this.lastEnabledStates.set(config.key, isEnabled);
    }

    // Initialize integrations based on current settings
    this.updateIntegrations();

    // Subscribe to settings changes
    this.setupSettingsSubscription();
  }

  /**
   * Subscribe to settings changes and update integrations accordingly
   */
  private setupSettingsSubscription(): void {
    this.settingsUnsubscribe = settingsStore.subscribe(async (storeState) => {
      const oldSettings = this.settings;
      this.settings = storeState.settings;

      if (!this.settings) {
        return;
      }

      // Check if any integration settings have changed
      let hasChanges = false;

      for (const config of integrationRegistry.getAll()) {
        const lastEnabled = this.lastEnabledStates.get(config.key) ?? false;
        const newEnabled = config.isEnabled(this.settings);

        if (lastEnabled !== newEnabled) {
          hasChanges = true;
          // Update the tracked state
          this.lastEnabledStates.set(config.key, newEnabled);
        }

        // Check for other significant changes (like tokens, credentials, etc.)
        if (oldSettings) {
          const oldIntegrationSettings = this.getIntegrationSettings(
            oldSettings,
            config.key
          );
          const newIntegrationSettings = this.getIntegrationSettings(
            this.settings,
            config.key
          );

          if (
            JSON.stringify(oldIntegrationSettings) !==
            JSON.stringify(newIntegrationSettings)
          ) {
            hasChanges = true;
            break;
          }
        }
      }

      if (hasChanges || !oldSettings) {
        await this.updateIntegrations();
        this.notifyListeners();
      }
    });
  }

  /**
   * Helper to get integration settings by key
   */
  private getIntegrationSettings(settings: TaskSyncSettings, key: string): any {
    return (settings.integrations as any)[key];
  }

  /**
   * Update integrations based on current settings
   */
  public async updateIntegrations(): Promise<void> {
    for (const config of integrationRegistry.getAll()) {
      try {
        const isEnabled = config.isEnabled(this.settings);
        const existingService = this.services.get(config.key);

        if (isEnabled) {
          if (!existingService) {
            // Create new service instance
            const service = config.factory(this.settings);
            await service.initialize(this.cacheManager);
            service.setImportDependencies(this.taskImportManager);
            service.setDailyNoteService(this.dailyNoteService);

            // Setup settings subscription if the service supports it
            if (
              "setupSettingsSubscription" in service &&
              typeof service.setupSettingsSubscription === "function"
            ) {
              (service as any).setupSettingsSubscription();
            }

            this.services.set(config.key, service);
          } else {
            // Update existing service with new settings
            existingService.updateSettings(this.settings);
          }
        } else {
          if (existingService) {
            // Clean up service
            if (
              "dispose" in existingService &&
              typeof existingService.dispose === "function"
            ) {
              (existingService as any).dispose();
            }

            this.services.delete(config.key);
          }
        }
      } catch (error) {
        console.error(
          `🔧 IntegrationManager: Error processing ${config.name}:`,
          error
        );
      }
    }
  }

  /**
   * Get current available services
   */
  getAvailableServices(): IntegrationService[] {
    const services: IntegrationService[] = [
      // Local service is always available
      {
        id: "local",
        name: "Local Tasks",
        icon: "file-text",
        service: null,
        enabled: true,
      },
    ];

    // Add all enabled integration services
    for (const config of integrationRegistry.getAll()) {
      const service = this.services.get(config.key);
      if (service?.isEnabled()) {
        services.push({
          id: config.key,
          name: config.name,
          icon: config.icon,
          service: service,
          enabled: true,
        });
      }
    }

    return services;
  }

  /**
   * Get specific service by ID
   */
  getService(serviceId: string): AbstractService | null {
    return this.services.get(serviceId) || null;
  }

  /**
   * Subscribe to service changes
   */
  onServicesChanged(
    listener: (services: IntegrationService[]) => void
  ): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of service changes
   */
  private notifyListeners(): void {
    const services = this.getAvailableServices();
    this.listeners.forEach((listener) => listener(services));
  }

  /**
   * Get GitHub service (for backward compatibility)
   */
  getGitHubService(): any {
    return this.services.get("github") || null;
  }

  /**
   * Get Apple Reminders service (for backward compatibility)
   */
  getAppleRemindersService(): any {
    return this.services.get("apple-reminders") || null;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Dispose of all services to clean up their subscriptions
    for (const service of this.services.values()) {
      if ("dispose" in service && typeof service.dispose === "function") {
        (service as any).dispose();
      }
    }
    this.services.clear();

    // Clean up settings subscription
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = undefined;
    }

    // Clear listeners
    this.listeners = [];
  }
}
