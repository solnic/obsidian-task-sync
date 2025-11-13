/**
 * AssociationCleanup - Cascading cleanup for association properties
 * Automatically removes references to deleted entities from association properties
 */

import { eventBus } from "../core/events";
import { taskStore } from "../stores/taskStore";
import { projectStore } from "../stores/projectStore";
import { areaStore } from "../stores/areaStore";
import { get } from "svelte/store";
import type { Task, Project, Area } from "../core/entities";

/**
 * Configuration for association cleanup
 */
export interface AssociationCleanupConfig {
  /** Whether cleanup is enabled */
  enabled: boolean;

  /** Whether to log cleanup operations */
  verbose: boolean;
}

/**
 * AssociationCleanup handles automatic cleanup of orphaned association references
 * when entities are deleted
 */
export class AssociationCleanup {
  private config: AssociationCleanupConfig;
  private eventHandlers: Array<() => void> = [];

  constructor(config: Partial<AssociationCleanupConfig> = {}) {
    this.config = {
      enabled: true,
      verbose: false,
      ...config,
    };
  }

  /**
   * Start listening for deletion events and cleaning up associations
   */
  start(): void {
    if (!this.config.enabled) {
      return;
    }

    // Listen for task deletions
    const taskHandler = eventBus.on("tasks.deleted", (event) => {
      this.cleanupTaskReferences(event.taskId);
    });
    this.eventHandlers.push(taskHandler);

    // Listen for project deletions
    const projectHandler = eventBus.on("projects.deleted", (event) => {
      this.cleanupProjectReferences(event.projectId);
    });
    this.eventHandlers.push(projectHandler);

    // Listen for area deletions
    const areaHandler = eventBus.on("areas.deleted", (event) => {
      this.cleanupAreaReferences(event.areaId);
    });
    this.eventHandlers.push(areaHandler);

    if (this.config.verbose) {
      console.log("[AssociationCleanup] Started listening for deletion events");
    }
  }

  /**
   * Stop listening for deletion events
   */
  stop(): void {
    // Clear all registered event handlers
    for (const unregister of this.eventHandlers) {
      unregister();
    }
    this.eventHandlers = [];

    if (this.config.verbose) {
      console.log("[AssociationCleanup] Stopped listening for deletion events");
    }
  }

  /**
   * Clean up references to a deleted task
   */
  private cleanupTaskReferences(taskId: string): void {
    if (this.config.verbose) {
      console.log(`[AssociationCleanup] Cleaning up references to task: ${taskId}`);
    }

    // Tasks currently don't reference other tasks via association properties
    // This is here for future extensibility if task-to-task associations are added
  }

  /**
   * Clean up references to a deleted project
   */
  private cleanupProjectReferences(projectId: string): void {
    if (this.config.verbose) {
      console.log(`[AssociationCleanup] Cleaning up references to project: ${projectId}`);
    }

    const state = get(taskStore);
    const tasksToUpdate: Task[] = [];

    // Find all tasks that reference this project
    for (const task of state.tasks) {
      if (task.project === projectId) {
        tasksToUpdate.push({
          ...task,
          project: "", // Clear the project reference
          updatedAt: new Date(),
        });
      }
    }

    // Update all affected tasks
    for (const task of tasksToUpdate) {
      taskStore.dispatch({ type: "UPDATE_TASK", task });
    }

    if (this.config.verbose && tasksToUpdate.length > 0) {
      console.log(`[AssociationCleanup] Cleared project reference from ${tasksToUpdate.length} task(s)`);
    }
  }

