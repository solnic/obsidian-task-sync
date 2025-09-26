/**
 * Obsidian Extension
 * Main extension implementation for Obsidian vault integration
 * Provides area operations and coordinates with the event bus
 */

import { App, Plugin } from "obsidian";
import {
  Extension,
  EntityOperations,
  extensionRegistry,
  EntityType,
} from "../core/extension";
import { Area } from "../core/entities";
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

  readonly areas: EntityOperations<Area>;

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
    // TODO: Implement reactive note creation based on entity events
    console.log(`ObsidianExtension: Entity created event received`, event);
  }

  async onEntityUpdated(event: any): Promise<void> {
    // TODO: Implement reactive note updates based on entity events
    console.log(`ObsidianExtension: Entity updated event received`, event);
  }

  async onEntityDeleted(event: any): Promise<void> {
    // TODO: Implement reactive note deletion based on entity events
    console.log(`ObsidianExtension: Entity deleted event received`, event);
  }

  private setupEventListeners(): void {
    // Listen for area creation requests
    eventBus.on("areas.create.requested", async (event) => {
      try {
        const area = await this.areas.create(event.areaData);
        // The ObsidianAreaOperations will trigger the areas.created event
      } catch (error) {
        console.error("Failed to handle area creation request:", error);
      }
    });

    // Listen for area update requests
    eventBus.on("areas.update.requested", async (event) => {
      try {
        const area = await this.areas.update(event.area.id, event.area);
        // The ObsidianAreaOperations will trigger the areas.updated event
      } catch (error) {
        console.error("Failed to handle area update request:", error);
      }
    });

    // Listen for area deletion requests
    eventBus.on("areas.delete.requested", async (event) => {
      try {
        await this.areas.delete(event.areaId);
        // The ObsidianAreaOperations will trigger the areas.deleted event
      } catch (error) {
        console.error("Failed to handle area deletion request:", error);
      }
    });
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
