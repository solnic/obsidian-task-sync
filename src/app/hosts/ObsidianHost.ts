/**
 * ObsidianHost implementation
 * Provides Obsidian-specific Host implementation for TaskSync application
 *
 * This class implements the Host interface for the Obsidian environment,
 * providing access to Obsidian's plugin data storage for both settings
 * and canonical TaskSync application data.
 */

import { Host } from "../core/host";
import { Notice } from "obsidian";
import { TaskSyncSettings, DEFAULT_SETTINGS } from "../types/settings";
import { Area, Project, Task } from "../core/entities";
import { Extension, extensionRegistry } from "../core/extension";
import { eventBus } from "../core/events";
import { taskStore } from "../stores/taskStore";
import { projectStore } from "../stores/projectStore";
import { areaStore } from "../stores/areaStore";
import { get } from "svelte/store";
import { taskSyncApp } from "../App";
import { isPlanningActive } from "../stores/contextStore";
import deepmerge from "deepmerge";

/**
 * Interface for Obsidian Plugin that provides the necessary methods
 * for data persistence and lifecycle management.
 */
interface ObsidianPlugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadData(): Promise<any>; // Obsidian API returns any - data structure is plugin-defined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveData(data: any): Promise<void>; // Obsidian API accepts any - data structure is plugin-defined
  onload?(): Promise<void> | void;
  onunload?(): Promise<void> | void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any; // Obsidian App instance - third-party API with incomplete types
}

/**
 * ObsidianHost provides the Host implementation for Obsidian environments.
 *
 * This class bridges the TaskSync application with Obsidian's plugin system,
 * providing access to Obsidian's data persistence mechanisms for storing
 * both TaskSync settings and canonical application data.
 *
 * The ObsidianHost stores canonical, high-level data structures that include
 * complete metadata like IDs, source information, and full entity state.
 * This is fundamentally different from the ObsidianExtension which stores
 * representation layers (markdown files) for display within Obsidian's
 * note system.
 */
export class ObsidianHost extends Host {
  constructor(readonly plugin: ObsidianPlugin) {
    super();
    this.plugin = plugin;
  }

  /**
   * Load TaskSync settings from Obsidian's plugin data storage.
   *
   * If no settings exist, returns default settings.
   * If partial settings exist, merges them with defaults.
   *
   * @returns Promise resolving to the TaskSync settings object
   * @throws Error if settings cannot be loaded from Obsidian
   */
  async loadSettings(): Promise<TaskSyncSettings> {
    try {
      const data = await this.plugin.loadData();

      if (!data) {
        return { ...DEFAULT_SETTINGS };
      }

      // Deep merge loaded data with defaults to handle partial settings
      // This ensures new settings (like googleCalendar) are properly initialized
      // Use array overwrite strategy to prevent concatenating arrays like taskCategories.
      // Arrays in settings should replace defaults entirely, not merge with them,
      // to avoid duplicate entries and maintain user's explicit configuration.
      return deepmerge(DEFAULT_SETTINGS, data, {
        arrayMerge: (_, sourceArray) => sourceArray,
      }) as TaskSyncSettings;
    } catch (error) {
      throw new Error(
        `Failed to load settings from Obsidian: ${error.message}`
      );
    }
  }



  /**
   * Persist TaskSync settings to Obsidian's plugin data storage.
   *
   * Settings are stored at the root level of the plugin data.
   * Entity data is stored under the 'entities' key to avoid conflicts.
   *
   * @param settings - The TaskSync settings object to persist
   * @throws Error if settings cannot be saved to Obsidian
   */
  async saveSettings(settings: TaskSyncSettings): Promise<void> {
    try {
      // Load existing data to preserve entity data
      const existingData = (await this.plugin.loadData()) || {};

      // Merge settings at root level, preserving entity data
      const updatedData = {
        ...settings,
        entities: existingData.entities, // Preserve entity data
      };

      await this.plugin.saveData(updatedData);
    } catch (error) {
      throw new Error(`Failed to save settings to Obsidian: ${error.message}`);
    }
  }

  /**
   * Load and initialize extensions after Obsidian's layout is ready.
   * This ensures that the vault is fully loaded and all APIs are available
   * before extensions attempt to scan files or perform vault operations.
   *
   * @throws Error if extension loading fails
   */
  async load(): Promise<void> {
    try {
      // Import TaskSyncApp and trigger extension loading
      const { taskSyncApp } = await import("../App");
      await taskSyncApp.load();
    } catch (error) {
      throw new Error(`Failed to load extensions: ${error.message}`);
    }
  }

