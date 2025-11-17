/**
 * Test type definitions for entity types
 * Re-exports entity types from source for use in tests
 */

// Re-export core entity types
export type { Task, Project, Area, Schedule } from "../../src/app/core/entities";
export type { Entity, EntityType } from "../../src/app/core/extension";

// Re-export entity-related interfaces
export type { EntityOperations } from "../../src/app/core/extension";
