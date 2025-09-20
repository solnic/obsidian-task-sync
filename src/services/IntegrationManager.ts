/**
 * Integration Manager - Reactive service management system
 * Handles dynamic loading/unloading of integrations based on settings changes
 */

import { GitHubService } from "./GitHubService";
import { AppleRemindersService } from "./AppleRemindersService";
import { TaskImportManager } from "./TaskImportManager";
import { DailyNoteService } from "./DailyNoteService";
import { CacheManager } from "../cache/CacheManager";
import { settingsStore } from "../stores/settingsStore";
import type { TaskSyncSettings } from "../components/ui/settings/types";
import { debugLog } from "../utils/debug";

export interface IntegrationService {
  id: string;
  name: string;
  icon: string;
  service: GitHubService | AppleRemindersService | null;
  enabled: boolean;
}

export class IntegrationManager {
  private githubService: GitHubService | null = null;
  private appleRemindersService: AppleRemindersService | null = null;
  private cacheManager: CacheManager;
  private taskImportManager: TaskImportManager;
  private dailyNoteService: DailyNoteService;
  private settings: TaskSyncSettings | null = null;
  private listeners: Array<(services: IntegrationService[]) => void> = [];

  constructor(
    cacheManager: CacheManager,
    taskImportManager: TaskImportManager,
    dailyNoteService: DailyNoteService,
    settings: TaskSyncSettings
  ) {
    this.cacheManager = cacheManager;
    this.taskImportManager = taskImportManager;
    this.dailyNoteService = dailyNoteService;
    this.settings = { ...settings };

    debugLog("🔧 IntegrationManager: Initializing with settings", {
      githubEnabled: this.settings.githubIntegration.enabled,
    });

    // Initialize integrations based on current settings
    this.updateIntegrations();

    // Subscribe to settings changes
    this.setupSettingsSubscription();
  }

  /**
   * Subscribe to settings changes and update integrations accordingly
   */
  private setupSettingsSubscription(): void {
    settingsStore.subscribe(async (storeState) => {
      const oldSettings = this.settings;
      this.settings = storeState.settings;

      // Check if integration settings have changed
      const githubChanged =
        !oldSettings ||
        oldSettings.githubIntegration.enabled !==
          this.settings.githubIntegration.enabled ||
        oldSettings.githubIntegration.personalAccessToken !==
          this.settings.githubIntegration.personalAccessToken;

      debugLog("GitHub changed:", githubChanged);

      const appleRemindersChanged =
        !oldSettings ||
        oldSettings.appleRemindersIntegration.enabled !==
          this.settings.appleRemindersIntegration.enabled;

      if (githubChanged || appleRemindersChanged) {
        await this.updateIntegrations();
        this.notifyListeners();
      } else if (
        this.settings.githubIntegration.enabled &&
        !this.githubService
      ) {
        // Force update if GitHub is enabled but service doesn't exist
        debugLog(
          "🔧 IntegrationManager: Force updating integrations - GitHub enabled but no service"
        );
        await this.updateIntegrations();
        this.notifyListeners();
      }
    });
  }

  /**
   * Update integrations based on current settings
   */
  public async updateIntegrations(): Promise<void> {
    // Handle GitHub integration
    if (this.settings.githubIntegration.enabled) {
      if (!this.githubService) {
        console.log("🔧 IntegrationManager: Initializing GitHub service");
        this.githubService = new GitHubService(this.settings);
        await this.githubService.initialize(this.cacheManager);
        this.githubService.setImportDependencies(this.taskImportManager);
        this.githubService.setDailyNoteService(this.dailyNoteService);
      } else {
        // Update existing service with new settings
        this.githubService.updateSettings(this.settings);
      }
    } else {
      if (this.githubService) {
        console.log("🔧 IntegrationManager: Disabling GitHub service");
        // Clean up GitHub service
        this.githubService = null;
      }
    }

    // Handle Apple Reminders integration
    if (this.settings.appleRemindersIntegration.enabled) {
      if (!this.appleRemindersService) {
        console.log(
          "🔧 IntegrationManager: Initializing Apple Reminders service"
        );
        this.appleRemindersService = new AppleRemindersService(this.settings);
        await this.appleRemindersService.initialize(this.cacheManager);
        this.appleRemindersService.setImportDependencies(
          this.taskImportManager
        );
        this.appleRemindersService.setDailyNoteService(this.dailyNoteService);
      } else {
        // Update existing service with new settings
        this.appleRemindersService.updateSettings(this.settings);
      }
    } else {
      if (this.appleRemindersService) {
        console.log("🔧 IntegrationManager: Disabling Apple Reminders service");
        // Clean up Apple Reminders service
        this.appleRemindersService = null;
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

    // Add GitHub service if enabled
    if (this.githubService?.isEnabled()) {
      services.push({
        id: "github",
        name: "GitHub",
        icon: "github",
        service: this.githubService,
        enabled: true,
      });
    }

    // Add Apple Reminders service if enabled
    if (this.appleRemindersService?.isEnabled()) {
      services.push({
        id: "apple-reminders",
        name: "Apple Reminders",
        icon: "calendar-check",
        service: this.appleRemindersService,
        enabled: true,
      });
    }

    return services;
  }

  /**
   * Get specific service by ID
   */
  getService(serviceId: string): GitHubService | AppleRemindersService | null {
    switch (serviceId) {
      case "github":
        return this.githubService;
      case "apple-reminders":
        return this.appleRemindersService;
      default:
        return null;
    }
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
  getGitHubService(): GitHubService | null {
    return this.githubService;
  }

  /**
   * Get Apple Reminders service (for backward compatibility)
   */
  getAppleRemindersService(): AppleRemindersService | null {
    return this.appleRemindersService;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.listeners = [];
    this.githubService = null;
    this.appleRemindersService = null;
  }
}
