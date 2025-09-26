/**
 * Projects entity with Queries and Operations
 * Implements the abstract base pattern for project management
 */

import { Project } from "../core/entities";
import {
  Entities,
  EntitiesQueries,
  EntitiesOperations,
} from "../core/entities-base";
import { projectStore as store } from "../stores/projectStore";
import { eventBus } from "../core/events";

export class Projects extends Entities {
  protected entityType = "project" as const;

  static Queries = class ProjectQueries extends EntitiesQueries {
    public entityType = "project" as const;

    async getAll(): Promise<readonly Project[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          resolve(state.projects);
          unsubscribe();
        });
      });
    }

    async getById(id: string): Promise<Project | null> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const project = state.projects.find((p) => p.id === id);
          resolve(project || null);
          unsubscribe();
        });
      });
    }

    async getByExtension(extensionId: string): Promise<readonly Project[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const projects = state.projects.filter(
            (p) => p.source?.extension === extensionId
          );
          resolve(projects);
          unsubscribe();
        });
      });
    }

    // Project-specific query methods
    async search(query: string): Promise<readonly Project[]> {
      const searchTerm = query.toLowerCase();
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const projects = state.projects.filter(
            (p) =>
              p.name.toLowerCase().includes(searchTerm) ||
              p.description?.toLowerCase().includes(searchTerm) ||
              p.tags.some((tag) => tag.toLowerCase().includes(searchTerm)) ||
              p.areas.some((area) => area.toLowerCase().includes(searchTerm))
          );
          resolve(projects);
          unsubscribe();
        });
      });
    }

    async getByArea(areaId: string): Promise<readonly Project[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const projects = state.projects.filter((p) =>
            p.areas.includes(areaId)
          );
          resolve(projects);
          unsubscribe();
        });
      });
    }

    async getByTag(tag: string): Promise<readonly Project[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const projects = state.projects.filter((p) => p.tags.includes(tag));
          resolve(projects);
          unsubscribe();
        });
      });
    }
  };

  static Operations = class ProjectOperations extends EntitiesOperations {
    public entityType = "project" as const;

    async create(
      projectData: Omit<Project, "id" | "createdAt" | "updatedAt">
    ): Promise<Project> {
      const project = this.buildEntity(projectData) as Project;

      store.addProject(project);

      eventBus.trigger({ type: "projects.created", project });

      return project;
    }

    async update(project: Project): Promise<Project> {
      const updatedProject: Project = { ...project, updatedAt: this.timestamp() };

      store.updateProject(updatedProject);

      eventBus.trigger({ type: "projects.updated", project: updatedProject });

      return updatedProject;
    }

    async delete(id: string): Promise<void> {
      store.removeProject(id);
      eventBus.trigger({ type: "projects.deleted", projectId: id });
    }

    // Project-specific operations
    async addToArea(projectId: string, areaId: string): Promise<void> {
      const project = await new Projects.Queries().getById(projectId);
      if (project && !project.areas.includes(areaId)) {
        await this.update({
          ...project,
          areas: [...project.areas, areaId],
        });
      }
    }

    async removeFromArea(projectId: string, areaId: string): Promise<void> {
      const project = await new Projects.Queries().getById(projectId);
      if (project) {
        await this.update({
          ...project,
          areas: project.areas.filter((a) => a !== areaId),
        });
      }
    }

    async addTag(projectId: string, tag: string): Promise<void> {
      const project = await new Projects.Queries().getById(projectId);
      if (project && !project.tags.includes(tag)) {
        await this.update({
          ...project,
          tags: [...project.tags, tag],
        });
      }
    }

    async removeTag(projectId: string, tag: string): Promise<void> {
      const project = await new Projects.Queries().getById(projectId);
      if (project) {
        await this.update({
          ...project,
          tags: project.tags.filter((t) => t !== tag),
        });
      }
    }
  };
}

// Export instances for easy use
export const projectQueries = new Projects.Queries();
export const projectOperations = new Projects.Operations();
