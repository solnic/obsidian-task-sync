/**
 * Abstract Entity Store - Base class for all entity stores
 * Provides common functionality for entity management including persistence, CRUD operations, and reactive updates
 */

import { writable, get, type Writable, type Readable } from "svelte/store";
import { App, TFile, Plugin } from "obsidian";
import { BaseEntity } from "../types/entities";
import { PROPERTY_REGISTRY } from "../types/properties";
import moment from "moment";

export interface EntityStoreState<T> {
  entities: T[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface EntityPersistenceData<T> {
  entities: T[];
  lastSync: Date;
}

export abstract class EntityStore<T extends BaseEntity> {
  protected app: App | null = null;
  protected plugin: Plugin | null = null;
  protected folder = "";
  protected storageKey = "";
  protected fileManager?: any; // File manager for loading entities

  // Core store
  protected _store: Writable<EntityStoreState<T>>;

  // Public store interface
  public subscribe: Readable<EntityStoreState<T>>["subscribe"];

  // Track ongoing refresh operations
  private refreshPromise: Promise<void> | null = null;

  /**
   * Returns the property keys that should be processed from front-matter for this entity type
   */
  protected abstract getPropertySet(): readonly string[];

  constructor(storageKey: string) {
    this.storageKey = storageKey;
    this._store = writable<EntityStoreState<T>>({
      entities: [],
      loading: false,
      error: null,
      lastUpdated: null,
    });
    this.subscribe = this._store.subscribe;
  }

  /**
   * Initialize the store with Obsidian app instance and plugin
   */
  async initialize(
    app: App,
    plugin: Plugin,
    folder: string,
    fileManager?: any
  ) {
    this.app = app;
    this.plugin = plugin;
    this.fileManager = fileManager;
    this.folder = folder;

    // Set up file system watchers for reactive updates
    this.setupFileWatchers();

    // Load persisted metadata (for tracking purposes only)
    await this.loadPersistedData();

    console.log(
      `${this.storageKey}: Store initialized, ready for vault events`
    );
  }

  /**
   * Refresh all entities from the file system
   */
  async refreshEntities() {
    // If there's already a refresh in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start a new refresh operation
    this.refreshPromise = this.performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Internal method to perform the actual refresh
   */
  private async performRefresh() {
    this._store.update((state) => ({ ...state, loading: true, error: null }));

    try {
      const entities = await this.loadAllEntities();

      this._store.update((state) => ({
        ...state,
        entities,
        loading: false,
        lastUpdated: new Date(),
      }));

      // Persist the updated entities
      await this.persistData();
    } catch (error) {
      this._store.update((state) => ({
        ...state,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : `Failed to load ${this.storageKey}s`,
      }));
    }
  }

  /**
   * Add or update an entity in the store
   */
  async upsertEntity(entity: T): Promise<void> {
    this._store.update((state) => {
      const existingIndex = state.entities.findIndex(
        (e) => e.filePath === entity.filePath
      );

      let updatedEntities: T[];
      if (existingIndex !== -1) {
        updatedEntities = [...state.entities];
        updatedEntities[existingIndex] = entity;
      } else {
        updatedEntities = [...state.entities, entity];
      }

      return {
        ...state,
        entities: updatedEntities,
        lastUpdated: new Date(),
      };
    });

    await this.persistData();
  }

  /**
   * Remove an entity from the store
   */
  async removeEntity(filePath: string): Promise<void> {
    this._store.update((state) => ({
      ...state,
      entities: state.entities.filter((e) => e.filePath !== filePath),
      lastUpdated: new Date(),
    }));

    await this.persistData();
  }

  /**
   * Get all entities
   */
  getEntities(): T[] {
    const state = get(this._store);
    return [...state.entities];
  }

  /**
   * Save store data to plugin storage
   */
  async saveData(): Promise<void> {
    await this.persistData();
  }

  /**
   * Find an entity by file path
   */
  findEntityByPath(filePath: string): T | null {
    const state = get(this._store);
    return state.entities.find((e) => e.filePath === filePath) || null;
  }

  /**
   * Wait for any ongoing refresh operations to complete
   */
  async waitForRefresh(): Promise<void> {
    if (this.refreshPromise) {
      await this.refreshPromise;
    }
  }

  /**
   * Update an entity's properties from front-matter data
   * Uses PROPERTY_REGISTRY to determine which properties come from front-matter
   */
  updateEntityFromFrontmatter(entity: T, frontmatter: Record<string, any>): T {
    const updatedEntity = { ...entity };

    // Iterate through all properties in the registry
    for (const [, propertyDef] of Object.entries(PROPERTY_REGISTRY)) {
      // Only update properties that come from front-matter
      if (!propertyDef.frontmatter) {
        continue;
      }

      const frontmatterKey = propertyDef.name;
      const entityKey = propertyDef.key;

      // Update entity property if it exists in front-matter
      if (frontmatterKey in frontmatter) {
        let value = frontmatter[frontmatterKey];

        // Convert date strings to Date objects for date properties using moment.js
        if (propertyDef.type === "date" && value) {
          if (typeof value === "string" && value !== "") {
            const momentDate = moment(value);
            value = momentDate.isValid() ? momentDate.toDate() : undefined;
          } else {
            value = undefined;
          }
        }

        // Clean link formatting for link properties
        if (propertyDef.link && value) {
          if (typeof value === "string") {
            value = value.replace(/^\[\[|\]\]$/g, "");
          } else if (Array.isArray(value)) {
            value = value.map((item) =>
              typeof item === "string" ? item.replace(/^\[\[|\]\]$/g, "") : item
            );
          }
        }

        (updatedEntity as any)[entityKey] = value;
      }
    }

    return updatedEntity;
  }

  /**
   * Handle metadata changes for individual files
   * Updates the entity in-place using front-matter data
   */
  private async handleMetadataChange(file: TFile, cache: any): Promise<void> {
    const existingEntity = this.findEntityByPath(file.path);

    if (!existingEntity) {
      const newEntity = await this.fileManager.loadEntity(file);

      if (newEntity) {
        await this.upsertEntity(newEntity);
      }

      return newEntity;
    }

    const updatedEntity = this.updateEntityFromFrontmatter(
      existingEntity,
      cache.frontmatter
    );

    await this.upsertEntity(updatedEntity);
  }

  /**
   * Load all entities from the file system
   */
  private async loadAllEntities(): Promise<T[]> {
    const folder = this.app.vault.getFolderByPath(this.folder);

    const entityFiles = folder.children
      .filter((child) => child instanceof TFile && child.extension === "md")
      .map((child) => child as TFile);

    const entities: T[] = [];

    // Get current persisted entities to preserve non-frontmatter data like source
    const currentState = get(this._store);
    const persistedEntitiesMap = new Map<string, T>();
    currentState.entities.forEach((entity) => {
      if (entity.filePath) {
        persistedEntitiesMap.set(entity.filePath, entity);
      }
    });

    for (const file of entityFiles) {
      const entityData = await this.parseFileToEntity(file);

      // It is fine to skip files that are not valid entities
      if (entityData) {
        // Merge with persisted data to preserve non-frontmatter properties like source
        const persistedEntity = persistedEntitiesMap.get(file.path);
        if (persistedEntity) {
          // Merge file data with persisted data, prioritizing file data for frontmatter properties
          const mergedEntity = {
            ...persistedEntity, // Start with persisted data (includes source, etc.)
            ...entityData, // Override with fresh file data (frontmatter properties)
            file: entityData.file, // Always use fresh file reference
          };

          entities.push(mergedEntity);
        } else {
          entities.push(entityData);
        }
      }
    }

    return entities;
  }

  /**
   * Parse a file and extract entity data using file manager
   */
  private async parseFileToEntity(file: TFile): Promise<T> {
    return await this.fileManager.loadEntity(file);
  }

  /**
   * Set up file system watchers for reactive updates using MetadataCache events
   * This provides more stable and reliable updates compared to vault modify events
   */
  private setupFileWatchers() {
    // Use MetadataCache 'changed' event for file modifications
    this.app.metadataCache.on("changed", (file, _data, cache) => {
      if (file.path.startsWith(this.folder + "/")) {
        this.handleMetadataChange(file, cache);
      }
    });

    // Use MetadataCache 'deleted' event for file deletions
    this.app.metadataCache.on("deleted", (file, _prevCache) => {
      if (file.path.startsWith(this.folder + "/")) {
        this.removeEntity(file.path);
      }
    });

    // Still use vault events for rename as MetadataCache doesn't handle these
    this.app.vault.on("rename", (file, oldPath) => {
      if (file.path.startsWith(this.folder + "/")) {
        this.refreshEntities()
          .then(() => {
            console.log(
              `Refreshed ${this.storageKey}s after renaming ${oldPath} -> ${file.path}`
            );
          })
          .catch((error) => {
            console.error(
              `Failed to refresh ${this.storageKey}s after file rename:`,
              error
            );
          });
      }
    });
  }

  /**
   * Load persisted data from plugin storage
   */
  private async loadPersistedData() {
    if (!this.plugin) return;

    try {
      const data = await this.plugin.loadData();
      if (data && data[this.storageKey]) {
        const persistedData: EntityPersistenceData<T> = data[this.storageKey];

        // Restore entities from persisted data
        if (persistedData.entities && persistedData.entities.length > 0) {
          // Restore entities without TFile objects (they'll be re-attached during refresh)
          const restoredEntities = persistedData.entities.map((entity: any) => {
            // Re-attach file reference if filePath exists
            let file: TFile | undefined;
            if (entity.filePath && this.app) {
              file = this.app.vault.getAbstractFileByPath(
                entity.filePath
              ) as TFile;
            }

            return {
              ...entity,
              file,
            } as T;
          });

          // Update store with restored entities
          this._store.update((state) => ({
            ...state,
            entities: restoredEntities,
            lastUpdated: persistedData.lastSync
              ? new Date(persistedData.lastSync)
              : new Date(),
          }));

          console.log(
            `Restored ${restoredEntities.length} ${this.storageKey}s from cache:`,
            {
              lastSync: persistedData.lastSync,
              entityCount: restoredEntities.length,
            }
          );
        }
      }
    } catch (error) {
      console.error(`Failed to load persisted ${this.storageKey} data:`, error);
    }
  }

  /**
   * Persist current store data to plugin storage
   */
  async persistData(): Promise<void> {
    if (!this.plugin) return;

    try {
      const state = get(this._store);
      const existingData = (await this.plugin.loadData()) || {};

      // Create serializable version of entities (without TFile objects)
      const serializableEntities = state.entities.map((entity) => {
        const { file, ...rest } = entity;
        return rest;
      });

      const persistenceData: EntityPersistenceData<any> = {
        entities: serializableEntities,
        lastSync: new Date(),
      };

      const updatedData = {
        ...existingData,
        [this.storageKey]: persistenceData,
      };

      await this.plugin.saveData(updatedData);
    } catch (error) {
      console.error(`Failed to persist ${this.storageKey} data:`, error);
    }
  }

  /**
   * Clear the store (for cleanup)
   */
  clear() {
    this._store.set({
      entities: [],
      loading: false,
      error: null,
      lastUpdated: null,
    });
  }

  /**
   * Save data on plugin unload
   */
  async onUnload(): Promise<void> {
    await this.persistData();
  }
}
