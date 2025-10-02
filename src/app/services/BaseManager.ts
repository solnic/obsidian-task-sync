/**
 * BaseManager Service
 * Manages Obsidian Bases files - creates, updates, and maintains base configurations
 * with proper properties and views for task management
 * Ported from old-stuff to new architecture, focusing on Project entity type
 */

import { App, Vault, TFile, TFolder } from "obsidian";
import { TaskSyncSettings } from "../types/settings";
import * as yaml from "js-yaml";
import { sanitizeFileName } from "../utils/fileNameSanitizer";
import {
  generateProjectBase as generateProjectBaseConfig,
  ProjectAreaInfo,
} from "./BaseConfigurations";

export interface BaseProperty {
  displayName: string;
  type?: string;
  formula?: string;
}

export interface BaseView {
  type: "table" | "kanban" | "calendar";
  name: string;
  filters?: {
    and?: Array<string>;
    or?: Array<string>;
  };
  order?: string[];
  sort?: Array<{
    property: string;
    direction: "ASC" | "DESC";
  }>;
  columnSize?: Record<string, number>;
}

export interface BaseConfig {
  formulas?: Record<string, string>;
  properties: Record<string, any>;
  views: BaseView[];
}

export class BaseManager {
  // Static regex pattern for base embedding detection
  private static readonly BASE_EMBED_PATTERN = /!\[\[.*\.base\]\]/g;

  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings
  ) {}

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Get all projects for base view generation
   * Scans the projects folder for files with Type: Project
   */
  async getProjects(): Promise<ProjectAreaInfo[]> {
    const projects: ProjectAreaInfo[] = [];

    try {
      const projectsFolder = this.vault.getAbstractFileByPath(
        this.settings.projectsFolder
      );

      if (!projectsFolder || !(projectsFolder instanceof TFolder)) {
        console.log(
          `Projects folder not found: ${this.settings.projectsFolder}`
        );
        return projects;
      }

      for (const child of projectsFolder.children) {
        if (child instanceof TFile && child.extension === "md") {
          try {
            const metadata = this.app.metadataCache.getFileCache(child);
            const frontmatter = metadata?.frontmatter;

            // Check if this is a project file
            if (
              frontmatter?.Type === "Project" ||
              frontmatter?.type === "Project"
            ) {
              const projectName =
                frontmatter?.Name || frontmatter?.name || child.basename;

              projects.push({
                name: projectName,
                path: child.path,
                type: "project",
              });
            }
          } catch (error) {
            console.warn(
              `Failed to process project file ${child.path}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to scan projects folder:", error);
    }

    return projects;
  }

  /**
   * Create or update base file with given content
   */
  private async createOrUpdateBaseFile(
    baseFilePath: string,
    content: string,
    entityType: string
  ): Promise<void> {
    try {
      const existingFile = this.vault.getAbstractFileByPath(baseFilePath);

      if (existingFile instanceof TFile) {
        // Update existing file
        await this.vault.modify(existingFile, content);
        console.log(`Updated ${entityType} base file: ${baseFilePath}`);
      } else {
        // Create new file
        await this.vault.create(baseFilePath, content);
        console.log(`Created ${entityType} base file: ${baseFilePath}`);
      }
    } catch (error) {
      console.error(`Failed to create/update ${entityType} base file:`, error);
      throw error;
    }
  }

  /**
   * Ensure specific base embedding in entity file
   */
  private async ensureSpecificBaseEmbedding(
    filePath: string,
    baseFileName: string
  ): Promise<void> {
    try {
      const file = this.vault.getAbstractFileByPath(filePath) as TFile;
      if (!file) {
        console.warn(`File not found for base embedding: ${filePath}`);
        return;
      }

      const content = await this.vault.read(file);
      const specificBaseEmbed = `![[${this.settings.basesFolder}/${baseFileName}]]`;

      // Check if any base embedding exists
      if (BaseManager.BASE_EMBED_PATTERN.test(content)) {
        // Replace existing base embedding with the specific one
        // Reset lastIndex since we're reusing the static regex
        BaseManager.BASE_EMBED_PATTERN.lastIndex = 0;
        const updatedContent = content.replace(
          BaseManager.BASE_EMBED_PATTERN,
          specificBaseEmbed
        );
        await this.vault.modify(file, updatedContent);
        console.log(`Updated base embedding in: ${filePath}`);
      } else {
        // Add new base embedding
        const updatedContent =
          content.trim() + `\n\n## Tasks\n${specificBaseEmbed}`;
        await this.vault.modify(file, updatedContent);
        console.log(`Added base embedding to: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to add base embedding to ${filePath}:`, error);
    }
  }

  /**
   * Sync project bases - create individual bases for projects
   */
  async syncProjectBases(): Promise<void> {
    if (!this.settings.projectBasesEnabled) {
      console.log("Project bases disabled, skipping sync");
      return;
    }

    console.log("BaseManager: Starting project bases sync");

    const projects = await this.getProjects();
    console.log(
      `BaseManager: Found ${projects.length} projects to create bases for:`,
      projects.map((p) => p.name)
    );

    for (const project of projects) {
      console.log(`BaseManager: Creating project base for: ${project.name}`);
      await this.createOrUpdateProjectBase(project);
    }

    console.log("Project bases synced successfully");
  }

  /**
   * Create or update an individual project base file
   */
  async createOrUpdateProjectBase(project: ProjectAreaInfo): Promise<void> {
    const sanitizedName = sanitizeFileName(project.name);
    const baseFileName = `${sanitizedName}.base`;
    const baseFilePath = `${this.settings.basesFolder}/${baseFileName}`;
    const content = await this.generateProjectBase(project);

    try {
      await this.createOrUpdateBaseFile(baseFilePath, content, "project");
      // Update the project file to embed the specific base
      await this.ensureSpecificBaseEmbedding(project.path, baseFileName);
    } catch (error) {
      console.error(`Failed to create/update project base file: ${error}`);
      throw error;
    }
  }

  /**
   * Generate base configuration for a specific project
   */
  async generateProjectBase(project: ProjectAreaInfo): Promise<string> {
    return generateProjectBaseConfig(this.settings, project);
  }

  /**
   * Clean up project bases when disabled
   */
  async cleanupProjectBases(projects: ProjectAreaInfo[]): Promise<void> {
    console.log("Cleaning up project bases...");

    for (const project of projects) {
      const sanitizedName = sanitizeFileName(project.name);
      const baseFileName = `${sanitizedName}.base`;
      const baseFilePath = `${this.settings.basesFolder}/${baseFileName}`;

      try {
        const baseFile = this.vault.getAbstractFileByPath(baseFilePath);
        if (baseFile instanceof TFile) {
          await this.vault.delete(baseFile);
          console.log(`Deleted project base: ${baseFilePath}`);
        }
      } catch (error) {
        console.warn(`Failed to delete project base ${baseFilePath}:`, error);
      }
    }
  }
}
