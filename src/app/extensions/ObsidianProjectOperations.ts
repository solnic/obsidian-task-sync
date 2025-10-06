/**
 * Obsidian Project Operations
 * Reactive note manager that responds to project domain events by managing corresponding Obsidian notes
 */

import { App } from "obsidian";
import { Project } from "../core/entities";
import { ObsidianEntityOperations } from "./ObsidianEntityOperations";
import { ObsidianBaseManager } from "./obsidian/BaseManager";
import type { TaskSyncSettings } from "../types/settings";
import { PROPERTY_REGISTRY } from "./obsidian/PropertyRegistry";

export class ObsidianProjectOperations extends ObsidianEntityOperations<Project> {
  constructor(
    app: App,
    folder: string,
    private baseManager?: ObsidianBaseManager,
    private settings?: TaskSyncSettings
  ) {
    super(app, folder);
  }

  // Implement abstract method to get entity display name for file naming
  protected getEntityDisplayName(project: Project): string {
    return project.name;
  }

  // Implement abstract methods for project-specific behavior
  protected generateFrontMatter(project: Project): Record<string, any> {
    return {
      [PROPERTY_REGISTRY.NAME.name]: project.name, // Use property name from registry
      [PROPERTY_REGISTRY.TYPE.name]: "Project", // Always "Project" for project entities
      [PROPERTY_REGISTRY.AREAS.name]:
        project.areas && project.areas.length > 0 ? project.areas : undefined,
      [PROPERTY_REGISTRY.TAGS.name]:
        project.tags && project.tags.length > 0 ? project.tags : undefined,
    };
  }

  protected getEntityType(): string {
    return "Project";
  }

  /**
   * Override createNote to include base generation
   * This makes base generation synchronous with note creation, improving performance
   */
  async createNote(project: Project): Promise<string> {
    // First create the note using parent implementation
    const filePath = await super.createNote(project);

    // Then generate the base file if enabled
    await this.generateBaseForProject(project);

    return filePath;
  }

  /**
   * Override updateNote to include base regeneration
   * This ensures bases stay in sync when projects are updated
   */
  async updateNote(project: Project): Promise<void> {
    // First update the note using parent implementation
    await super.updateNote(project);

    // Then regenerate the base file if enabled
    await this.generateBaseForProject(project);
  }

  /**
   * Generate base file for a project
   * Only generates if base manager is available, bases are enabled, and auto-sync is on
   */
  private async generateBaseForProject(project: Project): Promise<void> {
    // Check if base generation is enabled and configured
    if (
      !this.baseManager ||
      !this.settings?.projectBasesEnabled ||
      !this.settings?.autoSyncAreaProjectBases
    ) {
      return;
    }

    // Check if project has the required filePath
    if (!project.source?.filePath) {
      console.warn(
        `Cannot generate base for project "${project.name}": missing filePath`
      );
      return;
    }

    try {
      const projectInfo = {
        name: project.name,
        path: project.source.filePath,
        type: "project" as const,
      };

      console.log(`Generating base for project: ${project.name}`);
      await this.baseManager.createOrUpdateProjectBase(projectInfo);
    } catch (error) {
      console.error(
        `Failed to generate base for project "${project.name}":`,
        error
      );
    }
  }
}