  /**
   * Persist TaskSync application data to Obsidian's plugin storage.
   *
   * This stores the canonical, high-level data structures that include
   * complete metadata like IDs, source information, and full entity state.
   * This is the authoritative data store for TaskSync entities.
   *
   * Entity data is stored under the 'entities' key to avoid conflicts with settings.
   *
   * @param data - The TaskSync application data to persist
   * @throws Error if data cannot be saved to Obsidian
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveData(data: any): Promise<void> { // Must match Obsidian Plugin API signature
    try {
      // Load existing data to preserve settings
      const existingData = (await this.plugin.loadData()) || {};

      // Store entity data under 'entities' key, preserving settings at root level
      const updatedData = {
        ...existingData,
        entities: data,
      };

      await this.plugin.saveData(updatedData);
    } catch (error) {
      throw new Error(`Failed to save data to Obsidian: ${error.message}`);
    }
  }

  /**
   * Load TaskSync application data from Obsidian's plugin storage.
   *
   * This loads the canonical, high-level data structures that include
   * complete metadata like IDs, source information, and full entity state.
   * This is the authoritative data store for TaskSync entities.
   *
   * Entity data is stored under the 'entities' key to avoid conflicts with settings.
   *
   * @returns Promise resolving to the TaskSync application data, or null if none exists
   * @throws Error if data cannot be loaded from Obsidian
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async loadData(): Promise<any> { // Must match Obsidian Plugin API return type
    try {
      const data = await this.plugin.loadData();
      // Return entity data from 'entities' key, or null if not present
      return data?.entities || null;
    } catch (error) {
      throw new Error(`Failed to load data from Obsidian: ${error.message}`);
    }
  }

  /**
   * Open a file in Obsidian's workspace by file path.
   *
   * @param filePath - The path to the file to open
   * @throws Error if file cannot be opened or found
   */
  async openFileByPath(filePath: string): Promise<void> {
    const app = this.plugin.app;
    const file = app.vault.getAbstractFileByPath(filePath);

    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.workspace.getLeaf().openFile(file as any); // Obsidian's TFile type compatibility
  }

  /**
   * Open a file in Obsidian's workspace.
   *
   * @param entity - The entity whose file should be opened
   * @throws Error if file cannot be opened or found
   */
  async openFile(entity: Area | Project | Task): Promise<void> {
    const filePath = entity.source.keys.obsidian;
    if (!filePath) {
      throw new Error(
        `Entity ${entity.id} does not have an Obsidian file path`
      );
    }

    await this.openFileByPath(filePath);
  }

  /**
   * Show a notice to the user.
   *
   * @param message - The message to display
   * @param duration - Duration in milliseconds (default: 5000)
   */
  showNotice(message: string, duration: number = 5000): void {
    new Notice(message, duration);
  }

  /**
   * Get an extension by its ID.
   * For the "local" service ID, this returns the ObsidianExtension.
   *
   * @param extensionId - The ID of the extension to retrieve (e.g., "local", "obsidian", "github")
   * @returns The extension instance, or undefined if not found
   */
  getExtensionById(extensionId: string): Extension | undefined {
    // Map "local" to "obsidian" extension for backward compatibility
    const actualExtensionId =
      extensionId === "local" ? "obsidian" : extensionId;
    return extensionRegistry.getById(actualExtensionId);
  }

  /**
   * Lifecycle callback that runs when TaskSync initializes in Obsidian.
   *
   * Sets up event handlers and other host-level initialization.
   * This is called by the plugin's onload method, NOT the other way around.
   *
   * @throws Error if Obsidian host initialization fails
   */
  async onload(): Promise<void> {
    // Subscribe to note creation events and automatically open the created note
    // BUT NOT when Daily Planning wizard is active (to avoid changing context)
    eventBus.on("obsidian.notes.created", ({ filePath }) => {
      void (async () => {
        // Check if Daily Planning wizard is active
        const planningActive = get(isPlanningActive);

        if (!planningActive) {
          await this.openFileByPath(filePath);
        } else {
          console.log(
            `Skipping auto-open of ${filePath} because Daily Planning wizard is active`
          );
        }
      })();
    });

    // Subscribe to entity change events and persist data to Obsidian storage
    // This ensures that all entity changes are automatically saved
    const persistData = () => {
      void (async () => {
        try {
          const tasks = get(taskStore).tasks;
          const projects = get(projectStore).projects;
          const areas = get(areaStore).areas;

          const data = {
            tasks,
            projects,
            areas,
            lastSync: new Date().toISOString(),
          };

          await this.saveData(data);
        } catch (error) {
          console.error("Failed to persist entity data:", error);
        }
      })();
    };

    // Subscribe to all entity change events
    eventBus.on("tasks.created", persistData);
    eventBus.on("tasks.updated", persistData);
    eventBus.on("tasks.deleted", persistData);
    eventBus.on("tasks.loaded", persistData);

    eventBus.on("projects.created", persistData);
    eventBus.on("projects.updated", persistData);
    eventBus.on("projects.deleted", persistData);
    eventBus.on("projects.loaded", persistData);

    eventBus.on("areas.created", persistData);
    eventBus.on("areas.updated", persistData);
    eventBus.on("areas.deleted", persistData);
    eventBus.on("areas.loaded", persistData);
  }

  /**
   * Lifecycle callback that runs when TaskSync unloads from Obsidian.
   *
   * Cleans up event handlers and other host-level resources.
   *
   * @throws Error if Obsidian host cleanup fails
   */
  async onunload(): Promise<void> {
    // Clear all event handlers registered by this host
    eventBus.clearHandlers("obsidian.notes.created");

    eventBus.clearHandlers("tasks.created");
    eventBus.clearHandlers("tasks.updated");
    eventBus.clearHandlers("tasks.deleted");
    eventBus.clearHandlers("tasks.loaded");

    eventBus.clearHandlers("projects.created");
    eventBus.clearHandlers("projects.updated");
    eventBus.clearHandlers("projects.deleted");
    eventBus.clearHandlers("projects.loaded");

    eventBus.clearHandlers("areas.created");
    eventBus.clearHandlers("areas.updated");
    eventBus.clearHandlers("areas.deleted");
    eventBus.clearHandlers("areas.loaded");
  }

  /**
   * Get the TaskSync application instance.
   * This provides access to the app for testing and advanced operations.
   *
   * @returns The TaskSync application instance
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getApp(): any { // Returns taskSyncApp which has dynamic type - used for testing only
    return taskSyncApp;
  }
}
