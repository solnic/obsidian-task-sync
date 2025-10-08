/**
 * TaskSync App Bootstrap Class
 * Initializes the new entities system with Host abstraction
 */

import { ObsidianExtension } from "./extensions/ObsidianExtension";
import { GitHubExtension } from "./extensions/GitHubExtension";
import { CalendarExtension } from "./extensions/CalendarExtension";
import { DailyPlanningExtension } from "./extensions/DailyPlanningExtension";
import { ContextExtension } from "./extensions/ContextExtension";
import { AppleCalendarService } from "./services/AppleCalendarService";
import { Host } from "./core/host";
import type { TaskSyncSettings } from "./types/settings";
import { taskStore } from "./stores/taskStore";
import { projectStore } from "./stores/projectStore";
import { areaStore } from "./stores/areaStore";

export class TaskSyncApp {
  private initialized = false;
  public obsidianExtension?: ObsidianExtension;
  public githubExtension?: GitHubExtension;
  public calendarExtension?: CalendarExtension;
  public dailyPlanningExtension?: DailyPlanningExtension;
  public contextExtension?: ContextExtension;
  private host?: Host;
  private settings: TaskSyncSettings | null = null;

  async initialize(host: Host): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("TaskSync app initializing with Host...");

      this.host = host;

      // Load settings from host
      this.settings = await host.loadSettings();

      // Load persisted entity data from host storage
      await this.loadPersistedData(host);

      console.log("TaskSync app initializing...", {
        hasHost: !!host,
        hasSettings: !!this.settings,
      });

      // Initialize Obsidian extension - we still need the raw Obsidian objects for the extension
      // The Host abstraction is for the app-level concerns, Extensions still need Obsidian APIs
      // TODO: This will need to be refactored when we make the app truly host-agnostic
      const obsidianHost = host as any; // Cast to access underlying plugin
      if (obsidianHost.plugin && obsidianHost.plugin.app) {
        // Pass the plugin's TypeNote instance to share the same registry
        // This ensures Task note type is visible in settings UI
        this.obsidianExtension = new ObsidianExtension(
          obsidianHost.plugin.app,
          obsidianHost.plugin,
          this.settings,
          obsidianHost.plugin.typeNote // Share TypeNote instance with plugin
        );

        await this.obsidianExtension.initialize();
      }

      // Initialize GitHub extension if enabled
      await this.initializeGitHubExtension();

      // Initialize Calendar extension if enabled
      await this.initializeCalendarExtension();

      // Initialize Context extension
      await this.initializeContextExtension();

      // Initialize Daily Planning extension
      await this.initializeDailyPlanningExtension();

