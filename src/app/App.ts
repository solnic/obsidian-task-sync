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
        this.obsidianExtension = new ObsidianExtension(
          obsidianHost.plugin.app,
          obsidianHost.plugin,
          {
            areasFolder: settings.areasFolder || "Areas",
            projectsFolder: settings.projectsFolder || "Projects",
            tasksFolder: settings.tasksFolder || "Tasks",
          }
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
