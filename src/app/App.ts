/**
 * TaskSync App Bootstrap Class
 * Initializes the new entities system with Obsidian extension
 */

import { ObsidianExtension } from "./extensions/ObsidianExtension";

export class TaskSyncApp {
  private initialized = false;
  private obsidianExtension?: ObsidianExtension;

  async initialize(
    obsidianApp: any,
    plugin: any,
    settings: any
  ): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("TaskSync app initializing...", {
        hasObsidianApp: !!obsidianApp,
        hasPlugin: !!plugin,
        hasSettings: !!settings,
      });

      // Initialize Obsidian extension
      this.obsidianExtension = new ObsidianExtension(obsidianApp, plugin, {
        areasFolder: settings.areasFolder || "Areas",
      });

      await this.obsidianExtension.initialize();

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
