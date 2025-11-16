/**
 * Generic operation interfaces for Svelte components
 * These interfaces decouple Svelte components from specific implementation details
 */

import type { Area, Project, Task } from "../core/entities";

/**
 * Generic interface for area creation operations
 * Used by AreaCreateModal.svelte to create areas without coupling to Obsidian-specific types
 */
export interface AreaOperations {
  create(areaData: Omit<Area, "id" | "createdAt" | "updatedAt">): Promise<Area>;
}

/**
 * Generic interface for project creation operations
 * Used by ProjectCreateModal.svelte to create projects without coupling to Obsidian-specific types
 */
export interface ProjectOperations {
  create(projectData: Omit<Project, "id" | "createdAt" | "updatedAt">): Promise<Project>;
}

/**
 * Generic interface for task creation operations
 * Used by TaskCreateModal.svelte to create tasks without coupling to Obsidian-specific types
 */
export interface TaskOperations {
  create(taskData: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task>;
}
