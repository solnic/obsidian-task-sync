/**
 * Abstract base classes for entity Queries and Operations
 * Provides common functionality that all entities share
 */

import { Task, Project, Area } from "./entities";
import { extensionRegistry } from "./extension";

// Generic entity union type
export type Entity = Task | Project | Area;
export type EntityType = "task" | "project" | "area";

// Abstract base class for all Entities
export abstract class Entities {
  protected abstract entityType: EntityType;

  // Common query functionality that all entities share
  // Note: Stores are factory functions, not instances
  // Subclasses should implement their own store access logic

  protected getExtension(extensionId?: string) {
    const defaultExtension = extensionRegistry.getById("obsidian");
    if (extensionId) {
      return extensionRegistry.getById(extensionId);
    }
    return defaultExtension;
  }

  // Abstract nested classes that must be implemented
  static Queries: typeof EntitiesQueries;
  static Operations: typeof EntitiesOperations;
}

// Abstract base class for Queries (pure functions that return data)
export abstract class EntitiesQueries {
  public abstract entityType: EntityType;

  // Common query methods that all entities support
  abstract getAll(): Promise<readonly Entity[]>;
  abstract getById(id: string): Promise<Entity | null>;
  abstract getByExtension(extensionId: string): Promise<readonly Entity[]>;
}

// Abstract base class for Operations (functions with side-effects)
export abstract class EntitiesOperations {
  public abstract entityType: EntityType;

  // Common operation methods that all entities support
  abstract create(
    entityData: Omit<Entity, "id" | "createdAt" | "updatedAt">
  ): Promise<Entity>;
  abstract update(entity: Entity): Promise<Entity>;
  abstract delete(id: string): Promise<void>;
}
