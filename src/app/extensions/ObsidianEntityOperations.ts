/**
 * Abstract base class for Obsidian entity operations
 * Provides common note management functionality for Area and Project operations
 */

import { App, stringifyYaml } from "obsidian";
import { Area, Project, Task } from "../core/entities";
import { EntityOperations } from "../core/extension";

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
    const content = `---\n${frontMatterYaml}---\n\n${entity.description || ""}`;

    const existingFile = this.app.vault.getAbstractFileByPath(filePath);

    if (existingFile) {
      await this.app.vault.modify(existingFile as any, content);

      this.trigger("notes.updated", {
        entityId: entity.id,
        filePath,
      });
    } else {
      await this.app.vault.create(filePath, content);

      this.trigger("notes.created", {
        entityId: entity.id,
        filePath,
      });
    }

    return filePath;
  }

  async updateNote(entity: T): Promise<void> {
    await this.createNote(entity);
  }

  async deleteNote(entityId: string): Promise<void> {
    const entity = await this.getById(entityId);

    const filePath = entity.source.filePath as string;
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
