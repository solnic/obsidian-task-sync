/**
 * Abstract base class for Obsidian entity operations
 * Provides common note management functionality for Area and Project operations
 */

import { App, stringifyYaml } from "obsidian";
import { Area, Project, Task } from "../core/entities";

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
export abstract class ObsidianEntityOperations<T extends ObsidianEntity> {
  constructor(protected app: App, protected folder: string) {}

  // Abstract method that subclasses must implement to define entity-specific front-matter
  protected abstract generateFrontMatter(entity: T): Record<string, any>;
  protected abstract getEntityType(): string;

  // Abstract method that subclasses must implement to get entity display name for file naming
  protected abstract getEntityDisplayName(entity: T): string;

  // Common note management methods for reactive updates (called by ObsidianExtension)
  async createNote(entity: T): Promise<void> {
    try {
      // Use polymorphic approach to get entity display name
      const entityName = this.getEntityDisplayName(entity);
      const fileName = this.sanitizeFileName(entityName);
      const filePath = `${this.folder}/${fileName}.md`;

      // Generate entity-specific front-matter
      const frontMatter = this.generateFrontMatter(entity);

      // Remove undefined values safely
      const cleanedFrontMatter = Object.fromEntries(
        Object.entries(frontMatter).filter(([_, value]) => value !== undefined)
      );

      const frontMatterYaml = stringifyYaml(cleanedFrontMatter);
      const content = `---\n${frontMatterYaml}---\n\n${
        entity.description || ""
      }`;

      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile) {
        await this.app.vault.modify(existingFile as any, content);
      } else {
        await this.app.vault.create(filePath, content);
      }
    } catch (error) {
      console.error(
        `Failed to create ${this.getEntityType().toLowerCase()} note:`,
        error
      );
    }
  }

  async updateNote(entity: T): Promise<void> {
    // For now, just recreate the note with updated content
    await this.createNote(entity);
  }

  async deleteNote(entityId: string): Promise<void> {
    try {
      // For now, we can't easily map from ID to file without additional tracking
      // This would need to be improved in a real implementation
      console.log(
        `Would delete ${this.getEntityType().toLowerCase()} note for ID: ${entityId}`
      );
    } catch (error) {
      console.error(
        `Failed to delete ${this.getEntityType().toLowerCase()} note:`,
        error
      );
    }
  }

  // Protected helper methods available to subclasses (overridable)

  protected sanitizeFileName(name: string): string {
    // Basic sanitization - remove invalid characters
    return name.replace(/[<>:"/\\|?*]/g, "").trim();
  }
}
