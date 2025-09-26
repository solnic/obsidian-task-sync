/**
 * Obsidian Area Operations
 * Reactive note manager that responds to area domain events by managing corresponding Obsidian notes
 */

import { App, stringifyYaml } from "obsidian";
import { Area } from "../core/entities";

export class ObsidianAreaOperations {
  constructor(private app: App, private folder: string) {}

  // Note management methods for reactive updates (called by ObsidianExtension)
  async createNote(area: Area): Promise<void> {
    try {
      const fileName = this.sanitizeFileName(area.name);
      const filePath = `${this.folder}/${fileName}.md`;

      // Convert area to front-matter (only store user-visible properties)
      const frontMatter = {
        Name: area.name,
        Type: "Area",
        tags: area.tags.length > 0 ? area.tags : undefined,
      };

      // Remove undefined values safely
      const cleanedFrontMatter = Object.fromEntries(
        Object.entries(frontMatter).filter(([_, value]) => value !== undefined)
      );

      const frontMatterYaml = stringifyYaml(cleanedFrontMatter);
      const content = `---\n${frontMatterYaml}---\n\n${area.description || ""}`;

      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile) {
        await this.app.vault.modify(existingFile as any, content);
      } else {
        await this.app.vault.create(filePath, content);
      }
    } catch (error) {
      console.error("Failed to create area note:", error);
    }
  }

  async updateNote(area: Area): Promise<void> {
    // For now, just recreate the note with updated content
    await this.createNote(area);
  }

  async deleteNote(areaId: string): Promise<void> {
    try {
      // For now, we can't easily map from ID to file without additional tracking
      // This would need to be improved in a real implementation
      console.log(`Would delete area note for ID: ${areaId}`);
    } catch (error) {
      console.error("Failed to delete area note:", error);
    }
  }

  // Private helper methods

  private sanitizeFileName(name: string): string {
    // Basic sanitization - remove invalid characters
    return name.replace(/[<>:"/\\|?*]/g, "").trim();
  }
}
