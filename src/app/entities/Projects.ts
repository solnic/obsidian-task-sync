/**
 * Projects entity with Queries and Operations
 * Implements the abstract base pattern for project management
 */

import { get } from "svelte/store";
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
      return get(store).projects;
    }

    async getById(id: string): Promise<Project | null> {
      const project = get(store).projects.find((p) => p.id === id);
      return project || null;
    }

    async getByExtension(extensionId: string): Promise<readonly Project[]> {
      return get(store).projects.filter(
        (p) => p.source?.extension === extensionId
      );
    }

    // Project-specific query methods
    async search(query: string): Promise<readonly Project[]> {
      const searchTerm = query.toLowerCase();
      return get(store).projects.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.description?.toLowerCase().includes(searchTerm) ||
          p.tags.some((tag) => tag.toLowerCase().includes(searchTerm)) ||
          p.areas.some((area) => area.toLowerCase().includes(searchTerm))
      );
    }

    async getByArea(areaId: string): Promise<readonly Project[]> {
      return get(store).projects.filter((p) => p.areas.includes(areaId));
    }

    async getByTag(tag: string): Promise<readonly Project[]> {
      return get(store).projects.filter((p) => p.tags.includes(tag));
    }
  };

  static Operations = class ProjectOperations extends EntitiesOperations {
    public entityType = "project" as const;

    async create(
      projectData: Omit<Project, "id" | "createdAt" | "updatedAt">
    ): Promise<Project> {
      // buildEntity now handles schema validation and date coercion
      const project = this.buildEntity(projectData) as Project;

      // Dispatch action instead of calling store method directly
      store.dispatch({ type: "ADD_PROJECT", project });

      eventBus.trigger({ type: "projects.created", project });

      return project;
    }

    async update(project: Project): Promise<Project> {
      const updatedProject: Project = {
        ...project,
        updatedAt: this.timestamp(),
      };

      // Dispatch action instead of calling store method directly
      store.dispatch({ type: "UPDATE_PROJECT", project: updatedProject });

      eventBus.trigger({ type: "projects.updated", project: updatedProject });

      return updatedProject;
    }

    async delete(id: string): Promise<void> {
      // Get the project before removing it so we can include it in the event
      const project = get(store).projects.find((p) => p.id === id);

      // Dispatch action instead of calling store method directly
      store.dispatch({ type: "REMOVE_PROJECT", projectId: id });

      // Include the project in the event so listeners can access its properties (like filePath)
      eventBus.trigger({ type: "projects.deleted", projectId: id, project });
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

// Singleton operations removed - operations must be instantiated with settings
// Use Projects.Operations and Projects.Queries classes directly
