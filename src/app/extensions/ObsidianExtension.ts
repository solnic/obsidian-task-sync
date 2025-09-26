/**
 * Obsidian Extension
 * Main extension implementation for Obsidian vault integration
 * Provides area operations and coordinates with the event bus
 */

import { App, Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../core/extension";
import { eventBus } from "../core/events";
import { ObsidianAreaOperations } from "./ObsidianAreaOperations";
import { ObsidianProjectOperations } from "./ObsidianProjectOperations";
import { ObsidianTaskOperations } from "./ObsidianTaskOperations";

export interface ObsidianExtensionSettings {
  areasFolder: string;
  projectsFolder: string;
  tasksFolder: string;
}

export class ObsidianExtension implements Extension {
  readonly id = "obsidian";
  readonly name = "Obsidian Vault";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = ["area", "project", "task"];

  private initialized = false;
  private areaOperations: ObsidianAreaOperations;
  private projectOperations: ObsidianProjectOperations;
  private taskOperations: ObsidianTaskOperations;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: ObsidianExtensionSettings
  ) {
    this.areaOperations = new ObsidianAreaOperations(app, settings.areasFolder);
    this.projectOperations = new ObsidianProjectOperations(
      app,
      settings.projectsFolder
    );
    this.taskOperations = new ObsidianTaskOperations(app, settings.tasksFolder);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Register with the core app
      extensionRegistry.register(this);

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      // Set up event listeners for domain events
      this.setupEventListeners();

      this.initialized = true;
      console.log("ObsidianExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ObsidianExtension:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    eventBus.trigger({
      type: "extension.unregistered",
      extension: this.id,
    });

    this.initialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.app.vault !== null && this.initialized;
  }

  // Event handler methods required by Extension interface
  async onEntityCreated(event: any): Promise<void> {
    if (event.type === "areas.created") {
      // React to area creation by creating the corresponding Obsidian note
      await this.areaOperations.createNote(event.area);
    } else if (event.type === "projects.created") {
      // React to project creation by creating the corresponding Obsidian note
      await this.projectOperations.createNote(event.project);
    } else if (event.type === "tasks.created") {
      // React to task creation by creating the corresponding Obsidian note
      await this.taskOperations.createNote(event.task);
    }
  }

  async onEntityUpdated(event: any): Promise<void> {
    if (event.type === "areas.updated") {
      // React to area update by updating the corresponding Obsidian note
      await this.areaOperations.updateNote(event.area);
    } else if (event.type === "projects.updated") {
      // React to project update by updating the corresponding Obsidian note
      await this.projectOperations.updateNote(event.project);
    } else if (event.type === "tasks.updated") {
      // React to task update by updating the corresponding Obsidian note
      await this.taskOperations.updateNote(event.task);
    }
  }

  async onEntityDeleted(event: any): Promise<void> {
    if (event.type === "areas.deleted") {
      // React to area deletion by deleting the corresponding Obsidian note
      await this.areaOperations.deleteNote(event.areaId);
    } else if (event.type === "projects.deleted") {
      // React to project deletion by deleting the corresponding Obsidian note
      await this.projectOperations.deleteNote(event.projectId);
    } else if (event.type === "tasks.deleted") {
      // React to task deletion by deleting the corresponding Obsidian note
      await this.taskOperations.deleteNote(event.taskId);
    }
  }

  private setupEventListeners(): void {
    // Subscribe to domain events to reactively manage Obsidian notes
    eventBus.on("areas.created", this.onEntityCreated.bind(this));
    eventBus.on("areas.updated", this.onEntityUpdated.bind(this));
    eventBus.on("areas.deleted", this.onEntityDeleted.bind(this));

    eventBus.on("projects.created", this.onEntityCreated.bind(this));
    eventBus.on("projects.updated", this.onEntityUpdated.bind(this));
    eventBus.on("projects.deleted", this.onEntityDeleted.bind(this));

    eventBus.on("tasks.created", this.onEntityCreated.bind(this));
    eventBus.on("tasks.updated", this.onEntityUpdated.bind(this));
    eventBus.on("tasks.deleted", this.onEntityDeleted.bind(this));
  }
}