      this.initialized = true;
      console.log("TaskSync app initialized successfully");
    } catch (error) {
      console.error("Failed to initialize TaskSync app:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.initialized) {
      throw new Error("TaskSync app must be initialized before loading");
    }

    try {
      console.log("Loading TaskSync app extensions...");

      // Load extensions after Obsidian layout is ready
      if (this.obsidianExtension) {
        await this.obsidianExtension.load();
      }

      if (this.githubExtension) {
        await this.githubExtension.load();
      }

      if (this.calendarExtension) {
        await this.calendarExtension.load();
      }

      if (this.contextExtension) {
        await this.contextExtension.load();
      }

      if (this.dailyPlanningExtension) {
        await this.dailyPlanningExtension.load();
      }

      console.log("TaskSync app extensions loaded successfully");
    } catch (error) {
      console.error("Failed to load TaskSync app extensions:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    console.log("TaskSync app shutting down...");

    if (this.obsidianExtension) {
      await this.obsidianExtension.shutdown();
    }

    if (this.githubExtension) {
      await this.githubExtension.shutdown();
    }

    if (this.dailyPlanningExtension) {
      await this.dailyPlanningExtension.shutdown();
    }

    this.initialized = false;
    console.log("TaskSync app shutdown complete");
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Sync project bases - create individual bases for projects
   * Public method that can be called when settings change or manually triggered
   */
  async syncProjectBases(): Promise<void> {
    if (!this.obsidianExtension) {
      throw new Error("ObsidianExtension not initialized");
    }
    await this.obsidianExtension.syncProjectBases();
  }

  /**
   * Get extension by ID for testing and external access
   */
  getExtensionById(id: string): any {
    switch (id) {
      case "obsidian":
        return this.obsidianExtension;
      case "github":
        return this.githubExtension;
      case "calendar":
        return this.calendarExtension;
      case "daily-planning":
        return this.dailyPlanningExtension;
      default:
        return null;
    }
  }

  /**
   * Update settings and reactively initialize/shutdown extensions
   */
  async updateSettings(newSettings: TaskSyncSettings): Promise<void> {
    if (!this.initialized || !this.host) {
      throw new Error(
        "TaskSync app must be initialized before updating settings"
      );
    }

    const oldSettings = this.settings;
    this.settings = newSettings;

    // Update base manager settings in ObsidianExtension
    if (this.obsidianExtension) {
      this.obsidianExtension.updateBaseManagerSettings(newSettings);
    }

    // Check if GitHub integration was enabled/disabled
    const wasGitHubEnabled = oldSettings?.integrations?.github?.enabled;
    const isGitHubEnabled = newSettings.integrations?.github?.enabled;

    if (!wasGitHubEnabled && isGitHubEnabled) {
      // GitHub was just enabled - initialize it
      console.log("GitHub integration enabled, initializing...");
      await this.initializeGitHubExtension();
    } else if (wasGitHubEnabled && !isGitHubEnabled) {
      // GitHub was just disabled - shutdown
      console.log("GitHub integration disabled, shutting down...");
      if (this.githubExtension) {
        await this.githubExtension.shutdown();
        this.githubExtension = undefined;
      }
    }
  }

  /**
   * Load persisted entity data from host storage and populate stores
   */
  private async loadPersistedData(host: Host): Promise<void> {
    try {
      const data = await host.loadData();

      if (!data) {
        console.log("No persisted data found, starting with empty stores");
        return;
      }

      // Load tasks into store
      if (data.tasks && Array.isArray(data.tasks)) {
        console.log(`Loading ${data.tasks.length} persisted tasks`);
        for (const task of data.tasks) {
          // Convert date strings back to Date objects
          const taskWithDates = {
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
            doDate: task.doDate ? new Date(task.doDate) : undefined,
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          };
          taskStore.addTask(taskWithDates);
        }
      }

      // Load projects into store
      if (data.projects && Array.isArray(data.projects)) {
        console.log(`Loading ${data.projects.length} persisted projects`);
        for (const project of data.projects) {
          const projectWithDates = {
            ...project,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
          };
          projectStore.addProject(projectWithDates);
        }
      }

      // Load areas into store
      if (data.areas && Array.isArray(data.areas)) {
        console.log(`Loading ${data.areas.length} persisted areas`);
        for (const area of data.areas) {
          const areaWithDates = {
            ...area,
            createdAt: new Date(area.createdAt),
            updatedAt: new Date(area.updatedAt),
          };
          areaStore.addArea(areaWithDates);
        }
      }

      console.log("Persisted data loaded successfully");
    } catch (error) {
      console.error("Failed to load persisted data:", error);
      // Don't throw - allow app to continue with empty stores
    }
  }

  /**
   * Initialize GitHub extension if enabled in settings
   */
  private async initializeGitHubExtension(): Promise<void> {
    if (!this.settings?.integrations?.github?.enabled) {
      return;
    }

    const obsidianHost = this.host as any;
    if (!obsidianHost.plugin) {
      return;
    }

    // Don't reinitialize if already initialized
    if (this.githubExtension) {
      console.log("GitHub extension already initialized");
      return;
    }

    console.log("Initializing GitHub extension...");
    this.githubExtension = new GitHubExtension(
      this.settings,
      obsidianHost.plugin
    );

    await this.githubExtension.initialize();

    // If app is already loaded, load the extension too
    if (this.initialized) {
      await this.githubExtension.load();
    }

    console.log("GitHub extension initialized successfully");
  }

  /**
   * Initialize Calendar extension if enabled in settings
   */
  private async initializeCalendarExtension(): Promise<void> {
    if (!this.settings?.integrations?.appleCalendar?.enabled) {
      return;
    }

    const obsidianHost = this.host as any;
    if (!obsidianHost.plugin) {
      return;
    }

    // Don't reinitialize if already initialized
    if (this.calendarExtension) {
      console.log("Calendar extension already initialized");
      return;
    }

    console.log("Initializing Calendar extension...");
    this.calendarExtension = new CalendarExtension(
      this.settings,
      obsidianHost.plugin
    );

    await this.calendarExtension.initialize();

    // Create and register Apple Calendar service
    const appleCalendarService = new AppleCalendarService(
      this.settings,
      obsidianHost.plugin
    );

    await appleCalendarService.initialize();
    this.calendarExtension.registerCalendarService(appleCalendarService);

    // If app is already loaded, load the extension too
    if (this.initialized) {
      await this.calendarExtension.load();
    }

    console.log("Calendar extension initialized successfully");
  }

  /**
   * Initialize Daily Planning extension
   */
  private async initializeDailyPlanningExtension(): Promise<void> {
    const obsidianHost = this.host as any;
    if (!obsidianHost.plugin || !this.settings) {
      return;
    }

    console.log("Initializing Daily Planning extension...");
    this.dailyPlanningExtension = new DailyPlanningExtension(
      this.settings,
      obsidianHost
    );

    await this.dailyPlanningExtension.initialize();

    // If app is already loaded, load the extension too
    if (this.initialized) {
      await this.dailyPlanningExtension.load();
    }

    console.log("Daily Planning extension initialized successfully");
  }

  /**
   * Initialize Context extension
   */
  private async initializeContextExtension(): Promise<void> {
    if (!this.host || !this.settings) {
      return;
    }

    console.log("Initializing Context extension...");
    this.contextExtension = new ContextExtension(
      (this.host as any).plugin.app,
      this.host,
      this.settings
    );

    await this.contextExtension.initialize();

    // If app is already loaded, load the extension too
    if (this.initialized) {
      await this.contextExtension.load();
    }

    console.log("Context extension initialized successfully");
  }
}

export const taskSyncApp = new TaskSyncApp();
