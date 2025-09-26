/**
 * Obsidian Extension
 * Main extension implementation for Obsidian vault integration
 * Provides area operations and coordinates with the event bus
 */

import { App, Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../core/extension";
import { eventBus } from "../core/events";
import { ObsidianAreaOperations } from "./ObsidianAreaOperations";

export interface ObsidianExtensionSettings {
  areasFolder: string;
  // Future: tasksFolder, projectsFolder when we implement those
}

export class ObsidianExtension implements Extension {
  readonly id = "obsidian";
  readonly name = "Obsidian Vault";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = ["area"]; // Start with areas only

  readonly areas: ObsidianAreaOperations;

  private initialized = false;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: ObsidianExtensionSettings
  ) {
    this.areas = new ObsidianAreaOperations(app, settings.areasFolder);
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

      // Set up event listeners for request events
      this.setupEventListeners();

      // Load initial data
      await this.loadAllEntities();

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
      // Use ObsidianAreaOperations to create the note
      await this.areas.createNote(event.area);
    }
  }

  async onEntityUpdated(event: any): Promise<void> {
    if (event.type === "areas.updated") {
      // Use ObsidianAreaOperations to update the note
      await this.areas.updateNote(event.area);
    }
  }

  async onEntityDeleted(event: any): Promise<void> {
    if (event.type === "areas.deleted") {
      // Use ObsidianAreaOperations to delete the note
      await this.areas.deleteNote(event.areaId);
    }
  }

  private setupEventListeners(): void {
    // Subscribe to domain events to reactively manage Obsidian notes
    eventBus.on("areas.created", this.onEntityCreated.bind(this));
    eventBus.on("areas.updated", this.onEntityUpdated.bind(this));
    eventBus.on("areas.deleted", this.onEntityDeleted.bind(this));
  }

  private async loadAllEntities(): Promise<void> {
    try {
      eventBus.trigger({
        type: "extension.sync.started",
        extension: this.id,
        entityType: "area",
      });

      const areas = await this.areas.getAll();

      eventBus.trigger({
        type: "areas.loaded",
        areas,
        extension: this.id,
      });

      eventBus.trigger({
        type: "extension.sync.completed",
        extension: this.id,
        entityType: "area",
        entityCount: areas.length,
      });
    } catch (error) {
      console.error("Failed to load entities from Obsidian:", error);
      eventBus.trigger({
        type: "extension.sync.failed",
        extension: this.id,
        entityType: "area",
        error: error.message,
      });
    }
  }
}
