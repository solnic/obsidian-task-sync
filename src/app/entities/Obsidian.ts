/**
 * Obsidian-specific Entity Operations
 * Extends base entity operations to add Obsidian-specific behavior
 * Works for all entity types: Tasks, Projects, Areas
 */

import { Task, Project, Area } from "../core/entities";
import { Tasks } from "./Tasks";
import { Projects } from "./Projects";
import { Areas } from "./Areas";

/**
 * Configuration for Obsidian entity operations
 */
export interface ObsidianConfig {
  tasksFolder?: string;
  projectsFolder?: string;
  areasFolder?: string;
}

/**
 * Obsidian namespace containing extension-specific operations
 */
export namespace Obsidian {
  /**
   * Obsidian-specific Task Operations
   * Overrides buildEntity to automatically set source.filePath
   */
  export class TaskOperations extends Tasks.Operations {
    constructor(private folder: string = "Tasks") {
      super();
    }

    public buildEntity(
      taskData: Omit<Task, "id" | "createdAt" | "updatedAt">
    ): Task {
      const baseEntity = super.buildEntity(taskData) as Task;

      return {
        ...baseEntity,
        source: {
          extension: "obsidian",
          filePath: `${this.folder}/${taskData.title}.md`,
        },
      };
    }
  }

  /**
   * Obsidian-specific Project Operations
   * Overrides buildEntity to automatically set source.filePath
   */
  export class ProjectOperations extends Projects.Operations {
    constructor(private folder: string = "Projects") {
      super();
    }

    public buildEntity(
      projectData: Omit<Project, "id" | "createdAt" | "updatedAt">
    ): Project {
      const baseEntity = super.buildEntity(projectData) as Project;

      return {
        ...baseEntity,
        source: {
          extension: "obsidian",
          filePath: `${this.folder}/${projectData.name}.md`,
        },
      };
    }
  }

  /**
   * Obsidian-specific Area Operations
   * Overrides buildEntity to automatically set source.filePath
   */
  export class AreaOperations extends Areas.Operations {
    constructor(private folder: string = "Areas") {
      super();
    }

    public buildEntity(
      areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
    ): Area {
      const baseEntity = super.buildEntity(areaData) as Area;

      return {
        ...baseEntity,
        source: {
          extension: "obsidian",
          filePath: `${this.folder}/${areaData.name}.md`,
        },
      };
    }
  }

  /**
   * Factory class to create Obsidian operations with custom configuration
   */
  export class Operations {
    public readonly tasks: TaskOperations;
    public readonly projects: ProjectOperations;
    public readonly areas: AreaOperations;

    constructor(config: ObsidianConfig = {}) {
      this.tasks = new TaskOperations(config.tasksFolder);
      this.projects = new ProjectOperations(config.projectsFolder);
      this.areas = new AreaOperations(config.areasFolder);
    }
  }
}

// Export default singleton instance with default folder names
export const obsidianOperations = new Obsidian.Operations();