  /**
   * Clean up references to a deleted area
   */
  private cleanupAreaReferences(areaId: string): void {
    if (this.config.verbose) {
      console.log(`[AssociationCleanup] Cleaning up references to area: ${areaId}`);
    }

    const taskState = get(taskStore);
    const projectState = get(projectStore);
    const tasksToUpdate: Task[] = [];
    const projectsToUpdate: Project[] = [];

    // Find all tasks that reference this area
    for (const task of taskState.tasks) {
      if (task.areas.includes(areaId)) {
        tasksToUpdate.push({
          ...task,
          areas: task.areas.filter((a) => a !== areaId), // Remove the area reference
          updatedAt: new Date(),
        });
      }
    }

    // Find all projects that reference this area
    for (const project of projectState.projects) {
      if (project.areas.includes(areaId)) {
        projectsToUpdate.push({
          ...project,
          areas: project.areas.filter((a) => a !== areaId), // Remove the area reference
          updatedAt: new Date(),
        });
      }
    }

    // Update all affected tasks
    for (const task of tasksToUpdate) {
      taskStore.dispatch({ type: "UPDATE_TASK", task });
    }

    // Update all affected projects
    for (const project of projectsToUpdate) {
      projectStore.dispatch({ type: "UPDATE_PROJECT", project });
    }

    if (this.config.verbose && (tasksToUpdate.length > 0 || projectsToUpdate.length > 0)) {
      console.log(`[AssociationCleanup] Cleared area reference from ${tasksToUpdate.length} task(s) and ${projectsToUpdate.length} project(s)`);
    }
  }

  /**
   * Manually clean up all orphaned associations across all entities
   * This can be called on plugin load to clean up any references that may have been left behind
   */
  async cleanupOrphanedAssociations(): Promise<{
    tasksUpdated: number;
    projectsUpdated: number;
    areasUpdated: number;
  }> {
    if (this.config.verbose) {
      console.log("[AssociationCleanup] Starting manual cleanup of orphaned associations");
    }

    const taskState = get(taskStore);
    const projectState = get(projectStore);
    const areaState = get(areaStore);

    const tasksToUpdate: Task[] = [];
    const projectsToUpdate: Project[] = [];

    // Get valid IDs for reference checking
    const validProjectIds = new Set(projectState.projects.map((p) => p.id));
    const validProjectNames = new Set(projectState.projects.map((p) => p.name));
    const validAreaIds = new Set(areaState.areas.map((a) => a.id));
    const validAreaNames = new Set(areaState.areas.map((a) => a.name));

    // Check tasks for orphaned project references
    for (const task of taskState.tasks) {
      let needsUpdate = false;
      let updatedProject = task.project;
      let updatedAreas = task.areas;

      // Check project reference (currently stored as name, not ID)
      if (task.project && !validProjectNames.has(task.project)) {
        updatedProject = "";
        needsUpdate = true;
      }

      // Check area references (currently stored as names, not IDs)
      const validAreas = task.areas.filter((area) => validAreaNames.has(area));
      if (validAreas.length !== task.areas.length) {
        updatedAreas = validAreas;
        needsUpdate = true;
      }

      if (needsUpdate) {
        tasksToUpdate.push({
          ...task,
          project: updatedProject,
          areas: updatedAreas,
          updatedAt: new Date(),
        });
      }
    }

    // Check projects for orphaned area references
    for (const project of projectState.projects) {
      const validAreas = project.areas.filter((area) => validAreaNames.has(area));
      if (validAreas.length !== project.areas.length) {
        projectsToUpdate.push({
          ...project,
          areas: validAreas,
          updatedAt: new Date(),
        });
      }
    }

    // Update all affected entities
    for (const task of tasksToUpdate) {
      taskStore.dispatch({ type: "UPDATE_TASK", task });
    }

    for (const project of projectsToUpdate) {
      projectStore.dispatch({ type: "UPDATE_PROJECT", project });
    }

    const result = {
      tasksUpdated: tasksToUpdate.length,
      projectsUpdated: projectsToUpdate.length,
      areasUpdated: 0, // Areas don't currently have association properties
    };

    if (this.config.verbose) {
      console.log("[AssociationCleanup] Manual cleanup complete:", result);
    }

    return result;
  }
}

/**
 * Global singleton instance for convenience
 */
export const associationCleanup = new AssociationCleanup({ verbose: false });
