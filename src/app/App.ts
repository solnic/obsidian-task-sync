/**
 * TaskSync App Bootstrap Class
 * Initializes the new entities system with Host abstraction
 */

import { ObsidianExtension } from "./extensions/ObsidianExtension";
import { Host } from "./core/host";

export class TaskSyncApp {
  private initialized = false;
  private obsidianExtension?: ObsidianExtension;
  private host?: Host;

  async initialize(host: Host): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("TaskSync app initializing with Host...");

      this.host = host;

      // Load settings from host
      const settings = await host.loadSettings();

      console.log("TaskSync app initializing...", {
        hasHost: !!host,
        hasSettings: !!settings,
      });

      // Initialize Obsidian extension - we still need the raw Obsidian objects for the extension
      // The Host abstraction is for the app-level concerns, Extensions still need Obsidian APIs
      // TODO: This will need to be refactored when we make the app truly host-agnostic
      const obsidianHost = host as any; // Cast to access underlying plugin
      if (obsidianHost.plugin && obsidianHost.plugin.app) {
        const extensionSettings = {
          areasFolder: settings.areasFolder || "Areas",
          projectsFolder: settings.projectsFolder || "Projects",
          tasksFolder: settings.tasksFolder || "Tasks",
        };

        this.obsidianExtension = new ObsidianExtension(
          obsidianHost.plugin.app,
          obsidianHost.plugin,
          extensionSettings
        );

        await this.obsidianExtension.initialize();
      }

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

    this.initialized = false;
    console.log("TaskSync app shutdown complete");
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const taskSyncApp = new TaskSyncApp();
