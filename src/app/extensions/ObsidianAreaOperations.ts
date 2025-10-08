/**
 * Obsidian Area Operations
 * Reactive note manager that responds to area domain events by managing corresponding Obsidian notes
 */

import { App } from "obsidian";
import { Area } from "../core/entities";
import { ObsidianEntityOperations } from "./ObsidianEntityOperations";
import { PROPERTY_REGISTRY } from "./obsidian/PropertyRegistry";
import type { TaskSyncSettings } from "../types/settings";
import type { TypeNote } from "../core/type-note/TypeNote";

export class ObsidianAreaOperations extends ObsidianEntityOperations<Area> {
  private typeNote?: TypeNote;

  constructor(app: App, settings: TaskSyncSettings) {
    super(app, settings.areasFolder);
  }

  /**
   * Set TypeNote instance for creating typed notes
   * This is called by ObsidianExtension after TypeNote is initialized
   */
  setTypeNote(typeNote: TypeNote): void {
    this.typeNote = typeNote;
  }

  // Implement abstract method to get entity display name for file naming
  protected getEntityDisplayName(area: Area): string {
    return area.name;
  }

  // Implement abstract methods for area-specific behavior
  protected generateFrontMatter(area: Area): Record<string, any> {
    return {
      [PROPERTY_REGISTRY.NAME.name]: area.name, // Use property name from registry
      [PROPERTY_REGISTRY.TYPE.name]: "Area", // Always "Area" for area entities
      [PROPERTY_REGISTRY.TAGS.name]:
        area.tags && area.tags.length > 0 ? area.tags : undefined,
    };
  }

  protected getEntityType(): string {
    return "Area";
  }

  /**
   * Override createNote to use TypeNote when available
   * Falls back to parent implementation if TypeNote is not set
   */
  async createNote(area: Area): Promise<string> {
    // If TypeNote is available, use it to create the note
    if (this.typeNote) {
      return await this.createNoteWithTypeNote(area);
    }

    // Otherwise, fall back to the parent implementation
    return await super.createNote(area);
  }

  /**
   * Create an area note using TypeNote
   */
  private async createNoteWithTypeNote(area: Area): Promise<string> {
    const fileName = this.sanitizeFileName(area.name);
    const filePath = `${this.folder}/${fileName}.md`;

    // Prepare properties for TypeNote
    const properties = this.prepareTypeNoteProperties(area);

    // Create the note using TypeNote
    const result = await this.typeNote!.fileManager.createTypedNote("area", {
      folder: this.folder,
      fileName: area.name,
      properties,
      validateProperties: true,
      overwrite: true, // Allow overwriting existing files
    });

    if (!result.success) {
      throw new Error(
        `Failed to create area note: ${
          result.errors?.join(", ") || "Unknown error"
        }`
      );
    }

    // Trigger appropriate event
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      this.trigger("notes.updated", {
        entityId: area.id,
        filePath: result.filePath!,
      });
    } else {
      this.trigger("notes.created", {
        entityId: area.id,
        filePath: result.filePath!,
      });
    }

    return result.filePath!;
  }

  /**
   * Prepare area properties for TypeNote
   * Converts Area entity to TypeNote property format
   */
  private prepareTypeNoteProperties(area: Area): Record<string, any> {
    return {
      name: area.name,
      type: "Area",
      tags: area.tags || [],
      description: area.description || "",
    };
  }
}
