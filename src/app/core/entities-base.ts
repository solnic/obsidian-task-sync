/**
 * Abstract base classes for entity Queries and Operations
 * Provides common functionality that all entities share
 */

import {
  Task,
  Project,
  Area,
  Schedule,
  TaskSchema,
  ProjectSchema,
  AreaSchema,
  ScheduleSchema,
} from "./entities";
import { extensionRegistry } from "./extension";
import { generateId } from "../utils/idGenerator";
import type { TaskSyncSettings } from "../types/settings";

// Generic entity union type
export type Entity = Task | Project | Area | Schedule;
export type EntityType = "task" | "project" | "area" | "schedule";

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

  constructor(public settings: TaskSyncSettings) {
    this.settings = settings;
  }

  // Common operation methods that all entities support
  abstract create(
    entityData: Omit<Entity, "id" | "createdAt" | "updatedAt">
  ): Promise<Entity>;
  abstract update(entity: Entity): Promise<Entity>;
  abstract delete(id: string): Promise<void>;

  public buildEntity(
    entityData: Omit<Entity, "id" | "createdAt" | "updatedAt">
  ) {
    const now = this.timestamp();

    // Build the raw entity with ID and timestamps
    const rawEntity = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ...entityData,
    };

    // Validate and coerce through the appropriate schema based on entity type
    // This ensures dates are properly coerced from strings to Date objects
    switch (this.entityType) {
      case "task":
        return TaskSchema.parse(rawEntity) as Entity;
      case "project":
        return ProjectSchema.parse(rawEntity) as Entity;
      case "area":
        return AreaSchema.parse(rawEntity) as Entity;
      case "schedule":
        return ScheduleSchema.parse(rawEntity) as Entity;
      default:
        // Fallback for unknown entity types (shouldn't happen)
        return rawEntity as Entity;
    }
  }

  public timestamp() {
    return new Date();
  }
}
