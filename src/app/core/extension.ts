/**
 * Extension system foundation for the Svelte app architecture
 * Provides pluggable extension system for different sources (Obsidian, GitHub, etc.)
 */

import { Task, Project, Area } from "./entities";

// Generic entity union type
export type Entity = Task | Project | Area;
export type EntityType = "task" | "project" | "area";

// CRUD operations interface for entities
export interface EntityOperations<T extends Entity> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  create(entity: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

// Extension interface - completely agnostic to implementation details
export interface Extension {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedEntities: readonly EntityType[];

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Entity operations (optional - extensions can support subset)
  tasks?: EntityOperations<Task>;
  projects?: EntityOperations<Project>;
  areas?: EntityOperations<Area>;

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

// Global extension registry instance
export const extensionRegistry = new ExtensionRegistry();
