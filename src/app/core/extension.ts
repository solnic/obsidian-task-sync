/**
 * Extension system foundation for the Svelte app architecture
 * Provides pluggable extension system for different sources (Obsidian, GitHub, etc.)
 */

import { Task, Project, Area, Schedule } from "./entities";
import { DomainEvent } from "./events";
import { eventBus } from "./events";
import type { Readable } from "svelte/store";
// Generic entity union type
export type Entity = Task | Project | Area | Schedule;
export type EntityType = "task" | "project" | "area" | "schedule";

// CRUD operations interface for entities
export interface EntityOperations<T extends Entity> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  create(entity: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

/**
 * Data access interface for extensions to provide to UI components
 * Extensions expose their data through observable stores and refresh methods
 *
 * Note: Search, filter, and sort operations should use TaskQueryService
 * Extensions may provide extension-specific filtering if needed (e.g., GitHub labels)
 */
export interface ExtensionDataAccess {
  /**
   * Observable store containing the tasks for this extension
   * UI components subscribe to this for reactive updates
   */
  getTasks(): Readable<readonly Task[]>;

  /**
   * Refresh the extension's data
   */
  refresh(): Promise<void>;
}

// Extension interface - completely agnostic to implementation details
export interface Extension extends ExtensionDataAccess {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedEntities: readonly EntityType[];

  // Lifecycle
  initialize(): Promise<void>;
  load(): Promise<void>;
  shutdown(): Promise<void>;

  // Event-driven methods for reacting to entity changes
  onEntityCreated(event: DomainEvent): Promise<void>;
  onEntityUpdated(event: DomainEvent): Promise<void>;
  onEntityDeleted(event: DomainEvent): Promise<void>;

  // Entity operations
  tasks?: EntityOperations<Task>;
  projects?: EntityOperations<Project>;
  areas?: EntityOperations<Area>;
  schedules?: EntityOperations<Schedule>;

  // Health check
  isHealthy(): Promise<boolean>;
}

// Registry for managing extensions
export class ExtensionRegistry {
  private extensions = new Map<string, Extension>();

  register(extension: Extension): void {
    if (this.extensions.has(extension.id)) {
      throw new Error(
        `Extension with id '${extension.id}' is already registered`
      );
    }
    this.extensions.set(extension.id, extension);
  }

  unregister(id: string): void {
    this.extensions.delete(id);
  }

  getById(id: string): Extension | undefined {
    return this.extensions.get(id);
  }

  getAll(): Extension[] {
    return Array.from(this.extensions.values());
  }

  getByEntityType(entityType: EntityType): Extension[] {
    return this.getAll().filter((ext) =>
      ext.supportedEntities.includes(entityType)
    );
  }
}

export abstract class BaseEntityOperations<T extends Entity> {
  public id: string;

  constructor(options: { id: string }) {
    this.id = options.id;
  }

  /**
   * Trigger an extension-specific event
   * @param type - Event type suffix (will be prefixed with extension id)
   * @param eventData - Additional event data to include
   */
  protected trigger(type: string, eventData: Record<string, any> = {}): void {
    eventBus.trigger({ type: `${this.id}.${type}`, ...eventData });
  }
}

// Global extension registry instance
export const extensionRegistry = new ExtensionRegistry();
