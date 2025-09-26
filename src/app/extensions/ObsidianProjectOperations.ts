/**
 * Obsidian Project Operations
 * Reactive note manager that responds to project domain events by managing corresponding Obsidian notes
 */

import { App } from "obsidian";
import { Project } from "../core/entities";
import { ObsidianEntityOperations } from "./ObsidianEntityOperations";

export class ObsidianProjectOperations extends ObsidianEntityOperations<Project> {
  constructor(app: App, folder: string) {
    super(app, folder);
  }

  // Implement abstract method to get entity display name for file naming
  protected getEntityDisplayName(project: Project): string {
    return project.name;
  }

  // Implement abstract methods for project-specific behavior
  protected generateFrontMatter(project: Project): Record<string, any> {
    return {
      Name: project.name,
      Type: "Project",
      Areas:
        project.areas && project.areas.length > 0 ? project.areas : undefined,
      tags: project.tags && project.tags.length > 0 ? project.tags : undefined,
    };
  }

  protected getEntityType(): string {
    return "Project";
  }
}
