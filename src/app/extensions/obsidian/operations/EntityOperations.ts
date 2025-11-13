/**
 * Abstract base class for Obsidian entity operations
 * Provides common note management functionality for Area and Project operations
 */

import { App, stringifyYaml } from "obsidian";
import { Area, Project, Task } from "../../../core/entities";
import { EntityOperations } from "../../../core/extension";

// Union type for entities that can be managed by Obsidian operations
export type ObsidianEntity = Area | Project | Task;

// Interface for entity-specific front-matter generation
export interface EntityFrontMatterGenerator<T extends ObsidianEntity> {
  generateFrontMatter(entity: T): Record<string, any>;
  getEntityType(): string;
}

// Interface for entities that can provide their display name for file naming
export interface EntityNameProvider {
  getDisplayName(): string;
}

/**
 * Abstract base class for Obsidian entity operations
 * Handles common note management patterns for entities
 */
export abstract class ObsidianEntityOperations<
  T extends ObsidianEntity
> extends EntityOperations<T> {
  constructor(protected app: App, protected folder: string) {
    super({ id: "obsidian" });
  }

  // Abstract method that subclasses must implement to define entity-specific front-matter
  protected abstract generateFrontMatter(entity: T): Record<string, any>;
  protected abstract getEntityType(): string;

  // Abstract method that subclasses must implement to get entity display name for file naming
  protected abstract getEntityDisplayName(entity: T): string;

  // Common note management methods for reactive updates (called by ObsidianExtension)
  async createNote(entity: T): Promise<string> {
    console.log("[EntityOperations] Creating note for entity:", (entity as any).id);

    // Use existing obsidian key if available, otherwise generate from entity name
    // This prevents creating duplicate files when title changes
    const existingObsidianKey = (entity as any).source?.keys?.obsidian;
    let filePath: string;

    if (existingObsidianKey) {
      // Use existing file path to update the file in place
      filePath = existingObsidianKey;
      console.log("[EntityOperations] Using existing file path:", filePath);
    } else {
      // Generate new file path from entity display name
      const entityName = this.getEntityDisplayName(entity);
      const fileName = this.sanitizeFileName(entityName);
      filePath = `${this.folder}/${fileName}.md`;
      console.log("[EntityOperations] Generated new file path:", filePath);
    }

    // Generate entity-specific front-matter
    console.log("[EntityOperations] Generating front-matter...");
    const frontMatter = this.generateFrontMatter(entity);
    console.log("[EntityOperations] Front-matter generated:", frontMatter);

    // Remove undefined values safely
    const cleanedFrontMatter = Object.fromEntries(
      Object.entries(frontMatter).filter(([_, value]) => value !== undefined)
    );

    console.log("[EntityOperations] Stringifying front-matter to YAML...");
    const frontMatterYaml = stringifyYaml(cleanedFrontMatter);
    console.log("[EntityOperations] YAML generated successfully");

    const content = `---\n${frontMatterYaml}---\n\n${entity.description || ""}`;

    const existingFile = this.app.vault.getAbstractFileByPath(filePath);

    if (existingFile) {
      console.log("[EntityOperations] Updating existing file...");
      await this.app.vault.modify(existingFile as any, content);

      this.trigger("notes.updated", {
        entityId: entity.id,
        filePath,
      });
    } else {
      console.log("[EntityOperations] Creating new file...");
      await this.app.vault.create(filePath, content);

      this.trigger("notes.created", {
        entityId: entity.id,
        filePath,
      });
    }

    console.log("[EntityOperations] Note file created/updated successfully at:", filePath);
    return filePath;
  }

  async updateNote(entity: T): Promise<void> {
    // For updates, only update front-matter and preserve existing content
    const entityName = this.getEntityDisplayName(entity);
    const fileName = this.sanitizeFileName(entityName);
    const filePath = `${this.folder}/${fileName}.md`;

    const existingFile = this.app.vault.getAbstractFileByPath(filePath);

    if (existingFile) {
      // Generate entity-specific front-matter
      const frontMatter = this.generateFrontMatter(entity);

      // Remove undefined values safely
      const cleanedFrontMatter = Object.fromEntries(
        Object.entries(frontMatter).filter(([_, value]) => value !== undefined)
      );

      // Update only the front-matter, preserving existing body content
      await this.app.fileManager.processFrontMatter(
        existingFile as any,
        (existingFrontMatter) => {
          // Clear existing front-matter and replace with new data
          Object.keys(existingFrontMatter).forEach(
            (key) => delete existingFrontMatter[key]
          );
          Object.assign(existingFrontMatter, cleanedFrontMatter);
        }
      );

      this.trigger("notes.updated", {
        entityId: entity.id,
        filePath,
      });
    } else {
      // File doesn't exist, create it
      await this.createNote(entity);
    }
  }

  async deleteNote(entity: T): Promise<void> {
    if (!entity) {
      console.warn("Cannot delete note: entity is undefined");
      return;
    }

    const filePath = entity.source.keys.obsidian;

    if (!filePath) {
      console.warn("Cannot delete note: entity has no Obsidian file path");
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!file) {
      console.warn(`File not found for deletion: ${filePath}`);
      return;
    }

    await this.app.vault.delete(file);
  }

  // Protected helper methods available to subclasses (overridable)

  protected sanitizeFileName(name: string): string {
    // Basic sanitization - remove invalid characters
    return name.replace(/[<>:"/\\|?*]/g, "").trim();
  }
}
