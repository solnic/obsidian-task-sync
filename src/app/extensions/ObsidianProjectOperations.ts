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
import type { TypeNote } from "../core/type-note/TypeNote";

export class ObsidianProjectOperations extends ObsidianEntityOperations<Project> {
  private typeNote?: TypeNote;

  constructor(
    app: App,
    private settings: TaskSyncSettings,
    private baseManager?: ObsidianBaseManager
  ) {
    super(app, settings.projectsFolder);
  }

  /**
   * Set TypeNote instance for creating typed notes
   * This is called by ObsidianExtension after TypeNote is initialized
   */
  setTypeNote(typeNote: TypeNote): void {
    this.typeNote = typeNote;
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
   * Override createNote to use TypeNote when available and include base generation
   * Falls back to parent implementation if TypeNote is not set
   */
  async createNote(project: Project): Promise<string> {
    // If TypeNote is available, use it to create the note
    let filePath: string;
    if (this.typeNote) {
      filePath = await this.createNoteWithTypeNote(project);
    } else {
      // Otherwise, fall back to the parent implementation
      filePath = await super.createNote(project);
    }

    // Then generate the base file if enabled
    await this.generateBaseForProject(project);

    return filePath;
  }

  /**
   * Create a project note using TypeNote
   */
  private async createNoteWithTypeNote(project: Project): Promise<string> {
    const fileName = this.sanitizeFileName(project.name);
    const filePath = `${this.folder}/${fileName}.md`;

    // Prepare properties for TypeNote
    const properties = this.prepareTypeNoteProperties(project);

    // Create the note using TypeNote
    const result = await this.typeNote!.fileManager.createTypedNote("project", {
      folder: this.folder,
      fileName: project.name,
      properties,
      validateProperties: true,
      overwrite: true, // Allow overwriting existing files
    });

    if (!result.success) {
      throw new Error(
        `Failed to create project note: ${
          result.errors?.join(", ") || "Unknown error"
        }`
      );
    }

    // Trigger appropriate event
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      this.trigger("notes.updated", {
        entityId: project.id,
        filePath: result.filePath!,
      });
    } else {
      this.trigger("notes.created", {
        entityId: project.id,
        filePath: result.filePath!,
      });
    }

    return result.filePath!;
  }

  /**
   * Prepare project properties for TypeNote
   * Converts Project entity to TypeNote property format
   */
  private prepareTypeNoteProperties(project: Project): Record<string, any> {
    return {
      name: project.name,
      type: "Project",
      areas: project.areas || [],
      tags: project.tags || [],
      description: project.description || "",
    };
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
