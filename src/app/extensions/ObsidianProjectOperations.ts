/**
 * Obsidian Project Operations
 * Reactive note manager that responds to project domain events by managing corresponding Obsidian notes
 */

import { App, stringifyYaml } from "obsidian";
import { Project } from "../core/entities";

export class ObsidianProjectOperations {
  constructor(private app: App, private folder: string) {}

  // Note management methods for reactive updates (called by ObsidianExtension)
  async createNote(project: Project): Promise<void> {
    try {
      const fileName = this.sanitizeFileName(project.name);
      const filePath = `${this.folder}/${fileName}.md`;

      // Convert project to front-matter (only store user-visible properties)
      const frontMatter = {
        Name: project.name,
        Type: "Project",
        Areas: project.areas.length > 0 ? project.areas : undefined,
        tags: project.tags.length > 0 ? project.tags : undefined,
      };

      // Remove undefined values safely
      const cleanedFrontMatter = Object.fromEntries(
        Object.entries(frontMatter).filter(([_, value]) => value !== undefined)
      );

      const frontMatterYaml = stringifyYaml(cleanedFrontMatter);
      const content = `---\n${frontMatterYaml}---\n\n${project.description || ""}`;

      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile) {
        await this.app.vault.modify(existingFile as any, content);
      } else {
        await this.app.vault.create(filePath, content);
      }
    } catch (error) {
      console.error("Failed to create project note:", error);
    }
  }

  async updateNote(project: Project): Promise<void> {
    // For now, just recreate the note with updated content
    await this.createNote(project);
  }

  async deleteNote(projectId: string): Promise<void> {
    try {
      // For now, we can't easily map from ID to file without additional tracking
      // This would need to be improved in a real implementation
      console.log(`Would delete project note for ID: ${projectId}`);
    } catch (error) {
      console.error("Failed to delete project note:", error);
    }
  }

  // Private helper methods

  private sanitizeFileName(name: string): string {
    // Basic sanitization - remove invalid characters
    return name.replace(/[<>:"/\\|?*]/g, "").trim();
  }
}
