/**
 * Obsidian Task Operations
 * Reactive note manager that responds to task domain events by managing corresponding Obsidian notes
 */

import { App, stringifyYaml } from "obsidian";
import { Task } from "../core/entities";
import { ObsidianEntityOperations } from "./ObsidianEntityOperations";

export class ObsidianTaskOperations extends ObsidianEntityOperations<Task> {
  constructor(app: App, folder: string) {
    super(app, folder);
  }

  // Override createNote to handle task-specific naming (title instead of name)
  async createNote(task: Task): Promise<void> {
    try {
      const fileName = this.sanitizeFileName(task.title);
      const filePath = `${this.folder}/${fileName}.md`;

      // Generate task-specific front-matter
      const frontMatter = this.generateFrontMatter(task);

      // Remove undefined values safely
      const cleanedFrontMatter = Object.fromEntries(
        Object.entries(frontMatter).filter(([_, value]) => value !== undefined)
      );

      const frontMatterYaml = stringifyYaml(cleanedFrontMatter);
      const content = `---\n${frontMatterYaml}---\n\n${task.description || ""}`;

      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile) {
        await this.app.vault.modify(existingFile as any, content);
      } else {
        await this.app.vault.create(filePath, content);
      }
    } catch (error) {
      console.error(`Failed to create task note:`, error);
    }
  }

  // Override updateNote as well
  async updateNote(task: Task): Promise<void> {
    await this.createNote(task);
  }

  // Implement abstract methods for task-specific behavior
  protected generateFrontMatter(task: Task): Record<string, any> {
    return {
      Title: task.title,
      Type: task.category || "Task",
      Status: task.status,
      Priority: task.priority || undefined,
      Done: task.done,
      Project: task.project || undefined,
      Areas: task.areas.length > 0 ? task.areas : undefined,
      Tags: task.tags.length > 0 ? task.tags : undefined,
      Created: task.createdAt.toISOString().split('T')[0],
      Updated: task.updatedAt.toISOString().split('T')[0],
    };
  }

  protected getEntityType(): string {
    return "Task";
  }

  // Protected helper method available from parent class
  protected sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, "").trim();
  }
}