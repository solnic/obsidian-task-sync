/**
 * Project Store - Reactive Svelte store for project management
 * Provides a centralized, reactive API for project operations and queries
 */

import { derived } from "svelte/store";
import { EntityStore } from "./EntityStore";
import { Project } from "../types/entities";

class ProjectStore extends EntityStore<Project> {
  constructor() {
    super("projectStore");
  }

  protected getPropertySet(): readonly string[] {
    // Projects use a subset of properties
    return ["TITLE", "TYPE", "AREAS", "TAGS"] as const;
  }

  // Derived stores for common queries
  public activeProjects = derived(
    this._store,
    ($store) => $store.entities // All projects are considered active since we don't have status
  );

  public completedProjects = derived(
    this._store,
    ($store) => [] as Project[] // No completed projects since we don't have status
  );

  public projectsByArea = derived(this._store, ($store) => {
    const projectsByArea: Record<string, Project[]> = {};

    $store.entities.forEach((project) => {
      if (project.areas && project.areas.length > 0) {
        project.areas.forEach((area) => {
          const areaName = area.replace(/^\[\[|\]\]$/g, ""); // Remove wiki link brackets
          if (!projectsByArea[areaName]) {
            projectsByArea[areaName] = [];
          }
          projectsByArea[areaName].push(project);
        });
      } else {
        // Projects without areas
        if (!projectsByArea["No Area"]) {
          projectsByArea["No Area"] = [];
        }
        projectsByArea["No Area"].push(project);
      }
    });

    return projectsByArea;
  });

  /**
   * Get projects by area name
   */
  getProjectsByArea(areaName: string): Project[] {
    const entities = this.getEntities();
    return entities.filter(
      (project) =>
        project.areas?.includes(areaName) ||
        project.areas?.includes(`[[${areaName}]]`)
    );
  }

  /**
   * Get projects by status - disabled since Project entity doesn't have status property
   */
  // getProjectsByStatus(
  //   status: "active" | "on-hold" | "completed" | "cancelled"
  // ): Project[] {
  //   const entities = this.getEntities();
  //   return entities.filter((project) => project.status === status);
  // }

  /**
   * Find a project by name
   */
  findProjectByName(name: string): Project | null {
    const entities = this.getEntities();
    return (
      entities.find(
        (project) =>
          project.name === name ||
          project.name === `[[${name}]]` ||
          project.file?.name === name
      ) || null
    );
  }

  /**
   * Get project statistics - simplified since Project entity doesn't have status/progress
   */
  getProjectStats() {
    const entities = this.getEntities();
    return {
      total: entities.length,
    };
  }

  /**
   * Update project status
   */
  async updateProjectStatus(
    filePath: string,
    status: "active" | "on-hold" | "completed" | "cancelled"
  ): Promise<void> {
    const project = this.findEntityByPath(filePath);
    if (project) {
      const updatedProject = { ...project, status };
      await this.upsertEntity(updatedProject);
    }
  }

  /**
   * Update project progress
   */
  async updateProjectProgress(
    filePath: string,
    progress: number
  ): Promise<void> {
    const project = this.findEntityByPath(filePath);
    if (project) {
      const updatedProject = { ...project, progress };
      await this.upsertEntity(updatedProject);
    }
  }
}

// Export singleton instance
export const projectStore = new ProjectStore();
